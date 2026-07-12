'use strict';

/**
 * Meeting Selector (docs/04_AGENT_SPEC.md "2. Meeting Selector")
 *
 * Deterministic, rule-based mapping from a detected user intent
 * (see scripts/classify-intent.js for the intent labels) to one of the
 * 7 meeting modes defined in docs/02_PRODUCT_SPEC.md "회의 모드":
 *   orientation_meeting, discovery_meeting, design_meeting, scope_meeting,
 *   build_readiness_meeting, review_meeting, checkout_meeting
 *
 * stateHints shape (all fields optional, keep it simple):
 *   {
 *     buildApproved: boolean,
 *         // true when the user has approved moving from planning into
 *         // implementation (see docs/02_PRODUCT_SPEC.md "before_build").
 *         // When true, and the intent is not finish_session/verify,
 *         // the request is "about to implement" -> build_readiness_meeting
 *         // per docs/09_ACCEPTANCE_CRITERIA.md 5. "구현 직전에는 Build
 *         // Readiness Meeting으로 간다."
 *     hasUnresolvedDecisions: boolean,
 *         // true when Unknown Detector still has open hidden_decisions.
 *         // Used only for add_feature: if decisions are already resolved
 *         // (hasUnresolvedDecisions === false) we can skip straight to
 *         // narrowing scope instead of re-running Discovery.
 *   }
 *
 * Design decisions (see docs/09_ACCEPTANCE_CRITERIA.md section 5, which
 * only fixes 5 of the 7 mappings -- "새 프로젝트 -> Orientation/Discovery",
 * "새 기능 -> Discovery/Scope", "구현 직전 -> Build Readiness",
 * "완료 요청 -> Review", "종료 요청 -> Checkout". design_meeting is not
 * required by acceptance criteria for any single intent and is left
 * unreachable from this selector -- it is expected to be entered
 * explicitly (e.g. from inside a Discovery/Scope meeting) rather than
 * chosen by intent alone):
 *
 * - start_project -> orientation_meeting (default).
 *   Rationale: with no prior context, orientation (place a first-timer)
 *   comes before discovery (dig up hidden decisions). Acceptance allows
 *   either orientation_meeting or discovery_meeting for start_project.
 *
 * - add_feature -> discovery_meeting (default), scope_meeting only when
 *   stateHints.hasUnresolvedDecisions === false (decisions already
 *   settled, so we only need to negotiate what's in/out of scope).
 *   Acceptance allows either discovery_meeting or scope_meeting.
 *
 * - buildApproved === true short-circuits to build_readiness_meeting for
 *   any intent that isn't finish_session or verify (those have their own
 *   fixed meetings and represent "done", not "about to build").
 *
 * - verify -> review_meeting (fixed by acceptance criteria).
 * - finish_session -> checkout_meeting (fixed by acceptance criteria).
 *
 * - debug -> null. Acceptance criteria section 5 lists no meeting
 *   requirement for debug; debugging is a diagnostic flow (reproduce,
 *   trace, fix), not a facilitation "meeting". Forcing it into one of
 *   the 7 meetings would misrepresent what actually happens. Callers
 *   should treat null as "route to the debug flow instead."
 *
 * - continue_work -> null by default. Resuming prior work has no fixed
 *   meeting in the acceptance doc; the harness should just resume where
 *   the user left off. If state indicates a build was already approved
 *   (stateHints.buildApproved === true), the buildApproved short-circuit
 *   above still applies and returns build_readiness_meeting.
 *
 * - explain_nondev -> null. Explaining a concept to a non-developer is
 *   an inline explanation, not a meeting; no acceptance criterion maps
 *   it to one of the 7 modes.
 *
 * - brainstorm -> design_meeting (2026-07 addition). design_meeting was
 *   previously "unreachable from this selector... expected to be entered
 *   explicitly ... rather than chosen by intent alone" -- classify-intent.js's
 *   new `brainstorm` label IS that explicit entry point a user can reach
 *   for directly ("나도 뭘 원하는지 모르겠어"), distinct from add_feature/
 *   start_project's default discovery/orientation routing. Exempted from
 *   the buildApproved short-circuit below (unlike every other intent except
 *   finish_session/verify) -- a user who suddenly doesn't know what they
 *   want needs to pause and think, not be pushed into "구현 직전" build
 *   readiness just because a build was already approved earlier.
 *
 * - unknown -> null. No documented mapping; caller decides fallback
 *   behavior (e.g. ask a clarifying question).
 *
 * @param {string} intent - one of the classify-intent.js labels:
 *   continue_work, start_project, add_feature, debug, verify,
 *   finish_session, explain_nondev, brainstorm, unknown
 * @param {{buildApproved?: boolean, hasUnresolvedDecisions?: boolean}} [stateHints]
 * @returns {string|null} one of the 7 meeting mode strings, or null when
 *   no meeting is required for this intent.
 */
function selectMeeting(intent, stateHints) {
  const hints = stateHints || {};

  // "구현 직전" (about to implement) takes priority over the intent's
  // default meeting, for every intent except the three that represent
  // wrapping up or pausing to think rather than starting work.
  if (
    hints.buildApproved === true &&
    intent !== 'finish_session' &&
    intent !== 'verify' &&
    intent !== 'brainstorm'
  ) {
    return 'build_readiness_meeting';
  }

  switch (intent) {
    case 'start_project':
      return 'orientation_meeting';

    case 'add_feature':
      return hints.hasUnresolvedDecisions === false
        ? 'scope_meeting'
        : 'discovery_meeting';

    case 'verify':
      return 'review_meeting';

    case 'finish_session':
      return 'checkout_meeting';

    case 'brainstorm':
      return 'design_meeting';

    case 'debug':
    case 'continue_work':
    case 'explain_nondev':
    case 'unknown':
    default:
      return null;
  }
}

module.exports = { selectMeeting };

// CLI entry point (P3 finding, same rationale as scripts/classify-intent.js):
// `node scripts/select-meeting.js <intent> [stateHintsJson]` is a specific,
// auditable, side-effect-free command scope-check.js can safely allowlist.
// Prints the selected meeting mode (or the literal string "null") to stdout.
if (require.main === module) {
  const intent = process.argv[2] || '';
  let hints;
  try {
    hints = process.argv[3] ? JSON.parse(process.argv[3]) : undefined;
  } catch {
    hints = undefined;
  }
  process.stdout.write(String(selectMeeting(intent, hints)) + '\n');
}
