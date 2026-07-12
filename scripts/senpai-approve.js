'use strict';

/**
 * Trusted approval capture (docs/SAFETY_ENFORCEMENT_POLICY.md G2).
 *
 * This is the ONLY code path allowed to flip `.senpai/state.json`'s
 * `approved_scope`/`allowed_files` fields. Every P2 skill doc that touches
 * Build Readiness (guided-plan, decision-card, meeting-system) already
 * says out loud that it deliberately does NOT write these fields itself,
 * naming "the approval flow" as whoever's job that is -- this module is
 * that missing piece.
 *
 * Why this can't just be a script the model calls via Bash: if the model
 * could set approved_scope=true / allowed_files at will, it could grant
 * itself review-queue access to files far beyond what a Decision Card
 * conversation actually covered, and a non-developer user (this product's
 * whole audience) is exactly the kind of user least likely to notice a
 * native permission-prompt mismatch. So this module is deliberately NEVER
 * added to scripts/scope-check.js's KNOWN_SAFE_SCRIPT_NAMES and never
 * given a Bash CLI entrypoint -- it is only ever called in-process, from
 * hooks/scripts/handler.js's UserPromptSubmit branch, which only runs when
 * Claude Code delivers a genuine user-submitted chat message. The model
 * cannot forge a UserPromptSubmit event via a tool call (confirmed via
 * claude-code-guide: slash/text parsing on `input.prompt` only ever
 * happens on real human input, never on model output), so matching on the
 * `[senpai-go:<project>]` trigger pattern here is a human-triggered,
 * model-unforgeable approval signal -- not prose inference (which G2
 * explicitly rejects).
 *
 * `allowed_files` is derived from the Phase Plan vault doc's own YAML
 * frontmatter (a plan the human already saw rendered in conversation)
 * rather than from anything in the trigger message itself, so approving
 * can't silently widen scope beyond what was actually shown to the user.
 */

const fs = require('fs');
const path = require('path');
const { readState, writeState } = require('./state-store');
const { computeScopeHash } = require('./scope-hash');
const { tokenizeCommand } = require('./shell-tokenize');

// Per-project trigger phrase (2026-07 redesign, replaces the fixed
// [SENPAI-APPROVE] string): `[senpai-go:<project>]`, where `<project>` is
// the exact vault/10_Projects/<project>/ folder name the pending Phase Plan
// already lives under. User-requested change after a live smoke test: a
// single global phrase invites typing it from muscle memory without
// actually re-reading which project it applies to; embedding the project
// name forces a moment of re-recognition, while still keeping the bracketed
// delimiter that makes this signal unmistakable from ordinary chat prose
// ("네", "좋아요") -- the reason G2 never accepted prose in the first place.
const TRIGGER_PATTERN = /^\[senpai-go(?::([^\]]+))?\]$/i;

// T2 individual re-confirmation phrase (2026-07, security-review-driven
// fix): `[senpai-touch:<project>:<file>]`. Unlike the old design (which
// relied on permissionDecision:"ask" for sensitive files), this goes
// through the SAME UserPromptSubmit capture path as [senpai-go:...] --
// proven immune to permission-mode (acceptEdits can't touch it, since it
// never routes through permissionDecision at all). scope-check.js's T2
// branch denies a sensitive write and names this exact phrase in its
// reason; recordSensitiveFileConfirmation() below is the only thing that
// can add an entry to state.confirmed_sensitive_files.
const TOUCH_TRIGGER_PATTERN = /^\[senpai-touch:([^:\]]+):([^\]]+)\]$/i;

/**
 * Extracts the vault/10_Projects/<project>/ segment from a Phase Plan path.
 * @param {string} planPath repo-root-relative or absolute path
 * @returns {string|null}
 */
function extractProjectFromPlanPath(planPath) {
  if (typeof planPath !== 'string') {
    return null;
  }
  const match = planPath.match(/10_Projects[\\/]([^\\/]+)[\\/]/);
  return match ? match[1] : null;
}

/**
 * @param {string|null} project
 * @returns {string} the exact phrase the user should type right now
 */
function buildTriggerPhrase(project) {
  return project ? `[senpai-go:${project}]` : '[senpai-go]';
}

/**
 * Critic review finding (2026-07, MINOR): TRIGGER_PATTERN matches the
 * `senpai-go`/`senpai-touch` keyword case-insensitively, but comparing the
 * typed project name case-sensitively meant `[senpai-go:My-App]` was
 * rejected against a `my-app` folder purely on capitalization, with no
 * security benefit (this check exists to catch wrong/stale project names,
 * not to enforce filesystem case rules). Compare case-insensitively too.
 * @param {string|null} typed
 * @param {string|null} expected
 * @returns {boolean}
 */
function projectNamesMatch(typed, expected) {
  return typeof typed === 'string' && typeof expected === 'string' && typed.toLowerCase() === expected.toLowerCase();
}

/**
 * @param {string|null} project
 * @param {string} file repo-root-relative path, as it appears in
 *   sensitive_files/allowed_files
 * @returns {string} the exact phrase the user should type to individually
 *   re-confirm writing this one sensitive file (T2)
 */
function buildTouchPhrase(project, file) {
  return `[senpai-touch:${project || '?'}:${file}]`;
}

// Security review finding (P4.5, HIGH): an earlier version of this comment
// claimed this prefix filter "closes off" arbitrary-system-command harm
// (curl exfiltration, rm, arbitrary code execution). That claim was FALSE --
// npm/npx/node/yarn/pnpm are all Turing-complete runners, so
// `node -e "require('fs').unlinkSync(...)"` or
// `node -e "require('child_process').execSync('curl ...')"` both pass this
// filter and would have defeated the allowed_files scope AND the
// unconditional rm-outside-tmp denial in scope-check.js. A first-token
// prefix regex cannot safely bound a Turing-complete runner -- there is no
// version of this filter that would have made it safe to auto-execute a
// matching command via Bash, so scope-check.js no longer does that at all
// (see its checkBashCommand's kind===null branch). This filter now exists
// only to keep obviously-wrong entries (a stray `curl ...` a model
// mistakenly writes under `verification_commands:`) out of the list
// evidence-loop shows the user as suggested manual verification steps --
// it is a display sanity check, NOT a security boundary. The actual
// security boundary is that these commands are never given to Bash by this
// harness at all; the human runs them in their own terminal if they choose to.
const VERIFICATION_COMMAND_PREFIX = /^(npm|npx|node|yarn|pnpm)\s+\S/;

// The prefix check above alone still lets `node -e "<payload>"` through,
// since it legitimately starts with `node `. Still just a display filter,
// not a security boundary (docs/P4_5_SECURITY_FIX_AND_STUB_AUDIT.md N1) --
// tokenized (not substring) so a real script path like `node -exec-tests.js`
// doesn't false-positive.
const EVAL_STYLE_FLAGS = new Set(['-e', '--eval', '-p', '--print', '-pe']);

/**
 * Syntactic-only check: does this look like an attempted approval token at
 * all (`[senpai-go]` or `[senpai-go:anything]`)? Deliberately permissive on
 * the bracket contents -- this only decides whether handler.js enters the
 * approval-capture branch (to give the user SOME feedback, success or a
 * precise correction), never whether approval is actually granted. No
 * fuzzy/prose matching either way, so a casual "괜찮아 보여요, 승인!" message
 * never even reaches this branch.
 * @param {string} prompt raw UserPromptSubmit `input.prompt`
 * @returns {boolean}
 */
function looksLikeApprovalAttempt(prompt) {
  return typeof prompt === 'string' && TRIGGER_PATTERN.test(prompt.trim());
}

/**
 * Syntactic-only check for the T2 individual-file re-confirmation phrase
 * (`[senpai-touch:<project>:<file>]`) -- mirrors looksLikeApprovalAttempt.
 * @param {string} prompt raw UserPromptSubmit `input.prompt`
 * @returns {boolean}
 */
function looksLikeTouchAttempt(prompt) {
  return typeof prompt === 'string' && TOUCH_TRIGGER_PATTERN.test(prompt.trim());
}

/**
 * @param {string} prompt raw UserPromptSubmit `input.prompt`
 * @returns {{project: string, file: string}|null}
 */
function extractTouchProjectAndFile(prompt) {
  const match = typeof prompt === 'string' ? prompt.trim().match(TOUCH_TRIGGER_PATTERN) : null;
  return match ? { project: match[1].trim(), file: match[2].trim() } : null;
}

/**
 * @param {string} prompt raw UserPromptSubmit `input.prompt`
 * @returns {string|null} the `<project>` the user typed after the colon, or
 *   null if they sent the bare `[senpai-go]` form (or the prompt doesn't
 *   match the trigger pattern at all).
 */
function extractTypedProject(prompt) {
  const match = typeof prompt === 'string' ? prompt.trim().match(TRIGGER_PATTERN) : null;
  return match && match[1] ? match[1].trim() : null;
}

/**
 * Minimal, narrow YAML-frontmatter list reader -- deliberately NOT a
 * general YAML parser (no new dependency, and this only ever needs to
 * understand the one shape vault-template/10_Projects/_template/Phase Plan.md
 * produces): a top-level `<key>:` entry inside a `---`-delimited frontmatter
 * block, followed by `  - <item>` list items. Any other shape (missing
 * frontmatter, missing key, malformed list) yields an empty array so
 * callers fail closed instead of guessing.
 * @param {string} content raw Phase Plan.md file content
 * @param {string} key frontmatter key to read (e.g. "allowed_files")
 * @returns {string[]}
 */
function extractFrontmatterList(content, key) {
  if (typeof content !== 'string') {
    return [];
  }
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return [];
  }
  const keyMatch = frontmatterMatch[1].match(new RegExp(`^${key}:[ \\t]*\\n((?:[ \\t]*-.*\\n?)*)`, 'm'));
  if (!keyMatch) {
    return [];
  }
  return keyMatch[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('-'))
    .map((line) => line.slice(1).trim())
    .filter((line) => line.length > 0);
}

/**
 * @param {string} content raw Phase Plan.md file content
 * @returns {string[]}
 */
function extractAllowedFilesFromPhasePlan(content) {
  return extractFrontmatterList(content, 'allowed_files');
}

/**
 * Same frontmatter shape as allowed_files, but each entry is additionally
 * required to start with a JS toolchain runner (see
 * VERIFICATION_COMMAND_PREFIX's doc comment above for why) -- an entry that
 * doesn't match is silently dropped, not merely deprioritized, so a Phase
 * Plan can never smuggle an arbitrary system command into
 * `state.verification_targets` just by listing it in frontmatter.
 * @param {string} content raw Phase Plan.md file content
 * @returns {string[]}
 */
function extractVerificationCommandsFromPhasePlan(content) {
  return extractFrontmatterList(content, 'verification_commands')
    .filter((cmd) => VERIFICATION_COMMAND_PREFIX.test(cmd) && !tokenizeCommand(cmd).some((token) => EVAL_STYLE_FLAGS.has(token)));
}

/**
 * `sensitive_files` (T2, docs/SAFETY_ENFORCEMENT_POLICY.md) marks which of
 * `allowed_files` touch a category from `senpai.config.yaml`'s
 * `require_approval_for` list (auth/payment/deploy/db/dependency-install/
 * destructive) -- guided-plan fills this in when it sees such a file, so
 * the human sees the flag when approving the whole plan, and scope-check.js
 * re-confirms those specific files individually instead of silently
 * batch-approving them with the rest.
 *
 * Security review finding (2026-07, HIGH/CONFIRMED): an earlier version of
 * this function filtered the list down to an exact-string subset of
 * `allowed_files` ("a Phase Plan can't mark something sensitive to smuggle
 * it into scope that wasn't otherwise granted"). That reasoning was correct
 * but the filter was unnecessary AND actively harmful -- `allowed_files`
 * matching is glob-based (scope-check.js's matchesAllowedFiles), so an
 * exact-string check against e.g. `allowed_files: [src/**]` silently
 * dropped a perfectly valid `sensitive_files: [src/auth.ts]` entry,
 * demoting a flagged auth file to T1 (no re-confirmation) with no warning.
 * The subset check was never load-bearing in the first place:
 * checkPathsAgainstScope only ever consults sensitive_files AFTER
 * confirming every write target already matches allowed_files, so a
 * sensitive_files entry that isn't otherwise in scope can never match a
 * real write target and grants nothing on its own. Removing the filter
 * fixes the glob-mismatch bug with no loss of the anti-smuggling property.
 * @param {string} content raw Phase Plan.md file content
 * @returns {string[]}
 */
function extractSensitiveFilesFromPhasePlan(content) {
  return extractFrontmatterList(content, 'sensitive_files');
}

/**
 * Reads the pending Phase Plan recorded in state.json, derives
 * `allowed_files`/`sensitive_files` from its frontmatter, and writes the
 * approval into state.json. Returns null (no state.json write performed) if
 * there is no pending plan, it can't be read, it has no usable
 * `allowed_files`, or `typedProject` doesn't match the plan's own project
 * folder -- fails closed rather than approving an empty/guessed/mismatched
 * scope.
 * @param {string} sessionId current hook payload's session_id
 * @param {string|null} typedProject project the user typed after the colon
 *   in `[senpai-go:<project>]` (null for the bare `[senpai-go]` form)
 * @returns {{allowed_files: string[], sensitive_files: string[], scope_hash: string} | null}
 */
function recordApproval(sessionId, typedProject) {
  const state = readState();
  const planPath = state && typeof state.pending_phase_plan_path === 'string'
    ? state.pending_phase_plan_path
    : null;
  if (!planPath) {
    return null;
  }

  // Security review finding (2026-07, MEDIUM/CONFIRMED): this used to skip
  // the project check entirely when expectedProject couldn't be derived
  // (a Phase Plan path that doesn't match vault/10_Projects/<name>/), which
  // approved ANY typed project -- including the bare [senpai-go] form --
  // for a non-standard plan location. A model controls where it writes
  // "Phase Plan.md" (scope-check.js's checkToolCall only checks the
  // basename), so this was a reachable bypass of the whole "re-type the
  // right project name" safeguard, not just a theoretical edge case.
  // Fail closed instead: no derivable project means no approval at all.
  const expectedProject = extractProjectFromPlanPath(planPath);
  if (!expectedProject || !projectNamesMatch(typedProject, expectedProject)) {
    return null;
  }

  let content;
  try {
    content = fs.readFileSync(path.resolve(process.cwd(), planPath), 'utf8');
  } catch {
    return null;
  }

  const allowedFiles = extractAllowedFilesFromPhasePlan(content);
  if (allowedFiles.length === 0) {
    return null;
  }

  const sensitiveFiles = extractSensitiveFilesFromPhasePlan(content);
  const verificationCommands = extractVerificationCommandsFromPhasePlan(content);
  const scopeHash = computeScopeHash(allowedFiles);
  writeState({
    session_id: sessionId,
    approved_scope: true,
    allowed_files: allowedFiles,
    sensitive_files: sensitiveFiles,
    confirmed_sensitive_files: [],
    verification_targets: verificationCommands,
    scope_hash: scopeHash,
    approved_at: new Date().toISOString()
  });

  return { allowed_files: allowedFiles, sensitive_files: sensitiveFiles, verification_targets: verificationCommands, scope_hash: scopeHash };
}

/**
 * Records that the user individually re-confirmed writing one specific T2
 * (sensitive_files) file, in response to the exact
 * `[senpai-touch:<project>:<file>]` phrase scope-check.js's deny reason
 * named. Requires an ALREADY-approved scope (approved_scope must already be
 * true) and the same project-name match recordApproval() enforces -- this
 * never grants scope on its own, it only ever adds an entry to
 * `confirmed_sensitive_files`, which scope-check.js's checkPathsAgainstScope
 * consults ONLY for a target it has already independently determined is
 * both in allowed_files and sensitive (so an incorrect/garbage file string
 * here matches no real write target and is inert -- same non-smuggling
 * property as sensitive_files itself).
 * @param {string} sessionId current hook payload's session_id -- must match
 *   the session that holds the current approval (same cross-session
 *   protection as approval-gate.js's resolveTrustedState)
 * @param {string} typedProject project from `[senpai-touch:<project>:...]`
 * @param {string} typedFile file from `[senpai-touch:...:<file>]`
 * @returns {string[]|null} the updated confirmed_sensitive_files list, or
 *   null if nothing was recorded (no active approval, session mismatch,
 *   project mismatch, or malformed file argument)
 */
function recordSensitiveFileConfirmation(sessionId, typedProject, typedFile) {
  const state = readState();
  if (!state || state.approved_scope !== true || state.session_id !== sessionId) {
    return null;
  }

  const planPath = typeof state.pending_phase_plan_path === 'string' ? state.pending_phase_plan_path : null;
  const expectedProject = planPath ? extractProjectFromPlanPath(planPath) : null;
  if (!expectedProject || !projectNamesMatch(typedProject, expectedProject)) {
    return null;
  }

  if (typeof typedFile !== 'string' || typedFile.length === 0) {
    return null;
  }

  const existing = Array.isArray(state.confirmed_sensitive_files) ? state.confirmed_sensitive_files : [];
  if (existing.includes(typedFile)) {
    return existing;
  }

  const updated = [...existing, typedFile];
  writeState({ confirmed_sensitive_files: updated });
  return updated;
}

/**
 * Read-only diagnostic for why recordApproval() returned null, used only to
 * compose a human-readable message for the UserPromptSubmit hook response
 * (advisor-review finding: recordApproval's outcome was previously silent
 * in both directions -- a fresh install's guided-plan run had no way to
 * tell the user WHY nothing happened after they sent the trigger phrase).
 * Never writes state and has no bearing on the approval decision itself --
 * recordApproval() remains the sole source of truth for what got approved.
 * @param {object} state result of readState(), read by the caller
 * @param {string|null} typedProject same value passed to recordApproval()
 * @returns {{reason: 'no_pending_plan'|'plan_path_nonstandard'|'plan_unreadable'|'no_allowed_files'|'project_mismatch', expectedPhrase: string|null} | null}
 *   null means recordApproval() should have succeeded (caller passed a
 *   stale/inconsistent state snapshot, or there is no failure to explain).
 */
function diagnoseApprovalFailure(state, typedProject) {
  const planPath = state && typeof state.pending_phase_plan_path === 'string'
    ? state.pending_phase_plan_path
    : null;
  if (!planPath) {
    return { reason: 'no_pending_plan', expectedPhrase: null };
  }

  const expectedProject = extractProjectFromPlanPath(planPath);
  if (!expectedProject) {
    // Security review finding (2026-07, MEDIUM/CONFIRMED): a Phase Plan
    // saved outside vault/10_Projects/<project>/ can never be safely
    // name-matched, so recordApproval() now refuses it outright (fail
    // closed) instead of skipping the project check. Surface that plainly
    // rather than pretending a phrase would work.
    return { reason: 'plan_path_nonstandard', expectedPhrase: null };
  }
  if (!projectNamesMatch(typedProject, expectedProject)) {
    return { reason: 'project_mismatch', expectedPhrase: buildTriggerPhrase(expectedProject) };
  }

  let content;
  try {
    content = fs.readFileSync(path.resolve(process.cwd(), planPath), 'utf8');
  } catch {
    return { reason: 'plan_unreadable', expectedPhrase: null };
  }

  if (extractAllowedFilesFromPhasePlan(content).length === 0) {
    return { reason: 'no_allowed_files', expectedPhrase: buildTriggerPhrase(expectedProject) };
  }

  return null;
}

module.exports = {
  looksLikeApprovalAttempt,
  extractTypedProject,
  buildTriggerPhrase,
  extractProjectFromPlanPath,
  projectNamesMatch,
  buildTouchPhrase,
  looksLikeTouchAttempt,
  extractTouchProjectAndFile,
  extractAllowedFilesFromPhasePlan,
  extractSensitiveFilesFromPhasePlan,
  extractVerificationCommandsFromPhasePlan,
  recordApproval,
  recordSensitiveFileConfirmation,
  diagnoseApprovalFailure
};
