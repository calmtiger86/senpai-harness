'use strict';

// Appends structured events to .senpai/event_logs.jsonl (see
// docs/03_TECHNICAL_SPEC.md "데이터 로그"). One JSON object per line.

const fs = require('fs');
const path = require('path');
const { tokenizeCommand, stripQuotes, OPERATOR_TOKENS, hasUnresolvableSyntax } = require('./shell-tokenize');

// protect-secrets.js is being built in parallel by another agent. Guard the
// require so this module never crashes if it's run before that file lands --
// redaction is simply skipped until it exists.
let isSecretPath = null;
try {
  ({ isSecretPath } = require('./protect-secrets'));
} catch {
  isSecretPath = null;
}

const PATH_FIELD_NAMES = ['file_path', 'path', 'filePath', 'target'];
const REDACTABLE_FIELD_NAMES = ['content', 'value', 'data'];
// Bash's `command` field carries its own secret risk that PATH_FIELD_NAMES
// doesn't catch: the secret path lives INSIDE the string (e.g.
// `echo API_KEY=x > .env`), not in a separate field pointing at it. Found
// via architect adversarial review (docs/SAFETY_ENFORCEMENT_POLICY.md "P1
// 실증 검증") -- a denied-or-not, secret-bearing Bash command was being
// logged verbatim before this fix.
const COMMAND_FIELD_NAMES = ['command'];

function getSenpaiDir() {
  // Override for isolated tests; defaults to .senpai/ under the current
  // working directory, matching scripts/state-store.js's getStatePaths()
  // convention (hooks/CLI scripts run with cwd = the installed project root).
  return process.env.SENPAI_EVENT_LOG_DIR || path.join(process.cwd(), '.senpai');
}

/**
 * @param {string} command
 * @returns {boolean} true if any operator-aware token (quotes stripped)
 *   looks like a secret path. Must use the SAME tokenizer as
 *   scope-check.js's findSecretPath -- a naive whitespace-only split was
 *   tried here first and left a real gap: operator-glued redirects like
 *   `echo x>>.env` or `printf ... 2>.env` produce a single token
 *   (`x>>.env`) that isn't recognized as touching `.env`, so the command
 *   was denied by scope-check.js but still logged verbatim (found via
 *   architect adversarial re-review, docs/SAFETY_ENFORCEMENT_POLICY.md "P1
 *   실증 검증"). This is a defensive logging check, not the security gate
 *   itself; false positives just redact a log line, which is harmless.
 */
function commandMentionsSecretPath(command) {
  if (typeof isSecretPath !== 'function' || typeof command !== 'string') {
    return false;
  }
  // Round 3: a command with backslash escapes or nested/unbalanced quotes
  // can't be cleanly tokenized -- treat "can't tell" as "assume secret" so
  // logging fails closed instead of silently trusting unparseable input
  // (see shell-tokenize.js#hasUnresolvableSyntax for the full rationale).
  if (hasUnresolvableSyntax(command)) {
    return true;
  }
  const tokens = tokenizeCommand(command)
    .filter((token) => !OPERATOR_TOKENS.has(token))
    .map(stripQuotes);
  return tokens.some((token) => token && isSecretPath(token));
}

function redactIfSecretPath(event) {
  if (typeof isSecretPath !== 'function') {
    return event;
  }

  const touchesSecretPath = PATH_FIELD_NAMES.some((field) => {
    const candidate = event[field];
    return typeof candidate === 'string' && isSecretPath(candidate);
  });

  const commandMentionsSecret = COMMAND_FIELD_NAMES.some((field) =>
    commandMentionsSecretPath(event[field])
  );

  if (!touchesSecretPath && !commandMentionsSecret) {
    return event;
  }

  const redacted = { ...event };
  if (touchesSecretPath) {
    for (const field of REDACTABLE_FIELD_NAMES) {
      if (Object.prototype.hasOwnProperty.call(redacted, field)) {
        redacted[field] = '[REDACTED]';
      }
    }
  }
  if (commandMentionsSecret) {
    for (const field of COMMAND_FIELD_NAMES) {
      if (Object.prototype.hasOwnProperty.call(redacted, field)) {
        redacted[field] = '[REDACTED: command referenced a secret path]';
      }
    }
  }
  return redacted;
}

function appendEvent(event) {
  const withTimestamp = Object.prototype.hasOwnProperty.call(event, 'logged_at')
    ? { ...event }
    : { ...event, logged_at: new Date().toISOString() };

  const redacted = redactIfSecretPath(withTimestamp);

  const senpaiDir = getSenpaiDir();
  fs.mkdirSync(senpaiDir, { recursive: true });
  const logPath = path.join(senpaiDir, 'event_logs.jsonl');
  fs.appendFileSync(logPath, JSON.stringify(redacted) + '\n');
}

module.exports = { appendEvent };
