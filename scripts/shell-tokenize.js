'use strict';

/**
 * Shared shell-command tokenizer (best-effort, not a real shell parser --
 * see docs/SAFETY_ENFORCEMENT_POLICY.md G1 "unparseable = deny" for why
 * that's an acceptable trade-off here).
 *
 * Extracted out of scripts/scope-check.js during P1 re-review: an earlier
 * fix to scripts/event-log.js's secret-redaction check reimplemented a
 * WEAKER whitespace-only tokenizer instead of reusing this one, which left
 * a real gap -- operator-glued commands like `echo x>>.env` or
 * `printf ... 2>.env` split into a single `x>>.env` token that isn't
 * recognized as touching `.env`, so the secret leaked into
 * `.senpai/event_logs.jsonl` verbatim even though scope-check.js correctly
 * denied the same command. Any module that needs to reason about Bash
 * command tokens (gating OR logging) must use this single implementation,
 * not its own copy, so a future bypass fix only has to happen once.
 */

const OPERATOR_TOKENS = new Set(['>>', '>', '<', '||', '&&', '|', ';']);

/**
 * @param {string} command
 * @returns {string[]} whitespace/operator-separated tokens, operators kept
 *   as their own tokens (so a glued form like `x>>.env` becomes
 *   `['x', '>>', '.env']`, not one opaque token).
 */
function tokenizeCommand(command) {
  const spaced = command.replace(/(>>|&&|\|\||>|<|\||;)/g, ' $1 ');
  return spaced.split(/\s+/).filter(Boolean);
}

/**
 * @param {string} token
 * @returns {string} token with a single layer of matching surrounding
 *   quotes removed, if present.
 */
function stripQuotes(token) {
  if (token.length >= 2) {
    const first = token[0];
    const last = token[token.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return token.slice(1, -1);
    }
  }
  return token;
}

// Characters that risk a tokenizeCommand mis-split REGARDLESS of quoting --
// tokenizeCommand's operator regex (`>>|&&|\|\||>|<|\||;`) has no notion of
// quote boundaries, so e.g. `"a;.pem"` would otherwise split into `"a`, `;`,
// `.pem"`, hiding `a;.pem` (a real `.pem` secret) from the token scan. `&`
// is deliberately NOT in this set: tokenizeCommand never splits on a bare
// `&` (only `&&`), quoted or not, so quoting it creates no mis-split risk --
// its danger (round 5's `cat .env&`) is specifically an UNQUOTED gluing
// issue, handled separately below.
const TOKENIZER_UNSAFE_EVEN_QUOTED = new Set([';', '>', '<', '|']);

// Shell expansion characters that are 100% literal to bash when they appear
// inside a properly quoted segment (single OR double quotes both suppress
// glob/brace/tilde/subshell/extglob expansion), but genuinely dangerous when
// unquoted -- e.g. `cat .env*` (unquoted) vs `cat "*.env"` (quoted, literal).
const EXPANSION_SAFE_WHEN_QUOTED = new Set(['*', '?', '[', ']', '{', '}', '~', '(', ')']);

/**
 * Round-3 architect finding: `tokenizeCommand`/`stripQuotes` are a
 * best-effort tokenizer, not a real shell parser -- they don't model
 * backslash escapes and only strip ONE simple, unnested quote pair.
 *
 * Round-4 architect finding sharpened this into a general principle: a
 * BLACKLIST of specific unparseable constructs is unsound by construction
 * -- there is always one more expansion mechanism (round 4 confirmed glob
 * `*`/brace `{a,.env}` expansion slips straight through a blacklist that
 * only knew about backslashes and quotes). This module already discovered
 * the correct pattern elsewhere (scope-check.js's SAFE_ALLOWLIST_CHARS is a
 * positive character WHITELIST for the read-only path specifically because
 * "enumerating dangerous constructs one at a time is a losing game") --
 * this function applies that same whitelist discipline to the secret
 * backstop: a command is "resolvable" only if it is PROVABLY free of shell
 * expansion syntax, and everything else fails closed.
 *
 * Round-5 architect finding: this function used to be two separate,
 * asymmetric checks (scope-check.js additionally ran a
 * `hasShellMetacharacters` net the event-log.js redaction never got) --
 * folded into this single shared function so gate and log can't drift.
 *
 * P3 finding: the original version tested the RAW string for dangerous
 * characters with no notion of quoting at all, so a totally safe command
 * like `node scripts/classify-intent.js "다 됐어?"` was denied just because
 * the user's own quoted message happened to contain `?`/`(`/etc -- real
 * bash treats those as inert literal characters once they're inside a
 * properly quoted argument (this is precisely why quoting exists). This
 * version is a genuine quote-aware scan: characters that are only dangerous
 * because of shell EXPANSION (`*?[]{}~()`) are treated as safe once
 * quoted (single or double); characters that risk a TOKENIZER MIS-SPLIT
 * (`;><|`, per TOKENIZER_UNSAFE_EVEN_QUOTED above) stay dangerous even
 * inside quotes, because tokenizeCommand's own splitting is quote-blind;
 * `$`/backtick stay dangerous unless inside SINGLE quotes specifically
 * (bash still expands them inside double quotes, but single quotes make
 * everything but the closing `'` fully literal); backslash and embedded
 * CR/LF remain unconditionally dangerous (escape sequences aren't modeled).
 * A command with more than one separate top-level quoted region (e.g.
 * `"".env""`, bash string concatenation) still fails closed -- that is
 * exactly the round-3 bypass class this function must keep closing.
 *
 * @param {string} command
 * @returns {boolean}
 */
function hasUnresolvableSyntax(command) {
  if (typeof command !== 'string') {
    return false;
  }

  let mode = null; // null | 'single' | 'double'
  let quoteSegments = 0;

  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i];

    if (mode === 'single') {
      if (ch === "'") {
        mode = null;
        continue;
      }
      if (TOKENIZER_UNSAFE_EVEN_QUOTED.has(ch)) {
        return true;
      }
      if (ch === '\r' || ch === '\n') {
        return true;
      }
      // Everything else -- including \, $, `, and the expansion characters
      // -- is 100% literal inside single quotes in real bash.
      continue;
    }

    if (mode === 'double') {
      if (ch === '"') {
        mode = null;
        continue;
      }
      if (ch === '\\' || ch === '$' || ch === '`') {
        return true; // still expand/escape inside double quotes.
      }
      if (TOKENIZER_UNSAFE_EVEN_QUOTED.has(ch)) {
        return true;
      }
      if (ch === '\r' || ch === '\n') {
        return true;
      }
      // Expansion characters (*?[]{}~()) are literal inside double quotes.
      continue;
    }

    // Outside any quote:
    if (ch === "'") {
      mode = 'single';
      quoteSegments += 1;
      continue;
    }
    if (ch === '"') {
      mode = 'double';
      quoteSegments += 1;
      continue;
    }
    if (ch === '\\' || ch === '$' || ch === '`') {
      return true;
    }
    if (TOKENIZER_UNSAFE_EVEN_QUOTED.has(ch)) {
      // NOTE: intentionally NOT flagged unquoted -- `>` in particular is
      // load-bearing for redirect classification elsewhere in this module;
      // an unquoted `;`/`>`/`<`/`|` still ends up denied via classifyMutating
      // returning null (unrecognized) or the normal scope check, just not
      // via this pre-check.
      continue;
    }
    if (EXPANSION_SAFE_WHEN_QUOTED.has(ch)) {
      return true; // unquoted expansion syntax -- genuinely dangerous.
    }
    if (ch === '&') {
      return true; // unquoted backgrounding / token-gluing risk (round 5).
    }
    if (ch === '\r' || ch === '\n') {
      return true;
    }
  }

  if (mode !== null) {
    return true; // unterminated quote.
  }
  if (quoteSegments > 1) {
    return true; // multiple separate top-level quoted regions -- round-3
    // concatenation bypass (e.g. `"".env""`).
  }

  return false;
}

module.exports = { OPERATOR_TOKENS, tokenizeCommand, stripQuotes, hasUnresolvableSyntax };
