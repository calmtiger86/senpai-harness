'use strict';

/**
 * Scope Check (docs/SAFETY_ENFORCEMENT_POLICY.md G1~G4)
 *
 * `checkToolCall({ tool_name, tool_input }, state)` is the deterministic
 * decision function a PreToolUse hook calls for every tool invocation, for
 * a project that has ALREADY been confirmed to be Senpai-managed (see G0
 * below -- checkToolCall itself is not the opt-in gate, and callers must
 * not call it at all for an unmanaged project). It implements, in priority
 * order:
 *
 *   1. protect-secrets (scripts/protect-secrets.js) -- wins over everything
 *      else regardless of scope/approval state.
 *   2. Non-mutating tools (anything that isn't Write/Edit/Bash) pass through.
 *   3. Bash policy (G1): a small read-only allowlist auto-allows; anything
 *      else is assumed mutating and must parse into a recognized pattern
 *      (redirection, `sed -i`/`perl -i`, `rm`, `mv`, package installs) or
 *      it is denied as unparseable. `rm` with -r/-f/-rf flags targeting
 *      anything outside a safe temp scope is denied unconditionally.
 *   4. Write/Edit (and mutating-Bash-with-an-extracted-target) policy
 *      (G1+G3): normalize the target path (resolve relative to repo root,
 *      resolve `..`, resolve symlinks) and compare against
 *      `state.allowed_files` (exact or glob match). In scope + approved,
 *      not sensitive -> 'allow' (T1: the `[senpai-go:<project>]` at plan
 *      approval time already was the consent -- see checkPathsAgainstScope's
 *      module doc for why this moved off `permissionDecision:"ask"`).
 *      Sensitive (T2) -> 'deny' until individually re-confirmed via
 *      `[senpai-touch:<project>:<file>]`. Anything else -> 'deny'.
 *   5. Any path not explicitly covered above defaults to 'deny' (G4,
 *      fail-closed) -- enforced here both by explicit returns on every
 *      branch and by a try/catch safety net around the whole function.
 *
 * Judgment calls made where the prose spec was ambiguous (see also the
 * task report this module was written against):
 *
 * - approved_scope trust boundary: `isApprovalValid` from state-store.js
 *   does a session_id + scope_hash + approved_scope self-consistency
 *   check, but this module has no independent "current session/scope"
 *   value to compare against (it only receives `state`, not a second
 *   "current" descriptor) -- the caller (the PreToolUse hook) is assumed
 *   to have already validated that `state` reflects the *current*
 *   session/scope before calling checkToolCall. This module therefore
 *   just checks `state.approved_scope === true` directly. This is the
 *   simpler of the two options the task spec offered, and is documented
 *   here per its instruction to do so.
 * - repo root: `process.cwd()`, matching how state-store.js resolves
 *   `.senpai/` (also cwd-relative). No repoRoot parameter is exposed on
 *   checkToolCall's public signature since the task pins that signature
 *   to `(callInfo, state)`.
 * - Bash command chaining (`;`, `&&`, `||`, `|`): the read-only allowlist
 *   refuses to match any chained/piped command at all, even if every
 *   segment looks read-only (e.g. `ls && cat foo`). A naive per-segment
 *   allowlist match could be bypassed by appending a mutating command
 *   after an allowlisted prefix (`ls && rm -rf /` starts with `ls `,
 *   which would satisfy a prefix-only regex). Refusing to allowlist any
 *   chained command is more conservative and still fail-closed: it falls
 *   through to the mutating-pattern scan, which itself scans the *whole*
 *   raw string, so a chained `rm`/redirection is still caught and
 *   evaluated against scope rather than silently allowed.
 * - Read-only allowlist's "no redirection/mutating flags" condition is
 *   applied globally to every allowlist pattern (not just cat/echo, which
 *   the spec calls out explicitly as examples) -- e.g. `git diff > out`
 *   is treated as mutating, not allowed, since it does write a file.
 * - The read-only allowlist additionally requires the *entire* command to
 *   consist only of characters mundane read-only commands need (see
 *   `SAFE_ALLOWLIST_CHARS`), rather than only enumerating specific
 *   dangerous constructs. Enumerating one-at-a-time (redirection, `$(...)`,
 *   backticks, `&`, `<(...)`, newlines, ...) is a losing game -- there is
 *   always one more exotic construct (e.g. `-exec ... {} ;` needs `{`/`}`/
 *   `;`, all excluded by the whitelist without a dedicated rule). This
 *   also closes two non-obvious write primitives spelled in otherwise
 *   "safe" characters: `find -fprintf`/`-fprint`/`-fls` (writes
 *   attacker-chosen content to an attacker-chosen file, unlike
 *   `-printf`/`-print`/`-ls`, which only write to stdout) and
 *   `git diff`/`git log --output=<file>` (writes to a file instead of
 *   stdout) -- both get an explicit carve-out alongside `-delete`/`-exec rm`.
 * - Path-token extraction for the Bash secret-token scan (step 1) treats
 *   every non-operator token as a path candidate (after stripping
 *   surrounding quotes) and runs it through `isSecretPath`. This is
 *   intentionally broad/best-effort per the task's "simple heuristic"
 *   instruction -- false positives are harmless here since `isSecretPath`
 *   itself is a narrow pattern match, not a broad "looks pathy" check.
 * - Mutating-Bash target extraction requires *all* extracted targets
 *   (e.g. both `mv`'s source and destination, or every `rm` argument) to
 *   match `state.allowed_files` before returning 'ask' -- if any target
 *   is unresolved/out of scope, the whole call is denied. This is the
 *   conservative reading of "treat it like a Write/Edit target."
 * - (Round 5) The "shell metacharacters" deny-check this module used to
 *   define locally (backtick/`&`/`<`/CR-LF/`$(`/`${`) is now
 *   `./shell-tokenize.js#hasUnresolvableSyntax` -- the SAME function
 *   findSecretPath uses for the secret backstop, and event-log.js uses for
 *   log redaction. It used to be two separate checks of different
 *   strength; a command like `cat .env&` was denied here but still logged
 *   verbatim by the (weaker) log-side check. One shared function means the
 *   gate and the log can no longer drift out of sync.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { isSecretPath, isHardSecretPath } = require('./protect-secrets');
const { OPERATOR_TOKENS, tokenizeCommand, stripQuotes, hasUnresolvableSyntax } = require('./shell-tokenize');
const { backupIfExists } = require('./vault-writer');
const { writeState } = require('./state-store');
const { extractProjectFromPlanPath, buildTouchPhrase } = require('./senpai-approve');

// Advisor review finding (P4 follow-up): this was an allow-by-omission
// design (deny only these three named tools, allow everything else) --
// backwards from every other gate in this module ("모르면 막는다").
// NotebookEdit and MultiEdit both mutate files and were empirically
// confirmed to bypass this gate entirely (hard `allow`, no scope/approval
// check at all). Adding them here is a targeted fix for the two tools
// concretely confirmed to slip through, not a full inversion to a
// read-only allowlist -- Claude Code's tool set isn't fully enumerable
// from this module with confidence, and getting a broad allowlist wrong
// risks accidentally denying Read/Glob/Grep, which would break the whole
// harness far worse than this gap does. Residual risk: a future
// file-mutating tool with a name not listed here would still default-allow
// until added -- ponytail: known limitation, not chased further without a
// concrete case.
const MUTATING_TOOL_NAMES = new Set(['Write', 'Edit', 'Bash', 'NotebookEdit', 'MultiEdit']);

const READ_ONLY_BASE_PATTERNS = [
  /^ls(\s|$)/,
  /^cat(\s|$)/,
  /^git\s+status(\s|$)/,
  /^git\s+diff(\s|$)/,
  /^git\s+log(\s|$)/,
  /^pwd(\s|$)/,
  /^echo(\s|$)/,
  /^grep(\s|$)/,
  /^find(\s|$)/,
  /^node\s+(--version|-v)\s*$/,
  /^npm\s+(--version|-v)\s*$/
];

// P3 finding: skills need to run these specific, audited, pure (no
// filesystem writes, no side effects) CLI scripts -- classify-intent.js and
// select-meeting.js take a natural-language argument that legitimately
// contains punctuation ("다 됐어?") or JSON, which SAFE_ALLOWLIST_CHARS
// above can't accommodate (it's a blanket, quote-blind charset meant for
// simple commands like `cat file.txt`, and `?`/`{`/`}` there really are
// glob/brace metacharacters that must stay excluded for THOSE commands).
// Rather than loosen SAFE_ALLOWLIST_CHARS itself, these scripts get
// their own narrower check (KNOWN_SAFE_SCRIPT_NAMES below):
// hasUnresolvableSyntax already correctly
// distinguishes "dangerous unquoted" from "safe once quoted", and isChained/
// hasRedirection (defined below) are reused unchanged, so an attempted
// `node scripts/classify-intent.js "x"; rm -rf /` or `... > /etc/passwd`
// is rejected exactly as it would be for any other command.
// state-store.js's CLI form is read-only by construction (it only ever
// calls readState(), ignoring argv) -- see its require.main block's doc
// comment for why writeState() specifically must never get this treatment.
// select-parallel-council.js's CLI form is likewise pure/side-effect-free
// (reads its argv, at most stats/reads vault/30_Errors/ERR-*.md, and prints
// a JSON decision object to stdout -- see its own require.main block).
// update-matrix.js is likewise pure/side-effect-free (aggregates
// vault/60_Agent_Graph/Edge Logs.md into a Markdown table on stdout, no
// filesystem writes of its own) -- security-reviewer audit (2026-07)
// confirmed no command injection (argv is always a hardcoded literal path
// from the obsidian-brain-update skill, e.g.
// `node scripts/update-matrix.js "vault/60_Agent_Graph/Edge Logs.md"`).
// Its argv path itself isn't independently validated here, but this gate
// only ever controls writes, not reads -- an arbitrary-path read via this
// script is a subset of what the existing unconditional `cat` allowance
// already grants, and a secret-shaped path arg is still caught upstream by
// findSecretPath in checkToolCall's step 1 before this allowlist is reached.
const KNOWN_SAFE_SCRIPT_NAMES = [
  'classify-intent.js',
  'select-meeting.js',
  'doctor.js',
  'state-store.js',
  'select-parallel-council.js',
  'update-matrix.js'
];

// P5 live-install finding (docs/HARNESS_ENGINEERING.md §C-1): a user-scope
// plugin install activates this hook in EVERY project on the machine, not
// just ones the user meant to put under Senpai Harness. Without an opt-in
// gate, checkToolCall's G4 fail-closed default ("no state.json -> deny")
// blocks writes in totally unrelated projects that never asked for a Scope
// Meeting -- a live-verified regression, not a hypothetical.
//
// The marker is senpai.config.yaml specifically, NOT ".senpai/ directory
// exists": event-log.js's appendEvent() creates .senpai/ as a side effect of
// logging the very first hook firing (SessionStart), regardless of user
// intent, so treating that directory's existence as "opted in" would flip a
// project into managed/enforced on its very first touch. senpai.config.yaml
// is only ever created deliberately -- by a human copying
// project-template/senpai.config.yaml, or eventually by
// /senpai-harness:init -- so it is never created as an incidental side
// effect of the harness merely being installed.
//
// Exported (not just used internally) because the actual G0 opt-in gate
// lives in scripts/approval-gate.js#handlePreToolUse, NOT in this module's
// checkToolCall -- see the NOTE at the top of checkToolCall for why 'allow'
// from THIS function would be actively dangerous (auto-approval, not a
// passthrough) if it tried to implement G0 itself. scripts/doctor.js also
// imports this pair for its "marker reachable from cwd?" diagnostic.
const MANAGED_PROJECT_MARKER_FILENAME = 'senpai.config.yaml';

/**
 * @param {string} repoRoot
 * @returns {boolean} true if this project has opted into Senpai Harness
 *   enforcement (has its own senpai.config.yaml at the repo root).
 */
function isSenpaiManagedProject(repoRoot) {
  try {
    return fs.existsSync(path.join(repoRoot, MANAGED_PROJECT_MARKER_FILENAME));
  } catch (err) {
    // fs.existsSync itself doesn't normally throw, but if the environment
    // ever makes it (e.g. a permissions edge case), fail closed: treat the
    // project as managed so the caller falls through to G1-G4 instead of
    // silently no-op'ing (passthrough) on an error it can't classify.
    return true;
  }
}

/**
 * Walks upward from `startDir` (NOT including it) looking for
 * senpai.config.yaml in an ancestor directory. Diagnostic-only utility --
 * isSenpaiManagedProject() deliberately stays cwd-only for the actual G0
 * enforcement decision (unifying it with an upward search is a larger,
 * separately-tracked change per docs/SAFETY_ENFORCEMENT_POLICY.md's G0
 * section). This is for callers that want to warn/refuse on the specific
 * "you're in a subfolder of an already-managed project" case without
 * changing G0's own semantics: scripts/doctor.js's reachability check, and
 * scripts/init.js's ancestor refusal (independent design-review finding,
 * 2026-07: without this, running init from a subfolder of a managed
 * project silently created a second, nested senpai.config.yaml + vault/
 * instead of recognizing the existing one).
 * @param {string} startDir
 * @returns {string|null} the first ancestor directory containing the
 *   marker, or null if none of them do.
 */
function findAncestorManagedMarker(startDir) {
  let dir = path.dirname(startDir);
  let prev = startDir;
  while (dir !== prev) {
    if (fs.existsSync(path.join(dir, MANAGED_PROJECT_MARKER_FILENAME))) {
      return dir;
    }
    prev = dir;
    dir = path.dirname(dir);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Small shell-ish helpers (best-effort, not a real shell parser -- see G1
// "unparseable = deny" for why that's an acceptable tradeoff here).
// tokenizeCommand/stripQuotes/OPERATOR_TOKENS live in ./shell-tokenize.js
// (shared with event-log.js -- see that module's header for why).
// ---------------------------------------------------------------------------

/**
 * @param {string} command
 * @returns {boolean} true if the command chains/pipes multiple commands.
 */
function isChained(command) {
  return /(;|&&|\|\||\|)/.test(command);
}

/**
 * @param {string} command
 * @returns {boolean} true if the command contains `>` or `>>` redirection.
 *
 * P4 live-session finding: `2>/dev/null` (discard stderr) was flagging
 * nearly every exploratory read-only command a real session naturally
 * wrote (`find ... 2>/dev/null`, `cat x 2>/dev/null || echo "missing"`) as
 * "has redirection" and denying it. It writes to no new target -- it only
 * discards a stream -- so stripping just this one exact, harmless form
 * before testing for `>` costs nothing in safety: a real file-targeting
 * redirect (`2>real.log`, `>out.txt`, `>>out.txt`) still has an unstripped
 * `>` and is still caught. (`2>&1` was considered too, but shell-tokenize.js's
 * hasUnresolvableSyntax -- checked earlier in checkToolCall, upstream of
 * this function -- already treats bare `&` as unresolvable regardless of
 * this fix, and no live session has actually needed it, so it's left
 * alone rather than widening two layers for a pattern that hasn't
 * surfaced.)
 */
function stripHarmlessRedirects(command) {
  // Security review finding: without the trailing boundary, this matched
  // inside `2>/dev/nullhack` too -- bash parses that as a redirect to a
  // real (if oddly-named) file under /dev/, not a no-op, so stripping it
  // let the gate's model of the command diverge from what bash actually
  // does. `/dev/null` must be a complete token (followed by whitespace or
  // end-of-string) to count as the harmless idiom.
  return command.replace(/2>\s*\/dev\/null(?=\s|$)/g, '');
}

function hasRedirection(command) {
  return />/.test(stripHarmlessRedirects(command));
}

// Enumerating dangerous shell constructs one at a time (command
// substitution, process substitution, backgrounding, brace expansion, ...)
// is a losing game -- there is always one more exotic construct. For the
// read-only allowlist specifically -- the one path that returns 'allow'
// with no further scrutiny at all -- defense-in-depth is worth the extra
// restriction: the ENTIRE command must consist of characters mundane
// read-only commands actually need (word chars, plain spaces/tabs --
// deliberately NOT \s, which would admit embedded newlines -- path
// punctuation, and quotes). Anything outside that set falls through to
// the mutating-classification / deny-by-default path below, which is the
// fail-closed direction ("모르면 막는다", docs/SAFETY_ENFORCEMENT_POLICY.md).
// (shell-tokenize.js's hasUnresolvableSyntax() also rejects newlines
// upstream of this check, but the whitelist is written to be correct on
// its own regardless of call order.)
//
// `*` and `?` are deliberately EXCLUDED (found via architect adversarial
// review -- see docs/SAFETY_ENFORCEMENT_POLICY.md "P1 실증 검증"): the
// secret check (findSecretPath) and this allowlist both operate on the
// literal, un-expanded command string, but bash performs glob expansion at
// execution time. `cat .env*` does not literally match any secret pattern
// and has no redirection/chaining, so without this exclusion it would pass
// straight through to 'allow' -- and then bash expands the glob to the
// real `.env` file. Denying any glob-bearing command on this no-scrutiny
// path is the same "can't statically prove it's safe -> deny" logic
// already applied to the mutation surface (`;`/`{`/backtick/etc are
// excluded for the same reason); it costs some legitimate read-only glob
// usage (`cat *.js`), which is an intentional, documented trade-off:
// safety over convenience for this MVP.
//
// `\p{L}`/`\p{N}` (P3 finding): `\w` only matches ASCII letters/digits, so a
// perfectly safe, non-dangerous command like `node scripts/classify-intent.js
// "로그인 기능 붙여줘"` failed this whitelist purely because the user's own
// Korean message doesn't fit `\w` -- for a product whose entire audience is
// Korean-speaking non-developers (docs/00_CONCEPT.md), that's a real defect,
// not a safety feature. Unicode letters/numbers carry no shell metacharacter
// meaning to bash, so allowing them widens what can be classified "mundane"
// without touching any of the dangerous-construct exclusions above (glob,
// operators, quotes-count, etc. are unchanged and still apply identically).
const SAFE_ALLOWLIST_CHARS = /^[\w \t./\-_=:,@~'"\p{L}\p{N}]+$/u;

/**
 * @param {string} command
 * @returns {boolean}
 */
function isReadOnlyAllowlisted(command) {
  const trimmed = command.trim();
  // Strip the same two harmless redirect idioms hasRedirection() ignores
  // before the character-class test -- otherwise a bare `>` inside
  // `2>/dev/null`/`2>&1` fails this charset gate even though hasRedirection
  // itself would already treat the command as redirection-free (P4 finding:
  // `find . -type f 2>/dev/null` was denied here despite hasRedirection
  // correctly returning false for it).
  if (!SAFE_ALLOWLIST_CHARS.test(stripHarmlessRedirects(trimmed))) {
    return false;
  }
  if (isChained(trimmed)) {
    return false;
  }
  if (hasRedirection(trimmed)) {
    return false;
  }
  if (/-delete\b/.test(trimmed) || /-exec\s+rm\b/.test(trimmed)) {
    return false;
  }
  // find's -fprintf/-fprint/-fprint0/-fls write attacker-chosen content to
  // an attacker-chosen file (unlike -printf/-print/-ls, which only write to
  // stdout) -- and git diff/log --output=<file> writes the diff/log to a
  // file instead of stdout. Both are spelled entirely in
  // SAFE_ALLOWLIST_CHARS-safe characters, so the character whitelist above
  // can't catch them; they need an explicit carve-out like -delete/-exec rm.
  if (/(^|\s)-f(print|ls)/.test(trimmed) || /--output[=\s]/.test(trimmed)) {
    return false;
  }
  return READ_ONLY_BASE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Narrower sibling of isReadOnlyAllowlisted for the specific scripts in
 * KNOWN_SAFE_SCRIPT_NAMES (see that constant's comment for why they
 * can't go through the generic SAFE_ALLOWLIST_CHARS gate). Deliberately
 * does NOT check SAFE_ALLOWLIST_CHARS -- it reuses hasUnresolvableSyntax
 * (quote-aware) plus the same isChained/hasRedirection guards
 * isReadOnlyAllowlisted already applies, so an injection attempt appended
 * after the recognized script invocation (`; rm -rf /`, `> /etc/passwd`)
 * is rejected exactly as it would be for any other command.
 *
 * The hasUnresolvableSyntax call here is structurally redundant today --
 * checkToolCall's findSecretPath step already runs it, unconditionally,
 * before checkBashCommand (and therefore this function) is ever reached --
 * but this function is a G1 allowlist gate on its own, so it must not
 * depend on staying reachable only via that exact call order. Kept
 * explicit per defense-in-depth review (flagged: `$(...)`,
 * backtick-substitution, unquoted `~`/`*`/`$VAR` args would otherwise have
 * no independent backstop inside this function itself).
 *
 * Matches by resolved realpath, not by string prefix (P4 live-session
 * finding): a real deployment's skills run with cwd = the user's project,
 * not the plugin's install directory, so `node scripts/classify-intent.js`
 * (relative path) never resolves to a real file there.
 *
 * This comment originally predicted the model would see a "Cannot find
 * module" runtime error and naturally retry with the absolute path --
 * corrected per a P14 live-session finding
 * (docs/P14_MEETING_LIVE_VERIFICATION.md, 발견 3): that isn't what happens.
 * The PreToolUse hook denies the Bash call before Node ever runs (this
 * function can't match the nonexistent relative path, classifyMutating
 * doesn't recognize bare `node ...` either, so checkBashCommand falls
 * through to its G1 fail-closed deny) -- the model sees only
 * `unrecognized/unparseable command, fail-closed per G1`, never a "Cannot
 * find module" message, and had nothing runtime-shaped to retry from. Live
 * observation: the model did not retry with an absolute path on its own;
 * it moved on to self-judgment instead. The fix that landed is
 * documentation, not a change to this function's matching logic --
 * `skills/meeting-system/SKILL.md`'s CLI examples now use
 * `${CLAUDE_PLUGIN_ROOT}` up front (the same env var `commands/init.md`,
 * `doctor.md`, and `status.md` already relied on), so the model never has
 * to discover the absolute form by trial and error. Separately, live
 * testing also found that `hasUnresolvableSyntax`'s multiple-top-level-
 * quoted-region rule (this file's caller, checked before this function
 * ever runs) denies `"${CLAUDE_PLUGIN_ROOT}/scripts/x.js" "arg"` (both
 * sides quoted = 2 quote segments) even though the path itself is valid --
 * scripts that take a quoted argument need the path left unquoted
 * (`node ${CLAUDE_PLUGIN_ROOT}/scripts/x.js "arg"`) to stay at 1 quote
 * segment; SKILL.md documents this explicitly now.
 *
 * Resolving the invoked script's realpath and comparing it
 * against this very file's own directory (`__dirname`, fixed at
 * require-time to the real installed scripts/ folder, unreachable by any
 * Bash command the model can issue) accepts both the relative and absolute
 * forms while still rejecting a same-named script planted anywhere else on
 * disk -- basename alone is deliberately NOT sufficient.
 * @param {string} command
 * @returns {boolean}
 */
function isKnownSafeScriptInvocation(command) {
  const trimmed = command.trim();
  if (isChained(trimmed) || hasRedirection(trimmed) || hasUnresolvableSyntax(trimmed)) {
    return false;
  }
  const tokens = tokenizeCommand(trimmed);
  if (tokens.length < 2 || tokens[0] !== 'node') {
    return false;
  }
  const scriptArg = stripQuotes(tokens[1]);
  const baseName = path.basename(scriptArg);
  if (!KNOWN_SAFE_SCRIPT_NAMES.includes(baseName)) {
    return false;
  }
  const resolved = safeRealpath(path.resolve(scriptArg));
  const trusted = safeRealpath(path.join(__dirname, baseName));
  return resolved === trusted;
}

/**
 * Classifies a non-allowlisted Bash command into a recognized mutating
 * pattern, or null if none match (caller must deny-by-default on null).
 * @param {string} command
 * @returns {'redirection'|'sed-i'|'perl-i'|'npm-install'|'pip-install'|'brew-install'|'rm'|'mv'|null}
 */
function classifyMutating(command) {
  if (hasRedirection(command)) {
    return 'redirection';
  }
  if (/\bsed\s+-i/.test(command)) {
    return 'sed-i';
  }
  if (/\bperl\s+-i/.test(command)) {
    return 'perl-i';
  }
  if (/\bnpm\s+install\b/.test(command) || /\bnpm\s+i\s/.test(command)) {
    return 'npm-install';
  }
  if (/\bpip\s+install\b/.test(command)) {
    return 'pip-install';
  }
  if (/\bbrew\s+install\b/.test(command)) {
    return 'brew-install';
  }
  if (/\brm\b/.test(command)) {
    return 'rm';
  }
  if (/\bmv\b/.test(command)) {
    return 'mv';
  }
  return null;
}

/**
 * Best-effort extraction of the file path(s) a mutating Bash command
 * writes to. Returns null when no confident target can be extracted
 * (caller must then fall through to deny-by-default, per G1).
 * @param {string[]} tokens
 * @param {string} kind result of classifyMutating()
 * @returns {string[]|null}
 */
function extractMutatingTargets(tokens, kind) {
  switch (kind) {
    case 'redirection': {
      let lastRedirectIdx = -1;
      tokens.forEach((token, idx) => {
        if (token === '>' || token === '>>') {
          lastRedirectIdx = idx;
        }
      });
      const target = lastRedirectIdx === -1 ? undefined : tokens[lastRedirectIdx + 1];
      return target ? [stripQuotes(target)] : null;
    }

    case 'sed-i':
    case 'perl-i': {
      // Advisor review finding (P4 follow-up): grabbing only the LAST token
      // silently under-checked a multi-file invocation like
      // `sed -i s/a/b/ notallowed.txt allowed.txt` -- only the last file
      // was compared against allowed_files, so an earlier, out-of-scope
      // file got edited under cover of an in-scope one. This module's own
      // contract (see doc comment above) requires ALL extracted targets to
      // match. The first non-flag token after the command is the
      // sed/perl script/expression, not a file -- skipped -- everything
      // non-flag after that is a file target.
      const cmdToken = kind === 'sed-i' ? 'sed' : 'perl';
      const cmdIdx = tokens.indexOf(cmdToken);
      if (cmdIdx === -1) {
        return null;
      }
      const nonFlagTokens = tokens
        .slice(cmdIdx + 1)
        .filter((token) => !token.startsWith('-') && !OPERATOR_TOKENS.has(token));
      const fileTokens = nonFlagTokens.slice(1).map(stripQuotes);
      return fileTokens.length > 0 ? fileTokens : null;
    }

    case 'rm':
    case 'mv': {
      const cmdIdx = tokens.indexOf(kind);
      if (cmdIdx === -1) {
        return null;
      }
      const targets = tokens
        .slice(cmdIdx + 1)
        .filter((token) => !token.startsWith('-') && !OPERATOR_TOKENS.has(token))
        .map(stripQuotes);
      return targets.length > 0 ? targets : null;
    }

    // npm/pip/brew install don't have a single file target to check
    // against allowed_files -- no confident extraction is possible.
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Path normalization + allowed_files matching (G3).
// ---------------------------------------------------------------------------

/**
 * @param {string} p
 * @returns {string} realpath of p, or p itself if it doesn't exist / can't
 *   be resolved (new files won't have a realpath yet).
 */
function safeRealpath(p) {
  try {
    return fs.realpathSync(p);
  } catch (err) {
    return p;
  }
}

/**
 * @param {string} rawPath possibly-relative, possibly-traversal-laden path
 * @param {string} repoRoot
 * @returns {string} normalized absolute path
 */
function normalizeTargetPath(rawPath, repoRoot) {
  const resolved = path.resolve(repoRoot, rawPath);
  return safeRealpath(resolved);
}

/**
 * @param {string} absPath
 * @returns {boolean} true if absPath resolves under os.tmpdir().
 */
function isUnderTmpdir(absPath) {
  const tmpRoot = safeRealpath(path.resolve(os.tmpdir()));
  const rel = path.relative(tmpRoot, absPath);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * P3 finding: every skill doc assumes vault documents (Decision Card,
 * Phase Plan, Unknown Map, Session Memory, ...) can be written before --
 * and independent of -- product-code build approval (docs/00_CONCEPT.md's
 * Obsidian Brain axis is meant to update continuously during meetings, not
 * only after a Build Readiness approval). But nothing exempted `vault/`
 * from the same allowed_files/approved_scope gate as real source, so
 * across an actual session literally zero vault writes could ever
 * succeed via the Write tool -- the walking skeleton's entire "Obsidian
 * Brain" axis was silently dead on arrival. `scripts/vault-writer.js`
 * (the module the docs point at instead) is equally unreachable: it has
 * no CLI entrypoint and isn't in KNOWN_SAFE_SCRIPT_NAMES (nor should it
 * be made reachable via Bash purely to route around this -- see the
 * checkToolCall call site for why the fix belongs here, at the Write/Edit
 * gate itself, not in a new Bash allowlist entry).
 *
 * Deliberately `vault/` only, never `vault-template/` -- the latter is the
 * plugin's own read-only template source, not per-project user data; a
 * couple of skill-doc examples mistakenly target vault-template/ as if it
 * were the live vault, which is a doc bug, not something this exemption
 * should paper over.
 * @param {string} absPath
 * @param {string} repoRoot
 * @returns {boolean} true if absPath resolves under `<repoRoot>/vault`.
 */
function isUnderVaultDir(absPath, repoRoot) {
  const vaultRoot = safeRealpath(path.resolve(repoRoot, 'vault'));
  const rel = path.relative(vaultRoot, absPath);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Converts a small glob subset (`*` = any chars except path separator,
 * `**` = any chars including path separators) into a RegExp, without a
 * new dependency.
 * @param {string} pattern
 * @returns {RegExp}
 */
function globToRegex(pattern) {
  const escaped = pattern
    .split('')
    .map((ch) => (/[.+^${}()|[\]\\]/.test(ch) ? `\\${ch}` : ch))
    .join('');
  const finalPattern = escaped.replace(/\*+/g, (run) => (run.length >= 2 ? '.*' : '[^/]*'));
  return new RegExp(`^${finalPattern}$`);
}

/**
 * @param {string} normalizedPath absolute, realpath-resolved target
 * @param {unknown} allowedFiles state.allowed_files (expected string[])
 * @param {string} repoRoot
 * @returns {boolean}
 */
function matchesAllowedFiles(normalizedPath, allowedFiles, repoRoot) {
  if (!Array.isArray(allowedFiles)) {
    return false;
  }
  return allowedFiles.some((entry) => {
    if (typeof entry !== 'string' || entry.length === 0) {
      return false;
    }
    const absEntryPattern = path.isAbsolute(entry) ? entry : path.join(repoRoot, entry);
    return globToRegex(absEntryPattern).test(normalizedPath);
  });
}

// Escalate-only sensitivity floor (critic review finding, 2026-07,
// MAJOR/CONFIRMED): sensitive_files previously depended ENTIRELY on the
// model's own Phase Plan authoring, in direct tension with this project's
// own "never trust the model's self-report as the sole source of truth"
// principle (docs/SAFETY_ENFORCEMENT_POLICY.md). A model that forgets (or
// rushes, or is careless) to flag an obviously sensitive file left it as an
// unconditional T1 auto-allow with no code-level backstop. This is a FLOOR,
// not a ceiling: the Phase Plan's sensitive_files can flag MORE files than
// this pattern list catches, but nothing the Phase Plan writes can
// de-escalate a floor match back down to T1. Deliberately broad (a few
// false positives just mean one extra confirmation, not a security gap) --
// leaning cautious is the safe direction for a floor.
const SENSITIVE_FLOOR_BASENAME_PATTERNS = [
  /^package(-lock)?\.json$/i,
  /^yarn\.lock$/i,
  /^pnpm-lock\.ya?ml$/i,
  /^requirements(-\w+)?\.txt$/i,
  /^gemfile(\.lock)?$/i,
  /^cargo\.toml$/i,
  /^go\.(mod|sum)$/i,
  /^dockerfile$/i,
  /^docker-compose\.ya?ml$/i,
  /schema\.prisma$/i,
  /\.sql$/i
];
const SENSITIVE_FLOOR_SEGMENT_PATTERN = /\b(auth|login|session|oauth|jwt|payment|billing|checkout|charge|invoice|migration|deploy(ment)?)\b/i;

/**
 * The segment pattern must run against the repo-relative path, not the
 * absolute realpath -- an absolute path carries the user's home directory,
 * username, and every ancestor folder name (e.g. a project cloned into
 * `~/Developer/login-app/` puts "login" in the path of every single file in
 * it). Matching the absolute path would make the floor fire on ALL of a
 * project's files whenever any ancestor folder happens to contain a trigger
 * word, which defeats the "friction only on truly sensitive files" premise
 * this floor exists to serve. The basename check is unaffected by this and
 * can run on either form.
 * @param {string} normalizedPath absolute, realpath-resolved target
 * @param {string} repoRoot absolute repo root, for computing the relative path
 * @returns {boolean}
 */
function matchesSensitiveFloor(normalizedPath, repoRoot) {
  const base = path.basename(normalizedPath);
  if (SENSITIVE_FLOOR_BASENAME_PATTERNS.some((pattern) => pattern.test(base))) {
    return true;
  }
  const relPath = path.relative(repoRoot, normalizedPath);
  return SENSITIVE_FLOOR_SEGMENT_PATTERN.test(relPath);
}

/**
 * Shared "is this in approved scope" check used by both Write/Edit and
 * mutating-Bash-with-extracted-target flows (G1 step 4 / G3).
 *
 * T0-T3 consent model (docs/SAFETY_ENFORCEMENT_POLICY.md, 2026-07 redesign):
 * a live smoke test found that this function's old unconditional `ask` for
 * every in-scope write is silently swallowed by Claude Code's own
 * `permissions.defaultMode: acceptEdits` -- the native per-file prompt this
 * `ask` exists to trigger never appears, so the only real consent a user in
 * that mode ever gave was the ONE `[senpai-go:<project>]` at plan-approval
 * time. Re-asking per file added friction without adding safety for that
 * user, and for everyone else it re-asked about files the human had
 * already seen and approved in the Phase Plan. So: ordinary approved files
 * (T1) now get `allow` -- the human's `[senpai-go:...]` IS the consent, no
 * second native prompt needed.
 *
 * Independent dual review (security-reviewer + critic, 2026-07,
 * HIGH/MAJOR/CONFIRMED): the first version of this redesign kept `ask` for
 * T2 (sensitive_files) -- but `ask` is exactly the signal just proven
 * unreliable under acceptEdits, so the highest-risk category (auth,
 * payment, deploy, db, dependency install) was left resting on the same
 * broken mechanism the whole redesign exists to fix. Fixed: T2 now returns
 * `deny` with a reason naming the exact `[senpai-touch:<project>:<file>]`
 * phrase the user must send (UserPromptSubmit-based, like `[senpai-go:...]`
 * -- proven immune to permission-mode, since deny/UserPromptSubmit capture
 * don't route through permissionDecision:"ask" at all). Once
 * senpai-approve.js#recordSensitiveFileConfirmation records that phrase,
 * the matching file(s) in state.confirmed_sensitive_files unlock to
 * `allow` on the next attempt.
 *
 * This `allow` is NOT the "allow as stand-in for no opinion" pattern the G0
 * fix (see hooks/scripts/handler.js's module doc) rejected -- that fix was
 * about an UNAPPROVED/unmanaged case where `allow` would have been an
 * active auto-approval standing in for "I have no opinion". Here the scope
 * IS approved (`state.approved_scope === true`, checked below) and the
 * target IS in the human-reviewed `allowed_files` list: this `allow` is a
 * genuine, scoped, freshly-consented-to decision, not a shrug.
 * @param {string[]} rawTargets
 * @param {object} state
 * @param {string} repoRoot
 * @returns {{decision: 'allow'|'deny', reason: string}}
 */
function checkPathsAgainstScope(rawTargets, state, repoRoot) {
  if (!Array.isArray(rawTargets) || rawTargets.length === 0) {
    return { decision: 'deny', reason: 'unrecognized/unparseable command, fail-closed per G1' };
  }

  const allowedFiles = state && Array.isArray(state.allowed_files) ? state.allowed_files : [];
  const sensitiveFiles = state && Array.isArray(state.sensitive_files) ? state.sensitive_files : [];
  const confirmedSensitive = state && Array.isArray(state.confirmed_sensitive_files) ? state.confirmed_sensitive_files : [];
  const scopeApproved = Boolean(state && state.approved_scope === true);

  const allInScope = rawTargets.every((rawTarget) => {
    const normalized = normalizeTargetPath(rawTarget, repoRoot);
    return matchesAllowedFiles(normalized, allowedFiles, repoRoot);
  });

  if (!allInScope || !scopeApproved) {
    return { decision: 'deny', reason: 'not in approved scope, needs a Scope Meeting first' };
  }

  const sensitiveTargets = rawTargets.filter((rawTarget) => {
    const normalized = normalizeTargetPath(rawTarget, repoRoot);
    return matchesAllowedFiles(normalized, sensitiveFiles, repoRoot) || matchesSensitiveFloor(normalized, repoRoot);
  });

  if (sensitiveTargets.length === 0) {
    return { decision: 'allow', reason: 'in approved scope, already consented to at plan approval (T1)' };
  }

  const allConfirmed = sensitiveTargets.every((rawTarget) => {
    const normalized = normalizeTargetPath(rawTarget, repoRoot);
    return matchesAllowedFiles(normalized, confirmedSensitive, repoRoot);
  });
  if (allConfirmed) {
    return { decision: 'allow', reason: 'sensitive file(s) individually re-confirmed via [senpai-touch:...] (T2)' };
  }

  const project = extractProjectFromPlanPath(state && state.pending_phase_plan_path);
  const phrases = sensitiveTargets.map((rawTarget) => {
    const relPath = path.relative(repoRoot, normalizeTargetPath(rawTarget, repoRoot));
    return buildTouchPhrase(project, relPath);
  });
  return {
    decision: 'deny',
    reason: `sensitive file(s) need individual re-confirmation before writing (T2) -- ask the user to send: ${phrases.join(', ')}`
  };
}

// ---------------------------------------------------------------------------
// Secret check (runs first, always -- see module doc).
// ---------------------------------------------------------------------------

// Sentinel returned by findSecretPath for a Bash command whose syntax
// couldn't be parsed at all. This is NOT a secret-path hit -- code review
// finding (2026-07, Minor): the caller used to fold this straight into
// "secret path detected (...)", which is misleading deny-reason copy for a
// product whose deny reasons ARE the non-developer-facing UI (a parse
// failure has nothing to do with secrets). The caller checks for this
// exact sentinel and reports a distinct, accurate reason instead.
const UNRESOLVABLE_SYNTAX_SENTINEL = '(unresolvable command syntax, fail-closed per G1/secret-check)';

/**
 * @param {string} toolName
 * @param {object} input tool_input
 * @returns {string|null} the offending path if a secret path is involved,
 *   the UNRESOLVABLE_SYNTAX_SENTINEL if the command couldn't be parsed at
 *   all, else null.
 */
function findSecretPath(toolName, input) {
  if (toolName === 'Bash') {
    if (typeof input.command !== 'string') {
      return null;
    }
    if (hasUnresolvableSyntax(input.command)) {
      return UNRESOLVABLE_SYNTAX_SENTINEL;
    }
    const tokens = tokenizeCommand(input.command);
    for (const token of tokens) {
      if (OPERATOR_TOKENS.has(token)) {
        continue;
      }
      const candidate = stripQuotes(token);
      if (candidate && isSecretPath(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  // Write, Edit, Read, and any other tool that carries a file_path field.
  if (typeof input.file_path === 'string' && isSecretPath(input.file_path)) {
    return input.file_path;
  }
  // NotebookEdit carries its target in notebook_path instead.
  if (typeof input.notebook_path === 'string' && isSecretPath(input.notebook_path)) {
    return input.notebook_path;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Control-plane self-protection (independent design-review finding, 2026-07,
// MAJOR/PLAUSIBLE): nothing previously stopped a Phase Plan's own
// allowed_files from listing senpai.config.yaml or anything under
// .senpai/. Once approved via the normal ask flow (a human clicking through
// a native prompt they can't be expected to recognize as scope-affecting),
// a mutation could rewrite state.json's own approved_scope/allowed_files/
// scope_hash fields directly -- scope-hash.js's computeScopeHash is
// deterministic and ships in the plugin, so a full rewrite of allowed_files
// plus a recomputed hash under the same session defeats the tamper-evidence
// check entirely -- or edit senpai.config.yaml itself. This runs
// unconditionally for any MUTATING tool call, like the secret check,
// segment-based (no repoRoot/normalization needed, mirroring
// protect-secrets.js's own approach) so it holds regardless of whether the
// path is written relative, absolute, or via a symlink hop. Deliberately
// NOT applied to non-mutating tools (Read, Grep, Glob): reading state.json
// to explain a denial to the user is legitimate and harmless -- only
// mutation is the threat this closes.
// ---------------------------------------------------------------------------

const CONTROL_PLANE_SEGMENTS = new Set([MANAGED_PROJECT_MARKER_FILENAME.toLowerCase(), '.senpai']);

/**
 * @param {string} candidate
 * @returns {boolean}
 */
function isControlPlaneCandidate(candidate) {
  if (typeof candidate !== 'string' || candidate.length === 0) {
    return false;
  }
  const segments = path.normalize(candidate).toLowerCase().split(path.sep).filter(Boolean);
  return segments.some((segment) => CONTROL_PLANE_SEGMENTS.has(segment));
}

/**
 * Covers Write/Edit/NotebookEdit/MultiEdit only. Bash is deliberately
 * handled separately, inside checkBashCommand on its extracted mutating
 * targets (bug found during self-test, 2026-07): a blanket per-token check
 * on every Bash call here would run BEFORE checkBashCommand's own
 * read-only allowlist gets a chance to allow a harmless read like
 * `cat .senpai/state.json` -- Bash is always classified as a mutating TOOL
 * (it's capable of mutation), independent of whether a given COMMAND
 * actually mutates anything, so this check must only see commands already
 * known to target a real mutation, not every Bash invocation whatsoever.
 * @param {string} toolName
 * @param {object} input tool_input
 * @returns {string|null} the offending path if a control-plane path
 *   (senpai.config.yaml or anything under .senpai/) is involved, else null.
 */
function findControlPlanePath(toolName, input) {
  if (toolName === 'Bash') {
    return null;
  }
  if (isControlPlaneCandidate(input.file_path)) {
    return input.file_path;
  }
  if (isControlPlaneCandidate(input.notebook_path)) {
    return input.notebook_path;
  }
  return null;
}

/**
 * @param {string} toolName
 * @param {object} input tool_input
 * @returns {string|null} input.file_path or input.notebook_path, whichever
 *   is present, for the tools this gate treats as file-mutating; null for
 *   everything else (including Bash, which has no single target path).
 */
function getMutatingFileTarget(toolName, input) {
  if (toolName !== 'Write' && toolName !== 'Edit' && toolName !== 'NotebookEdit' && toolName !== 'MultiEdit') {
    return null;
  }
  if (typeof input.file_path === 'string') {
    return input.file_path;
  }
  if (typeof input.notebook_path === 'string') {
    return input.notebook_path;
  }
  return null;
}

/**
 * Narrow, explicit exception to isChained's blanket `;`/`&&`/`||`/`|`
 * denial (G1 defense-in-depth still applies to both halves): supports
 * exactly one idiom, `<read-only-cmd> || echo "<text>"`, the single most
 * common shape a real session wrote for "try to read this, say so if it's
 * missing" (P4 live-session finding -- `cat .senpai/state.json 2>/dev/null
 * || echo "no state.json"` and similar were denied outright every time in
 * a live run). This does not reopen general command chaining: the full
 * command must already have passed hasUnresolvableSyntax (called before
 * this in checkBashCommand), so no command-substitution/backtick/unquoted
 * expansion survives anywhere in the string; the split must yield exactly
 * one `||` (more than one is rejected outright, e.g. `a || b || c`);
 * neither side may itself be chained; the left side must independently
 * pass isReadOnlyAllowlisted or isKnownSafeScriptInvocation on its own
 * characters; and the right side must be a bare `echo` of
 * SAFE_ALLOWLIST_CHARS text with no redirection -- which can never itself
 * execute anything, only print.
 *
 * Calls hasUnresolvableSyntax itself (like isKnownSafeScriptInvocation
 * does, for the same reason -- security review follow-up): checkBashCommand
 * already runs it on the full command before this function is ever
 * reached, making the call redundant today, but this is a standalone G1
 * allowlist gate and must not depend on staying reachable only via that
 * exact call order.
 * @param {string} command
 * @returns {boolean}
 */
function isSafeFallbackChain(command) {
  const trimmed = command.trim();
  if (hasUnresolvableSyntax(trimmed)) {
    return false;
  }
  const segments = trimmed.split('||');
  if (segments.length !== 2) {
    return false;
  }
  const [left, right] = segments.map((segment) => segment.trim());
  if (isChained(left) || isChained(right)) {
    return false;
  }
  const leftOk = isReadOnlyAllowlisted(left) || isKnownSafeScriptInvocation(left);
  const rightOk = /^echo(\s|$)/.test(right) && SAFE_ALLOWLIST_CHARS.test(right) && !hasRedirection(right);
  return leftOk && rightOk;
}

// ---------------------------------------------------------------------------
// Bash policy (G1).
// ---------------------------------------------------------------------------

/**
 * @param {string} command
 * @param {object} state
 * @param {string} repoRoot
 * @returns {{decision: 'allow'|'deny', reason: string}}
 */
function checkBashCommand(command, state, repoRoot) {
  // Same predicate the secret backstop uses (findSecretPath below, and
  // event-log.js's commandMentionsSecretPath) -- see shell-tokenize.js's
  // module doc for why the gate and the log must share one check instead
  // of drifting into two nets of different strength (round-5 finding).
  if (hasUnresolvableSyntax(command)) {
    return {
      decision: 'deny',
      reason: 'unrecognized/unparseable command (shell metacharacters), fail-closed per G1'
    };
  }

  if (isReadOnlyAllowlisted(command)) {
    return { decision: 'allow', reason: 'read-only allowlisted command' };
  }

  if (isKnownSafeScriptInvocation(command)) {
    return { decision: 'allow', reason: 'known-safe audited script invocation' };
  }

  if (isSafeFallbackChain(command)) {
    return { decision: 'allow', reason: 'safe read-only fallback chain (<cmd> || echo ...)' };
  }

  const kind = classifyMutating(command);
  if (kind === null) {
    // Security review finding (P4.5, HIGH): an earlier version of this
    // branch auto-routed any command exactly matching state.verification_targets
    // to 'ask'. That verification_targets list was only filtered by a
    // JS-toolchain-prefix regex (npm/npx/node/yarn/pnpm), which is
    // Turing-complete -- `node -e "require('fs').unlinkSync(...)"` or
    // `node -e "require('child_process').execSync('curl ...')"` both pass
    // that filter and are classified null here, so they would have reached
    // the auto-'ask' path and defeated both the allowed_files scope AND the
    // unconditional rm-outside-tmp denial above, while looking like an
    // innocuous test run in the native prompt -- exactly the class of
    // opaque command this product's non-developer audience cannot evaluate.
    // No prefix/pattern filter can safely bound a Turing-complete runner, so
    // verification commands are never auto-routed through this gate at all:
    // the trusted approval-capture module still records them in
    // state.verification_targets purely as a record of what the user
    // approved seeing, and skills/evidence-loop's job is to ask the human to
    // run them in their own terminal and report the result back -- not to
    // execute them itself.
    return { decision: 'deny', reason: 'unrecognized/unparseable command, fail-closed per G1' };
  }

  const tokens = tokenizeCommand(command);
  const targets = extractMutatingTargets(tokens, kind);

  // Control-plane self-protection (see the section doc above
  // isControlPlaneCandidate) -- checked here, on the targets a mutating
  // Bash command actually extracted, not on every Bash call regardless of
  // command content (that would also catch harmless reads like
  // `cat .senpai/state.json`, which never reach this far since the
  // read-only allowlist above already allows them).
  const controlPlaneTarget = (targets || []).find(isControlPlaneCandidate);
  if (controlPlaneTarget) {
    return {
      decision: 'deny',
      reason: `control-plane path detected (${controlPlaneTarget}), never auto-approved regardless of scope`
    };
  }

  // Any `rm` outside a safe tmp scope is unconditionally denied -- not just
  // ones with -r/-f flags (an earlier version gated this branch on those
  // flags, which under-covered plain `rm somefile`). The PRD/policy wording
  // ("rm ... 안전 tmp 범위 밖은 scope 일치 여부와 무관하게 항상 deny") and
  // this product's absolute stance on data-loss prevention
  // (docs/00_CONCEPT.md, 04_AGENT_SPEC.md "절대 줄이면 안 되는 것") don't
  // carve out an exception for a plain `rm somefile` -- deleting one wrong
  // file is still data loss.
  if (kind === 'rm') {
    const rmTargets = targets || [];
    const allUnderTmp =
      rmTargets.length > 0 &&
      rmTargets.every((rawTarget) => isUnderTmpdir(normalizeTargetPath(rawTarget, repoRoot)));
    if (!allUnderTmp) {
      return {
        decision: 'deny',
        reason: 'destructive delete, never auto-approved regardless of scope'
      };
    }
    // Falls through: a tmp-scoped delete is still subject to the normal
    // allowed_files/approved_scope check below.
  }

  if (!targets) {
    return { decision: 'deny', reason: 'unrecognized/unparseable command, fail-closed per G1' };
  }

  return checkPathsAgainstScope(targets, state, repoRoot);
}

// ---------------------------------------------------------------------------
// Public API.
// ---------------------------------------------------------------------------

/**
 * @param {{tool_name: string, tool_input: object}} callInfo
 * @param {object} state result of scripts/state-store.js#readState() (or
 *   its "no valid state" sentinel -- handled gracefully throughout).
 * @returns {{decision: 'allow'|'deny', reason: string}}
 */
function checkToolCall(callInfo, state) {
  try {
    const { tool_name: toolName, tool_input: toolInput } = callInfo || {};
    const input = toolInput || {};
    const repoRoot = process.cwd();

    // NOTE: the G0 opt-in check (isSenpaiManagedProject, below) does NOT
    // live in this function. Security review finding (2026-07, CRITICAL,
    // now fixed): an earlier version of this function returned
    // {decision:'allow'} here for unmanaged projects, but 'allow' in Claude
    // Code's PreToolUse protocol is an ACTIVE AUTO-APPROVAL that suppresses
    // the native permission prompt (confirmed by this repo's own P0 finding,
    // docs/P0_HOOK_VERIFICATION.md: a hook decision overrides even
    // acceptEdits) -- NOT a passive "no opinion, behave as if uninstalled."
    // That made every unmanaged project auto-execute Write/Edit/Bash with
    // zero user-visible friction, which is strictly worse than not having
    // the harness installed at all. checkToolCall must never hand out
    // 'allow' for a mutating tool it hasn't actually evaluated (this was
    // already the rule for approved mutations -- see the 'ask, never
    // auto-allow' comment below -- G0 just violated it for a different
    // reason). The correct "stay out of the way" behavior is passthrough
    // (emit no hookSpecificOutput at all, `{}`), which only the hook-layer
    // caller (approval-gate.js#handlePreToolUse) can express -- this
    // function's contract is `{decision, reason}` and has no passthrough
    // value to return. See approval-gate.js for the actual G0 gate.

    // 1. Secret check first, always -- except a Write/Edit/NotebookEdit/
    // MultiEdit target that resolves under vault/ uses the narrower
    // isHardSecretPath instead of the substring-inclusive isSecretPath
    // (advisor review finding, P4 follow-up): a vault note titled e.g.
    // "Login Secret Handling.md" is ordinary free-form prose, not a
    // credential file, and the substring rule was denying it outright,
    // silently disabling the Obsidian Brain axis on plausible input. A
    // REAL secret file living under vault/ (`.env`, `id_rsa`, `*.pem`) is
    // still caught either way -- isHardSecretPath keeps every "hard shape"
    // check, only the free-text substring rule is skipped. Anything not a
    // vault-targeted mutation of those four tools (Bash included) keeps
    // the full, unchanged isSecretPath check via findSecretPath.
    const mutatingFileTarget = getMutatingFileTarget(toolName, input);
    const isVaultMutation =
      mutatingFileTarget != null && isUnderVaultDir(normalizeTargetPath(mutatingFileTarget, repoRoot), repoRoot);

    const secretHit = isVaultMutation
      ? (isHardSecretPath(mutatingFileTarget) ? mutatingFileTarget : null)
      : findSecretPath(toolName, input);

    if (secretHit === UNRESOLVABLE_SYNTAX_SENTINEL) {
      return { decision: 'deny', reason: 'unrecognized/unparseable command, fail-closed per G1' };
    }
    if (secretHit) {
      return {
        decision: 'deny',
        reason: `secret path detected (${secretHit}), never auto-approved regardless of scope`
      };
    }

    // 2. Non-mutating tools pass through.
    if (!MUTATING_TOOL_NAMES.has(toolName)) {
      return { decision: 'allow', reason: 'non-mutating tool' };
    }

    // 2b. Control-plane self-protection -- see the section doc above
    // findControlPlanePath. Runs before the vault exemption / scope check
    // below, so a Phase Plan can never smuggle these paths into
    // allowed_files and have them approved via the normal ask flow.
    const controlPlaneHit = findControlPlanePath(toolName, input);
    if (controlPlaneHit) {
      return {
        decision: 'deny',
        reason: `control-plane path detected (${controlPlaneHit}), never auto-approved regardless of scope`
      };
    }

    // 4. Write/Edit/NotebookEdit/MultiEdit policy (G1+G3). NotebookEdit
    // carries its target in `notebook_path`, not `file_path` -- everything
    // else about the gate is identical regardless of which of the four
    // tool names triggered it.
    if (toolName === 'Write' || toolName === 'Edit' || toolName === 'NotebookEdit' || toolName === 'MultiEdit') {
      const targetPath = typeof input.file_path === 'string' ? input.file_path : input.notebook_path;
      if (typeof targetPath !== 'string' || targetPath.length === 0) {
        return { decision: 'deny', reason: 'unrecognized/unparseable tool_input, fail-closed per G1' };
      }

      // Vault documents are the Obsidian Brain axis, meant to be written
      // freely during meetings/planning, independent of product-code
      // build approval -- see isUnderVaultDir's doc comment for why this
      // exemption exists at all. Secret check (step 1) already ran, so a
      // secret symlinked into vault/ is still denied before this is reached.
      const normalized = normalizeTargetPath(targetPath, repoRoot);
      if (isUnderVaultDir(normalized, repoRoot)) {
        // Back up whatever's currently on disk before allowing the
        // overwrite (P4 fix: the P3 vault-write exemption allowed
        // overwrites with no backup at all, since the model writes through
        // the Write/Edit tool directly and never goes through
        // vault-writer.js's own backup logic). A backup failure propagates
        // to checkToolCall's outer catch and denies, per G4 -- a vault
        // write whose safety net couldn't be created should not silently
        // proceed unprotected.
        backupIfExists(normalized);
        // Advisor review finding (P4 follow-up, CRITICAL): nothing in
        // committed code ever wrote state.pending_phase_plan_path -- the
        // approval-capture module (see hooks/scripts/handler.js's
        // UserPromptSubmit branch) only ever READ it, so approval could
        // never actually be recorded on a fresh install
        // (P3's live-session "approval works" result relied on this field
        // being seeded by hand, standing in for the missing writer). The
        // moment a Phase Plan is (re)written -- the one event that
        // legitimately means "this is the plan now awaiting approval" --
        // record its path here, in-process, at the same trust level as the
        // backup above. A writeState failure propagates to the outer catch
        // and denies (G4): a Phase Plan write whose "this is now pending"
        // marker couldn't be recorded should not silently succeed into a
        // plan nobody can ever approve.
        if (path.basename(normalized) === 'Phase Plan.md') {
          const relativePlanPath = path.relative(repoRoot, normalized);
          writeState({ pending_phase_plan_path: relativePlanPath });
        }
        return { decision: 'allow', reason: 'vault document write (Obsidian Brain axis, not gated by build approval)' };
      }

      return checkPathsAgainstScope([targetPath], state, repoRoot);
    }

    // 3. Bash policy (G1), which internally applies step 4 to any
    // extracted mutating target.
    if (typeof input.command !== 'string' || input.command.trim().length === 0) {
      return { decision: 'deny', reason: 'unrecognized/unparseable command, fail-closed per G1' };
    }
    return checkBashCommand(input.command, state, repoRoot);
  } catch (err) {
    // 5. Any code path not explicitly covered above defaults to deny.
    return { decision: 'deny', reason: `internal error, fail-closed per G4: ${err.message}` };
  }
}

module.exports = {
  checkToolCall,
  isSenpaiManagedProject,
  findAncestorManagedMarker,
  MANAGED_PROJECT_MARKER_FILENAME
};
