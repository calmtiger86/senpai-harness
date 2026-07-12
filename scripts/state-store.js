'use strict';

// scripts/state-store.js
//
// External source of truth for approval state (see docs/SAFETY_ENFORCEMENT_POLICY.md, G4).
// The model's own claims about "approved"/"done" are not trustworthy (P0 finding);
// gating decisions must be derived from `.senpai/state.json` on disk instead.
//
// This module must NEVER throw on read: a missing or corrupt state.json must fail
// closed (safe sentinel), not crash whatever hook/script called it.

const fs = require('fs');
const path = require('path');

const STATE_DIR_NAME = '.senpai';
const STATE_FILE_NAME = 'state.json';
const TMP_FILE_NAME = 'state.json.tmp';

// Full field set the state object supports (docs/03_TECHNICAL_SPEC.md).
const STATE_FIELDS = [
  'session_id',
  'scope_hash',
  'approved_at',
  // intent/meeting/understanding_state/unresolved_decisions/evidence_status
  // (below) have no writer anywhere -- per-field rationale in
  // data-schema/state.schema.json. Safe: scope-check.js never reads them.
  'intent',
  'meeting',
  'understanding_state',
  'unresolved_decisions',
  'approved_scope',
  'allowed_files',
  // Files touching a require_approval_for category (auth/payment/deploy/db/
  // dependency-install/destructive) -- the Phase Plan's own flags PLUS
  // scope-check.js's hardcoded escalate-only pattern floor
  // (matchesSensitiveFloor). Written by scripts/senpai-approve.js#recordApproval
  // from the Phase Plan's sensitive_files frontmatter (docs/SAFETY_ENFORCEMENT_POLICY.md
  // T2). scope-check.js denies a write to one of these until it's also in
  // confirmed_sensitive_files (below), instead of batch-auto-proceeding
  // (`allow`) with the rest of allowed_files (T1) -- see checkPathsAgainstScope.
  'sensitive_files',
  // Independent review finding (2026-07, HIGH/MAJOR/CONFIRMED): T2 used to
  // return `ask`, the exact signal just proven unreliable under
  // `permissions.defaultMode: acceptEdits`. Fixed by moving T2 enforcement
  // off `ask` entirely -- a sensitive write denies until the user sends
  // `[senpai-touch:<project>:<file>]` (UserPromptSubmit-based, immune to
  // permission mode like [senpai-go:...]). Written by
  // scripts/senpai-approve.js#recordSensitiveFileConfirmation, one file at a
  // time; reset to [] by every fresh recordApproval(). Never grants scope on
  // its own -- checkPathsAgainstScope only consults it for a target already
  // independently confirmed to be in both allowed_files and sensitive_files.
  'confirmed_sensitive_files',
  // Build/test command strings the approved Phase Plan declared for
  // verification (C2 fix, Fable 5 stub-audit follow-up). Written by
  // scripts/senpai-approve.js#recordApproval alongside allowed_files, from
  // the Phase Plan's verification_commands frontmatter. NEVER auto-executed:
  // a security review (P4.5) found that a prefix filter cannot safely bound
  // a Turing-complete runner (npm/node/etc. can run arbitrary code), so
  // scope-check.js grants no Bash access based on this field -- it exists
  // purely so evidence-loop can ask the human to run these commands in
  // their own terminal and report the result back. Empty array is normal
  // (a Phase Plan may declare nothing to suggest).
  'verification_targets',
  'evidence_status',
  // Path (repo-root-relative) to the Phase Plan awaiting the user's
  // [senpai-go:<project>] confirmation, read by scripts/senpai-approve.js to
  // find the allowed_files list it derives approval from. Written
  // in-process by scripts/scope-check.js's checkToolCall, as a side effect
  // of allowing a vault Write/Edit to a file named "Phase Plan.md" -- NOT
  // by guided-plan itself (advisor review finding, P4 follow-up: an
  // earlier version of this comment claimed guided-plan wrote this field,
  // but no code ever did; a model has no reachable way to write to
  // .senpai/state.json directly, since that path isn't vault-exempted and
  // approval can't yet exist to grant it -- P3's live-session "approval
  // works" result relied on this field being seeded by hand in place of
  // the missing writer). See scripts/senpai-approve.js's module doc for
  // why this indirection exists.
  'pending_phase_plan_path'
];

/**
 * Resolves the `.senpai/` directory and state.json paths relative to the
 * repo root. The repo root is assumed to be the current working directory,
 * which is how Claude Code hooks and CLI scripts are invoked.
 * @returns {{ dir: string, file: string, tmp: string }}
 */
function getStatePaths() {
  const dir = path.join(process.cwd(), STATE_DIR_NAME);
  return {
    dir,
    file: path.join(dir, STATE_FILE_NAME),
    tmp: path.join(dir, TMP_FILE_NAME)
  };
}

/**
 * Reads `.senpai/state.json`. Never throws: a missing file or invalid JSON
 * yields a safe "no valid state" sentinel so callers can fail closed (G4).
 * @returns {object} the parsed state, or `{ valid: false, reason: 'missing' | 'corrupt' }`
 */
function readState() {
  const { file } = getStatePaths();

  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (err) {
    return { valid: false, reason: 'missing' };
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { valid: false, reason: 'corrupt' };
    }
    return parsed;
  } catch (err) {
    return { valid: false, reason: 'corrupt' };
  }
}

/**
 * Merges `patch` into the current state and writes it back atomically:
 * write to a temp file in `.senpai/`, then `fs.renameSync` it over
 * state.json (atomic on POSIX filesystems).
 * @param {object} patch fields to merge into the current state
 * @returns {object} the merged state that was written
 */
function writeState(patch) {
  const { dir, file, tmp } = getStatePaths();
  fs.mkdirSync(dir, { recursive: true });

  const current = readState();
  const base = current.valid === false ? {} : current;
  const merged = { ...base, ...(patch || {}) };

  fs.writeFileSync(tmp, JSON.stringify(merged, null, 2), 'utf8');
  fs.renameSync(tmp, file);

  return merged;
}

/**
 * Returns true only if the state is bound to the current session AND the
 * current scope hash AND was explicitly approved. Handles the readState()
 * sentinel (and any other malformed input) gracefully by returning false.
 * @param {object} state result of readState()
 * @param {string} currentSessionId
 * @param {string} currentScopeHash
 * @returns {boolean}
 */
function isApprovalValid(state, currentSessionId, currentScopeHash) {
  if (!state || typeof state !== 'object' || state.valid === false) {
    return false;
  }
  return (
    state.session_id === currentSessionId &&
    state.scope_hash === currentScopeHash &&
    state.approved_scope === true
  );
}

module.exports = {
  STATE_FIELDS,
  readState,
  writeState,
  isApprovalValid
};

// CLI entry point (P3 finding, same rationale as scripts/classify-intent.js
// and scripts/select-meeting.js): skills constantly need to check current
// state ("2단계 -- 현재 상태 힌트 읽기" in meeting-system's own flow), but
// arbitrary `node -e "require(...)..."` is -- and must stay -- outside the
// Bash read-only allowlist (docs/SAFETY_ENFORCEMENT_POLICY.md G1).
//
// Deliberately READ-ONLY: this entry point calls readState() and nothing
// else, ignoring any argv entirely, so there is no argument shape that
// reaches writeState() through this CLI form. writeState() (in particular
// the approved_scope/allowed_files fields) must only ever be set by
// scripts/senpai-approve.js's recordApproval(), called in-process from
// hooks/scripts/handler.js's UserPromptSubmit branch -- never given a CLI
// entrypoint, never added to scope-check.js's KNOWN_SAFE_SCRIPT_NAMES.
if (require.main === module) {
  process.stdout.write(JSON.stringify(readState()) + '\n');
}
