#!/usr/bin/env node
'use strict';

// scripts/init.js
//
// The real implementation behind `/senpai-harness:init` (see
// docs/SAFETY_ENFORCEMENT_POLICY.md, G0's "init의 닭-달걀 문제" section).
// This MUST run as a single Bash-invoked node script, not as a sequence of
// the model's own Write tool calls: writing project-template/*.md and
// vault-template/ via the model's Write tool would make every one of those
// writes a separate PreToolUse-gated tool call, and the first one to write
// senpai.config.yaml (the G0 marker) would flip the project to "managed"
// mid-sequence and deny every write after it. Here, all of that happens via
// direct fs calls inside one process, so PreToolUse only ever fires once --
// on the `node scripts/init.js` Bash call itself, at a point when the
// marker does not exist yet and G0 passthrough still applies.
//
// senpai.config.yaml is written LAST, after vault/, CLAUDE.md and AGENTS.md
// have already landed -- see the same doc section for why the order matters.

const fs = require('fs');
const path = require('path');
const { writeVaultFile } = require('./vault-writer');
const { findAncestorManagedMarker } = require('./scope-check');

const PLUGIN_ROOT = path.join(__dirname, '..');
const PROJECT_TEMPLATE_DIR = path.join(PLUGIN_ROOT, 'project-template');
const VAULT_TEMPLATE_DIR = path.join(PLUGIN_ROOT, 'vault-template');
const MARKER_FILENAME = 'senpai.config.yaml';

/**
 * @returns {boolean} true if the current directory is already a
 *   Senpai-managed project (the G0 marker exists).
 */
function alreadyInitialized() {
  return fs.existsSync(path.join(process.cwd(), MARKER_FILENAME));
}

/**
 * Independent design-review finding (2026-07): G0's marker check is
 * cwd-only (docs/SAFETY_ENFORCEMENT_POLICY.md's documented, deferred
 * limitation), so running init from a SUBFOLDER of an already-managed
 * project used to silently create a second, nested senpai.config.yaml +
 * vault/ instead of recognizing the existing one -- the one place this is
 * cheap to close without touching G0's own semantics, since init only
 * needs to refuse, not resolve a "real" project root for enforcement.
 * @returns {string|null} the ancestor directory managing this one, or null
 */
function findManagingAncestor() {
  return findAncestorManagedMarker(process.cwd());
}

/**
 * Copies one project-template file into the current project root, backing
 * up whatever it would overwrite (vault-writer.js's existing policy).
 * @param {string} filename
 * @returns {{ written: boolean, backedUp: boolean, backupPath: string|null }}
 */
function copyProjectTemplateFile(filename) {
  const content = fs.readFileSync(path.join(PROJECT_TEMPLATE_DIR, filename), 'utf8');
  return writeVaultFile(filename, content);
}

/**
 * `vault-template/10_Projects/` contains only `_template/` -- a fake
 * project folder (placeholder Phase Plan.md, Unknown Map.md, etc.) that
 * skills copy FROM when creating a real project. A plain recursive copy
 * would leave this sitting inside the user's real `vault/10_Projects/`,
 * right next to their actual projects, looking like one of them. Live
 * verification (2026-07) confirmed this actually happens on a fresh init.
 * @param {string} vaultDir
 */
function removeProjectsTemplateFolder(vaultDir) {
  fs.rmSync(path.join(vaultDir, '10_Projects', '_template'), { recursive: true, force: true });
}

/**
 * Every vault-template doc's frontmatter has an `updated`/`created: {date}`
 * placeholder meant to be filled in once, at copy time -- not shown to the
 * user verbatim. Live verification (2026-07) confirmed a fresh init leaves
 * the literal string `{date}` in every dashboard/index file's frontmatter.
 * Only the FRONTMATTER block (between the first two `---` lines) is
 * touched -- `90_System/Schema.md`'s body deliberately shows `{date}`/
 * `{project}` as illustrative example frontmatter for OTHER note types, and
 * that documentation must not be corrupted. Files whose name contains
 * "template" (ERR-template.md, ADR-template.md, PB-template.md,
 * 80_Sessions/_template.md) are skipped entirely -- those placeholders are
 * meant for skills to fill in later when they instantiate a new note from
 * the template, not for init to fill in now.
 * @param {string} vaultDir
 */
function fillDatePlaceholders(vaultDir) {
  const today = new Date().toISOString().slice(0, 10);
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.name.endsWith('.md') || /template/i.test(entry.name)) {
        continue;
      }
      const content = fs.readFileSync(fullPath, 'utf8');
      if (!content.startsWith('---\n')) {
        continue;
      }
      const closingIndex = content.indexOf('\n---', 4);
      if (closingIndex === -1) {
        continue;
      }
      const frontmatter = content.slice(0, closingIndex);
      const rest = content.slice(closingIndex);
      const filledFrontmatter = frontmatter.replace(/\{date\}/g, today);
      if (filledFrontmatter !== frontmatter) {
        fs.writeFileSync(fullPath, filledFrontmatter + rest, 'utf8');
      }
    }
  };
  walk(vaultDir);
}

/**
 * Copies vault-template/ to ./vault, but only if ./vault does not already
 * exist -- an existing vault is the user's own project memory and must
 * never be clobbered by re-running init.
 * @returns {{ copied: boolean, reason?: string }}
 */
function copyVaultTemplate() {
  const vaultDir = path.join(process.cwd(), 'vault');
  if (fs.existsSync(vaultDir)) {
    return { copied: false, reason: 'vault/ 폴더가 이미 있어서 그대로 두었습니다' };
  }
  fs.cpSync(VAULT_TEMPLATE_DIR, vaultDir, { recursive: true });
  removeProjectsTemplateFolder(vaultDir);
  fillDatePlaceholders(vaultDir);
  return { copied: true };
}

function describeFileResult(label, result) {
  if (result.backedUp) {
    return `${label}: 기존 파일을 ${result.backupPath}에 백업하고 새로 썼습니다`;
  }
  return `${label}: 새로 만들었습니다`;
}

function main() {
  if (alreadyInitialized()) {
    console.log('이미 Senpai Harness가 설정된 프로젝트입니다 (senpai.config.yaml 있음). 다시 초기화하지 않았습니다.');
    process.exit(0);
  }

  const managingAncestor = findManagingAncestor();
  if (managingAncestor) {
    console.log(`초기화를 하지 않았습니다 -- 상위 폴더(${managingAncestor})가 이미 Senpai Harness로 설정되어 있습니다. 여기서 초기화하면 그 안에 별도의 Senpai Harness가 하나 더 생겨 두 프로젝트가 혼동될 수 있습니다. ${managingAncestor}에서 작업하세요. 이 폴더에서 정말로 완전히 별개인 새 프로젝트를 시작하려는 것이라면, 상위 폴더의 senpai.config.yaml과 무관하다는 걸 직접 확인한 뒤 이 폴더에 senpai.config.yaml을 직접 만드는 방식으로 진행하세요.`);
    process.exit(0);
  }

  try {
    const lines = [];

    const vaultResult = copyVaultTemplate();
    lines.push(vaultResult.copied ? 'vault/: 새로 만들었습니다' : `vault/: ${vaultResult.reason}`);

    lines.push(describeFileResult('CLAUDE.md', copyProjectTemplateFile('CLAUDE.md')));
    lines.push(describeFileResult('AGENTS.md', copyProjectTemplateFile('AGENTS.md')));

    // G0 마커는 반드시 마지막에 쓴다 -- 위 설명 참고.
    lines.push(describeFileResult(MARKER_FILENAME, copyProjectTemplateFile(MARKER_FILENAME)));

    console.log('=== Senpai Harness 초기화 완료 ===');
    for (const line of lines) {
      console.log(`- ${line}`);
    }
    console.log('');
    console.log('이제부터 이 프로젝트는 Senpai Harness가 관리합니다. vault/ 폴더를 Obsidian으로 열어서 진행 상황을 확인할 수 있습니다.');
    process.exit(0);
  } catch (err) {
    // A non-developer must never see a raw Node stack trace (same principle
    // as doctor.js's runCheck wrapper). Failing here leaves no marker
    // written yet (it is always last), so a retry stays in G0 passthrough
    // and can recover cleanly.
    console.log('=== Senpai Harness 초기화 실패 ===');
    console.log(`문제가 발생해 초기화를 끝내지 못했습니다: ${err && err.message}`);
    console.log('senpai.config.yaml은 아직 만들어지지 않았으니, 문제를 해결한 뒤 이 명령을 다시 실행하면 됩니다.');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { alreadyInitialized, copyProjectTemplateFile, copyVaultTemplate, main };
