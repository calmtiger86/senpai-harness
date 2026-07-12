'use strict';

/**
 * The actual PreToolUse enforcement entry point (docs/SAFETY_ENFORCEMENT_POLICY.md).
 * Wires the G0 opt-in gate (isSenpaiManagedProject) + state-store (G4
 * fail-closed persistence) + scope-hash (scope-drift / session-binding
 * detection) + scope-check (G1-G3 decision logic) into the exact
 * hookSpecificOutput JSON shape Claude Code's PreToolUse hook expects
 * (confirmed empirically in docs/P0_HOOK_VERIFICATION.md). G0 lives HERE,
 * not inside scope-check.js#checkToolCall, specifically so its "not our
 * project" case can return a true passthrough (`{}`) instead of a
 * `{decision:'allow'}` value -- checkToolCall's contract only has
 * allow/deny/ask, and 'allow' is not a safe stand-in for "no opinion" (see
 * the G0 block below for the full explanation).
 */

const { readState } = require('./state-store');
const { checkToolCall, isSenpaiManagedProject } = require('./scope-check');
const { computeScopeHash } = require('./scope-hash');

/**
 * Decides whether the persisted state is still trustworthy for the CURRENT
 * session before handing it to checkToolCall. Three ways it can be
 * untrustworthy, each collapsed to the same "no valid state" sentinel shape
 * so checkToolCall's existing fail-closed logic (deny when allowed_files/
 * approved_scope aren't present) does the rest -- no separate deny path
 * needed here:
 *
 *   1. state-store already reports missing/corrupt (G4).
 *   2. `session_id` doesn't match the CURRENT hook payload's session_id --
 *      an approval from a different (e.g. prior, stale) session must never
 *      authorize a write in this one.
 *   3. `approved_scope` is true but the stored `scope_hash` no longer
 *      matches a hash recomputed from the CURRENT `allowed_files` -- this
 *      means allowed_files was edited/tampered with after approval without
 *      a fresh re-approval ("scope drift").
 *
 * @param {object} rawState result of state-store.js#readState()
 * @param {string} currentSessionId from the hook payload's `session_id`
 * @returns {object} either `rawState` unchanged (trustworthy) or the
 *   `{ valid: false, reason }` sentinel shape
 */
function resolveTrustedState(rawState, currentSessionId) {
  if (!rawState || rawState.valid === false) {
    return { valid: false, reason: rawState ? rawState.reason : 'missing' };
  }
  if (rawState.session_id !== currentSessionId) {
    return { valid: false, reason: 'session_mismatch' };
  }
  if (rawState.approved_scope === true) {
    const expectedHash = computeScopeHash(rawState.allowed_files);
    if (rawState.scope_hash !== expectedHash) {
      return { valid: false, reason: 'scope_drift' };
    }
  }
  return rawState;
}

/**
 * @param {object} input the raw PreToolUse hook stdin payload (must contain
 *   `session_id`, `tool_name`, `tool_input`)
 * @returns {object} the JSON object to print to stdout for Claude Code
 */
function handlePreToolUse(input) {
  // G0 opt-in gate (docs/SAFETY_ENFORCEMENT_POLICY.md G0, P5 live-install
  // finding). Security review finding (2026-07, CRITICAL, now fixed): this
  // used to live inside checkToolCall and return {decision:'allow'} for an
  // unmanaged project. 'allow' is Claude Code's ACTIVE AUTO-APPROVAL --
  // it suppresses the native permission prompt (this repo's own
  // docs/P0_HOOK_VERIFICATION.md confirms a hook decision overrides even
  // acceptEdits) -- not a passive "harness inactive, behave normally."
  // That meant every tool call (Write/Edit/Bash included) in an unmanaged
  // project auto-executed with zero user-visible friction: strictly worse
  // than not installing the harness at all, since baseline Claude Code
  // would have prompted. The correct "stay out of the way" behavior is a
  // true passthrough: emit no hookSpecificOutput (`{}`), the exact same
  // "no opinion" shape hooks/scripts/handler.js already uses for every
  // non-PreToolUse event. Claude Code then applies its own normal
  // permission handling -- native prompts on mutations, no interference at
  // all -- exactly as if Senpai Harness were not installed here.
  if (!isSenpaiManagedProject(process.cwd())) {
    return {};
  }

  const rawState = readState();
  const trustedState = resolveTrustedState(rawState, input && input.session_id);
  const result = checkToolCall(
    { tool_name: input && input.tool_name, tool_input: input && input.tool_input },
    trustedState
  );

  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: result.decision,
      permissionDecisionReason: result.reason
    }
  };
}

module.exports = { handlePreToolUse, resolveTrustedState };
