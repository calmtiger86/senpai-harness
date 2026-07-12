'use strict';

// scripts/git-hygiene.js
//
// Observational nudges for two git habits a non-developer has no reason to
// know they should form: (1) connect a remote (GitHub) after the first
// commit, so work isn't only ever on one machine, and (2) keep vault/'s
// Session Memory roughly in step with how many commits have piled up, so
// project history stays legible across sessions.
//
// This module NEVER runs git in a way that mutates the repo (no commit, no
// push, no remote add) -- it only reads state (`git rev-list`, `git log`,
// `git remote`) and writes its own marker file. It does not go through
// scripts/scope-check.js's G1 Bash gate at all, for the same reason
// scripts/state-store.js's fs writes don't: this is trusted hook-internal
// code, not a model-issued tool call.
//
// Why this exists as an observational nudge instead of a hook that fires
// on `git commit` itself (e.g. PostToolUse): `git commit`/`git add`/`git
// push` are not in scope-check.js's classifyMutating() at all, so in any
// senpai-managed project (senpai.config.yaml present) an AI-issued `git
// commit` is denied outright by G1's fail-closed default -- a PostToolUse
// hook keyed on "after git commit succeeds" would never fire there. It
// also can't help when the *human* runs `git commit` in their own
// terminal (no tool call for a hook to attach to at all). Reading actual
// git state from a lifecycle hook (Stop) instead works in both cases,
// and doesn't require touching the security-reviewed G1 gate to add a
// new mutating-command class it was never designed for (that would be a
// separate, explicitly-scoped, security-reviewed change, not this one).

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const NUDGES_DIR_NAME = '.senpai';
const NUDGES_FILE_NAME = 'nudges.json';
const NUDGES_TMP_NAME = 'nudges.json.tmp';

// Commits since Session Memory was last touched before nudging. Arbitrary
// but small on purpose -- non-developers lose the thread fast; better to
// nudge a little early than to let 20 commits pile up unrecorded.
const MEMORY_LAG_THRESHOLD = 5;

function getNudgesPaths(repoRoot) {
  const dir = path.join(repoRoot, NUDGES_DIR_NAME);
  return {
    dir,
    file: path.join(dir, NUDGES_FILE_NAME),
    tmp: path.join(dir, NUDGES_TMP_NAME)
  };
}

/**
 * Never throws: a missing or corrupt marker file just means "never
 * nudged before," which is the correct default (fail toward nudging
 * again rather than silently going quiet forever on a corrupt file).
 * @param {string} repoRoot
 * @returns {object}
 */
function readNudges(repoRoot) {
  const { file } = getNudgesPaths(repoRoot);
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Same atomic write pattern as scripts/state-store.js#writeState: write to
 * a tmp file in .senpai/, then rename over the real file.
 * @param {string} repoRoot
 * @param {object} patch
 * @returns {object} the merged marker object that was written
 */
function writeNudges(repoRoot, patch) {
  const { dir, file, tmp } = getNudgesPaths(repoRoot);
  fs.mkdirSync(dir, { recursive: true });
  const merged = { ...readNudges(repoRoot), ...patch };
  fs.writeFileSync(tmp, JSON.stringify(merged, null, 2), 'utf8');
  fs.renameSync(tmp, file);
  return merged;
}

/**
 * Runs a read-only git command via execFile (array args, no shell) so
 * there is no command-injection surface regardless of repoRoot's content.
 * @param {string} repoRoot
 * @param {string[]} args
 * @returns {string} trimmed stdout
 */
function git(repoRoot, args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  }).trim();
}

function countCommits(repoRoot) {
  try {
    return parseInt(git(repoRoot, ['rev-list', '--count', 'HEAD']), 10) || 0;
  } catch {
    // Not a git repo, or a git repo with zero commits yet -- both mean
    // "nothing to nudge about."
    return 0;
  }
}

function hasRemote(repoRoot) {
  try {
    return git(repoRoot, ['remote']).length > 0;
  } catch {
    return false;
  }
}

/**
 * @param {string} repoRoot
 * @returns {number} commits made since the most recent commit that
 *   touched any project's Session Memory.md. If Session Memory has never
 *   been committed, every commit counts (nothing has ever been recorded).
 */
function commitsSinceSessionMemoryUpdate(repoRoot) {
  try {
    const lastTouch = git(repoRoot, [
      'log',
      '-1',
      '--format=%H',
      '--',
      'vault/10_Projects/*/Session Memory.md'
    ]);
    if (!lastTouch) {
      return countCommits(repoRoot);
    }
    return parseInt(git(repoRoot, ['rev-list', '--count', `${lastTouch}..HEAD`]), 10) || 0;
  } catch {
    // Informational nudge, not a safety gate -- fail quiet, not closed.
    return 0;
  }
}

/**
 * Pure read of current git hygiene state, no side effects.
 * @param {string} repoRoot
 * @returns {{totalCommits: number, suggestRemote: boolean, commitsSinceMemory: number, suggestMemoryUpdate: boolean}}
 */
function checkGitHygiene(repoRoot) {
  const totalCommits = countCommits(repoRoot);
  if (totalCommits === 0) {
    return { totalCommits: 0, suggestRemote: false, commitsSinceMemory: 0, suggestMemoryUpdate: false };
  }

  const commitsSinceMemory = commitsSinceSessionMemoryUpdate(repoRoot);
  return {
    totalCommits,
    suggestRemote: !hasRemote(repoRoot),
    commitsSinceMemory,
    suggestMemoryUpdate: commitsSinceMemory >= MEMORY_LAG_THRESHOLD
  };
}

/**
 * Stateful wrapper for the Stop hook: checks git hygiene, rate-limits each
 * nudge against .senpai/nudges.json so it fires once per new threshold
 * crossing (not every single Stop event), and returns human-facing
 * context text -- or null when there's nothing new to say.
 * @param {string} repoRoot
 * @returns {string|null}
 */
function buildGitHygieneContext(repoRoot) {
  if (!fs.existsSync(path.join(repoRoot, '.git'))) {
    return null;
  }

  const result = checkGitHygiene(repoRoot);
  if (result.totalCommits === 0) {
    return null;
  }

  const nudges = readNudges(repoRoot);
  const patch = {};
  const messages = [];

  if (result.suggestRemote && nudges.remoteSuggested !== true) {
    messages.push(
      '[하네스] 커밋이 이 컴퓨터에만 저장되어 있고 GitHub 같은 원격 저장소에 연결되어 있지 않습니다. ' +
        '이 컴퓨터에 문제가 생기면 지금까지의 작업이 전부 사라질 수 있습니다. ' +
        '사용자에게 비공개 GitHub 저장소 연결을 원하는지 물어보세요.'
    );
    patch.remoteSuggested = true;
  }

  if (result.suggestMemoryUpdate) {
    const lastNudgedAt = nudges.lastMemoryNudgeAtCommitCount || 0;
    if (result.totalCommits - lastNudgedAt >= MEMORY_LAG_THRESHOLD) {
      messages.push(
        `[하네스] 최근 ${result.commitsSinceMemory}개 커밋 동안 Session Memory가 갱신되지 않았습니다. ` +
          'obsidian-brain-update 스킬로 이번 작업 기록을 남길지 사용자에게 물어보세요.'
      );
      patch.lastMemoryNudgeAtCommitCount = result.totalCommits;
    }
  }

  if (messages.length === 0) {
    return null;
  }

  writeNudges(repoRoot, patch);
  return messages.join('\n');
}

module.exports = { checkGitHygiene, buildGitHygieneContext };
