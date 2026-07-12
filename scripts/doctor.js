#!/usr/bin/env node
'use strict';

// scripts/doctor.js
//
// Diagnostic CLI a non-developer runs to see the harness's install/health
// status (docs/09_ACCEPTANCE_CRITERIA.md "2. Doctor",
// docs/SAFETY_ENFORCEMENT_POLICY.md G4: "doctor는 손상된 state.json을
// 감지하면 크래시하지 않고 보고").
//
// This is a report tool, not a gate: it always exits 0 and never throws,
// even when what it finds is bad news (missing/corrupt files). Every check
// is wrapped in its own try/catch so one broken check can't stop the rest
// from running and being reported.

const fs = require('fs');
const path = require('path');
const { readState } = require('./state-store');
const { isSenpaiManagedProject, findAncestorManagedMarker } = require('./scope-check');

// `/senpai-harness:doctor` runs this FROM WITHIN A TARGET (user) PROJECT,
// not from within this plugin's own repo -- a target project never has its
// own `.claude-plugin/plugin.json` or `hooks/hooks.json` (those live only in
// the plugin's installed copy). Resolving those two checks against
// `process.cwd()` (as an earlier version of this file did) meant every real
// user always saw 2 false "✗ missing" failures, on a perfectly healthy
// install -- caught only by live-testing the actual `/senpai-harness:doctor`
// command against a separate project (2026-07), not by the unit tests, which
// happened to always run doctor.js from this same repo. `__dirname` always
// resolves to wherever this script itself physically lives (the plugin's
// real root), regardless of `process.cwd()` -- same technique as init.js's
// `PLUGIN_ROOT`.
const PLUGIN_ROOT = path.join(__dirname, '..');

const STATUS_SYMBOLS = {
  ok: '✓', // check mark
  missing: '✗', // cross mark
  corrupt: '✗',
  error: '✗',
  info: '-'
};

/**
 * Wraps a check function so it can never throw: any exception becomes an
 * 'error' status result instead of propagating.
 * @param {string} label human-readable name of the thing being checked
 * @param {() => {status: string, message: string}} fn
 * @returns {{label: string, status: string, message: string}}
 */
function runCheck(label, fn) {
  try {
    const result = fn();
    return { label, status: result.status, message: result.message };
  } catch (err) {
    return { label, status: 'error', message: `확인 중 오류 발생: ${err.message}` };
  }
}

/**
 * Check 1: `.senpai/state.json` via state-store.js#readState(). A missing
 * file is a normal state for a fresh install, not a failure. A corrupt file
 * is reported clearly but must never crash doctor.js -- readState() already
 * guarantees that, this just surfaces the result.
 * @returns {{status: string, message: string}}
 */
function checkSenpaiState() {
  const state = readState();

  if (state && state.valid === false && state.reason === 'missing') {
    return { status: 'info', message: '없음 (정상, 아직 설치/승인 전)' };
  }

  if (state && state.valid === false && state.reason === 'corrupt') {
    return { status: 'corrupt', message: `손상됨 (사유: ${state.reason}, JSON 파싱 실패)` };
  }

  return { status: 'ok', message: 'OK' };
}

/**
 * Checks that a JSON file exists and parses. Shared by the plugin.json and
 * hooks.json checks.
 * @param {string} absPath
 * @returns {{status: string, message: string}}
 */
function checkJsonFile(absPath) {
  if (!fs.existsSync(absPath)) {
    return { status: 'missing', message: '없음' };
  }

  let raw;
  try {
    raw = fs.readFileSync(absPath, 'utf8');
  } catch (err) {
    return { status: 'error', message: `읽기 실패: ${err.message}` };
  }

  try {
    JSON.parse(raw);
  } catch (err) {
    return { status: 'corrupt', message: `손상됨 (JSON 형식 오류: ${err.message})` };
  }

  return { status: 'ok', message: 'OK' };
}

/**
 * Check 2: `.claude-plugin/plugin.json` exists and is valid JSON.
 * @returns {{status: string, message: string}}
 */
function checkPluginJson() {
  return checkJsonFile(path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'));
}

/**
 * Check 3: `hooks/hooks.json` exists and is valid JSON.
 * @returns {{status: string, message: string}}
 */
function checkHooksJson() {
  return checkJsonFile(path.join(PLUGIN_ROOT, 'hooks', 'hooks.json'));
}

/**
 * Check 4: this TARGET project's `vault/` directory (the copy `/senpai-
 * harness:init` makes of the plugin's `vault-template/`, not the template
 * itself -- see PLUGIN_ROOT's doc comment above for why this must stay
 * cwd-relative while checks 2-3 must not). Missing is informational, not a
 * failure, since a project can be freshly init'd or not yet at all.
 * @returns {{status: string, message: string}}
 */
function checkVault() {
  const dir = path.join(process.cwd(), 'vault');
  if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
    return { status: 'ok', message: 'OK (존재함)' };
  }
  return { status: 'info', message: '아직 생성되지 않음' };
}

/**
 * Check 5: whether the repo is a git repository (`.git/` exists).
 * @returns {{status: string, message: string}}
 */
function checkGitRepo() {
  const gitDir = path.join(process.cwd(), '.git');
  if (fs.existsSync(gitDir)) {
    return { status: 'ok', message: 'OK (git 저장소 확인됨)' };
  }
  return { status: 'missing', message: '없음 (git 저장소가 아님)' };
}

/**
 * Check 6: the G0 opt-in gate (scripts/scope-check.js#isSenpaiManagedProject,
 * docs/SAFETY_ENFORCEMENT_POLICY.md G0) resolves its `senpai.config.yaml`
 * marker from `process.cwd()` only -- no upward search. If Claude Code (or
 * the user) is launched from a SUBFOLDER of a managed project, the marker
 * isn't found there, G0 reports "unmanaged", and every safety check (G1-G4
 * AND secret protection) silently turns off for that session -- a much more
 * dangerous failure than the old cwd-mismatch behavior (which failed loud:
 * state.json also wasn't found, so everything was denied instead). This
 * check can't fix that by itself (see docs/SAFETY_ENFORCEMENT_POLICY.md's
 * G0 section: unifying repo-root resolution across scope-check.js AND
 * state-store.js is a larger change, deliberately deferred), but it can at
 * least make the silent case loud in `doctor`'s report -- searching upward
 * for the marker is safe here because doctor is read-only diagnostics, not
 * a security gate.
 * @returns {{status: string, message: string}}
 */
function checkManagedMarkerReachability() {
  const cwd = process.cwd();

  if (isSenpaiManagedProject(cwd)) {
    return { status: 'ok', message: 'OK (이 폴더가 관리 대상입니다)' };
  }

  const ancestor = findAncestorManagedMarker(cwd);
  if (ancestor) {
    return {
      status: 'error',
      message: `상위 폴더(${ancestor})에 senpai.config.yaml이 있지만 지금 위치에는 없습니다 -- 지금 위치에서는 안전장치가 전부 꺼진 상태입니다. 상위 폴더에서 다시 실행하세요.`
    };
  }

  return { status: 'info', message: '없음 (아직 Senpai Harness 관리 대상이 아닌 프로젝트, 정상)' };
}

/**
 * Runs every check, each isolated via runCheck() so a bug in one check
 * cannot prevent the others from running and being reported.
 * @returns {Array<{label: string, status: string, message: string}>}
 */
function runChecks() {
  return [
    runCheck('.senpai/state.json (설치/승인 상태)', checkSenpaiState),
    runCheck('.claude-plugin/plugin.json', checkPluginJson),
    runCheck('hooks/hooks.json', checkHooksJson),
    runCheck('vault/ 폴더', checkVault),
    runCheck('git 저장소 (.git)', checkGitRepo),
    runCheck('senpai.config.yaml 위치 (G0 opt-in 마커)', checkManagedMarkerReachability)
  ];
}

/**
 * Renders check results into a plain-language, non-developer-friendly
 * report. No stack traces, no jargon -- a simple checklist.
 * @param {Array<{label: string, status: string, message: string}>} results
 * @returns {string}
 */
function formatReport(results) {
  const lines = [];
  lines.push('=== Senpai Harness Doctor 진단 리포트 ===');
  lines.push('');

  for (const result of results) {
    const symbol = STATUS_SYMBOLS[result.status] || '-';
    lines.push(`${symbol} ${result.label}: ${result.message}`);
  }

  const problemCount = results.filter(
    (r) => r.status === 'missing' || r.status === 'corrupt' || r.status === 'error'
  ).length;

  lines.push('');
  lines.push(
    problemCount === 0
      ? '문제가 발견되지 않았습니다.'
      : `문제가 발견된 항목: ${problemCount}개 (위 ✗ 항목을 확인하세요)`
  );

  return lines.join('\n');
}

/**
 * Entry point for standalone CLI execution. Always exits 0 -- doctor.js
 * reports problems, it doesn't fail the process.
 */
function main() {
  const results = runChecks();
  console.log(formatReport(results));
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = {
  checkSenpaiState,
  checkPluginJson,
  checkHooksJson,
  checkVault,
  checkGitRepo,
  checkManagedMarkerReachability,
  runChecks,
  formatReport,
  main
};
