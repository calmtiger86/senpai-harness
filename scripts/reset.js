'use strict';

/**
 * Trusted opt-out capture (docs/SAFETY_ENFORCEMENT_POLICY.md G0).
 *
 * Mirrors scripts/senpai-approve.js's design for the opposite direction.
 * `senpai.config.yaml` (the G0 marker) is control-plane self-protected --
 * ANY Write/Edit/Bash mutation targeting it is unconditionally denied, by
 * design, so the model can never turn off its own governance mid-session.
 * That same protection would also block a legitimate, human-requested
 * "stop managing this project" if it were routed through the model's own
 * tool calls (a Bash `rm`, or a script invoked via
 * scope-check.js's KNOWN_SAFE_SCRIPT_NAMES -- that allowlist is
 * documented as read-only-scripts-only, and this is deliberately not one).
 *
 * So, exactly like `[senpai-go:...]`/`[senpai-touch:...]`, this is captured
 * directly from UserPromptSubmit and acted on by trusted in-process code --
 * never via a PreToolUse-gated tool call. That makes it immune to
 * permission mode and unforgeable by the model (see senpai-approve.js's
 * module doc for the cited claude-code-guide confirmation that
 * UserPromptSubmit only ever fires on genuine human input, never a model
 * tool call). This module is deliberately never added to
 * KNOWN_SAFE_SCRIPT_NAMES and never given a Bash CLI entrypoint, for the
 * same reason senpai-approve.js isn't.
 *
 * Deliberately narrow: removes ONLY senpai.config.yaml. `vault/`,
 * `CLAUDE.md`, `AGENTS.md`, and `.senpai/` are all left untouched --
 * vault/ is the user's real project memory, and the rest are harmless once
 * G0 is off (nothing reads them when the marker is gone). Re-running
 * `/senpai-harness:init` recreates the marker (and only the marker, since
 * vault/ already exists) to resume management.
 */

const fs = require('fs');
const path = require('path');
const { MANAGED_PROJECT_MARKER_FILENAME } = require('./scope-check');

// Bracketed and keyword-only, matching [senpai-go]/[senpai-touch:...]'s
// syntax so it reads as one family of signal, and stays unmistakable from
// ordinary chat prose ("이제 그만 써야겠다" must never be read as this).
// No project name needed -- unlike Phase Plan approval (which is scoped to
// one of potentially several vault/10_Projects/<name>/ subprojects), the G0
// marker is one-per-repo-root, so there is nothing to disambiguate.
const STOP_TRIGGER_PATTERN = /^\[senpai-stop\]$/i;

/**
 * Syntactic-only check: does this look like an attempted stop token at all?
 * Mirrors senpai-approve.js's looksLikeApprovalAttempt.
 * @param {string} prompt raw UserPromptSubmit `input.prompt`
 * @returns {boolean}
 */
function looksLikeStopAttempt(prompt) {
  return typeof prompt === 'string' && STOP_TRIGGER_PATTERN.test(prompt.trim());
}

/**
 * Removes the G0 marker from `repoRoot`, if present. Never touches
 * `vault/`, `CLAUDE.md`, `AGENTS.md`, or `.senpai/` -- see module doc.
 * @param {string} repoRoot
 * @returns {{stopped: boolean, reason?: 'not_managed'}}
 */
function stopManagement(repoRoot) {
  const markerPath = path.join(repoRoot, MANAGED_PROJECT_MARKER_FILENAME);
  if (!fs.existsSync(markerPath)) {
    return { stopped: false, reason: 'not_managed' };
  }
  fs.unlinkSync(markerPath);
  return { stopped: true };
}

module.exports = { looksLikeStopAttempt, stopManagement };
