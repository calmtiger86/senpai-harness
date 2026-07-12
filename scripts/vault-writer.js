'use strict';

// scripts/vault-writer.js
//
// Writes files into the Obsidian vault (or anywhere else in the repo) while
// enforcing two safety rules from docs/03_TECHNICAL_SPEC.md ("구현 원칙"):
//   6. 기존 파일을 덮어쓸 때는 백업하거나 확인해야 합니다.
//      -> we back up unconditionally before any overwrite.
//   7. secret 파일은 읽거나 출력하지 않아야 합니다.
//      -> we refuse to write to any path protect-secrets.js flags, full stop.
//
// Backup naming: backups are stored flat in `.senpai/backups/` (relative to
// process.cwd(), matching the convention in scripts/state-store.js) as
// `<ISO-timestamp-with-:-and-.-replaced-by-->__<relative-target-path-with-separators-replaced-by-__>`.
// Flattening avoids recreating the original directory structure under
// backups/ and keeps every backup file name valid on all major filesystems.

const fs = require('fs');
const path = require('path');
const { isSecretPath } = require('./protect-secrets');

const BACKUP_DIR_RELATIVE = path.join('.senpai', 'backups');

/**
 * Turns a relative path into a single flat, filesystem-safe filename
 * component by replacing path separators with "__".
 * @param {string} relativePath
 * @returns {string}
 */
function sanitizeRelativePath(relativePath) {
  return relativePath.split(path.sep).join('__');
}

/**
 * Filesystem-safe ISO-8601 timestamp for use inside a filename
 * (":" and "." are not safe on all platforms, so they become "-").
 * @returns {string}
 */
function timestampForFilename() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * Backs up `absoluteTarget` to `.senpai/backups/` if it currently exists.
 * Pulled out of writeVaultFile so scope-check.js's PreToolUse handler can
 * back up a vault file right before allowing a Write/Edit to overwrite it
 * (P4 finding: the vault-write exemption added in P3 allowed overwrites
 * with no backup at all, since the model writes through the Write/Edit
 * tool directly and never goes through this module).
 *
 * @param {string} absoluteTarget
 * @returns {{ backedUp: boolean, backupPath: string|null }}
 */
function backupIfExists(absoluteTarget) {
  if (!fs.existsSync(absoluteTarget)) {
    return { backedUp: false, backupPath: null };
  }

  const backupDir = path.resolve(BACKUP_DIR_RELATIVE);
  fs.mkdirSync(backupDir, { recursive: true });

  const relativeToRoot = path.relative(process.cwd(), absoluteTarget);
  const backupFileName = `${timestampForFilename()}__${sanitizeRelativePath(relativeToRoot)}`;
  const backupPath = path.join(backupDir, backupFileName);

  // Copy the pre-overwrite content byte-for-byte before touching the target.
  fs.copyFileSync(absoluteTarget, backupPath);
  return { backedUp: true, backupPath };
}

/**
 * Writes `content` to `targetPath`, refusing secret paths and backing up
 * any file it would otherwise overwrite.
 *
 * @param {string} targetPath relative or absolute path to write to
 * @param {string} content file content to write
 * @returns {{ written: boolean, backedUp: boolean, backupPath: string|null }}
 */
function writeVaultFile(targetPath, content) {
  if (isSecretPath(targetPath)) {
    throw new Error(
      `writeVaultFile: refusing to write to secret-classified path "${targetPath}"`
    );
  }

  const absoluteTarget = path.resolve(targetPath);
  const { backedUp, backupPath } = backupIfExists(absoluteTarget);
  if (!backedUp) {
    fs.mkdirSync(path.dirname(absoluteTarget), { recursive: true });
  }

  fs.writeFileSync(absoluteTarget, content, 'utf8');

  return { written: true, backedUp, backupPath };
}

module.exports = { writeVaultFile, backupIfExists };
