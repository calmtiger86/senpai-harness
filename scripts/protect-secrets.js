'use strict';

// protect-secrets: the check that runs before every G1-G4 decision (see
// docs/SAFETY_ENFORCEMENT_POLICY.md, "protect-secrets는 G1~G4 전체에 선행한다").
// Secret paths must be flagged regardless of scope/approval state, so this
// module has no dependency on state.json or session context -- it is a pure
// path-pattern check.

const path = require('path');

const ENV_EXACT = '.env';
const ENV_PREFIX = '.env.';
const SSH_PRIVATE_KEY_NAMES = new Set(['id_rsa', 'id_ed25519']);
const SECRET_EXTENSIONS = ['.pem', '.key'];
const SECRET_SUBSTRINGS = ['credential', 'secret'];

/**
 * Returns true if any segment of the given path (filename or directory
 * name) matches a known secret/credential pattern. Case-insensitive.
 *
 * Accepts relative or absolute paths -- both are normalized (via
 * path.normalize) before checking, so `./foo/.env` and
 * `/abs/path/foo/.env` both correctly resolve to true.
 *
 * @param {string} filePath
 * @returns {boolean}
 */
function isSecretPath(filePath) {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    return false;
  }

  const normalized = path.normalize(filePath);
  const segments = normalized.split(path.sep).filter(Boolean);

  return segments.some(isSecretSegment);
}

/**
 * The "hard" secret shapes: fixed filenames/extensions that are secret
 * regardless of context, with no free-form-title false-positive risk.
 * Deliberately excludes SECRET_SUBSTRINGS (see isHardSecretPath's doc
 * comment for why).
 * @param {string} segment
 * @returns {boolean}
 */
function isHardSecretSegment(segment) {
  const lower = segment.toLowerCase();

  if (lower === ENV_EXACT || lower.startsWith(ENV_PREFIX)) {
    return true;
  }

  // Exact-name match only: id_rsa.pub / id_ed25519.pub are public keys and
  // must stay false, which an exact match on the bare name already ensures.
  if (SSH_PRIVATE_KEY_NAMES.has(lower)) {
    return true;
  }

  if (SECRET_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return true;
  }

  return false;
}

/**
 * @param {string} segment
 * @returns {boolean}
 */
function isSecretSegment(segment) {
  if (isHardSecretSegment(segment)) {
    return true;
  }

  // Covers "*credential*" / "*secret*" filenames and directories, and
  // subsumes the `.aws/credentials` case since "credentials" contains
  // "credential".
  const lower = segment.toLowerCase();
  if (SECRET_SUBSTRINGS.some((needle) => lower.includes(needle))) {
    return true;
  }

  return false;
}

/**
 * Narrower sibling of isSecretPath, checking only the "hard" shapes
 * (isHardSecretSegment) and skipping the SECRET_SUBSTRINGS rule.
 *
 * Advisor review finding (P4 follow-up): the substring rule ("secret"/
 * "credential" anywhere in a segment) is right for product-code paths
 * (docs/SAFETY_ENFORCEMENT_POLICY.md's threat model), but wrong for
 * Obsidian vault document titles, which are free-form human prose --
 * `vault/20_Decisions/Login Secret Handling.md` is a completely ordinary
 * decision-note title, not a credential file, yet the substring rule
 * denied it outright (silently disabling the Obsidian Brain axis on
 * plausible Korean-English mixed input, confirmed via live testing). A
 * REAL secret file living under vault/ (`.env`, `id_rsa`, `*.pem`) is
 * still caught by the hard-shape checks either way -- see
 * scripts/scope-check.js's checkToolCall for where this is wired in
 * (vault-targeted Write/Edit/NotebookEdit/MultiEdit use this; everything
 * else keeps using the full isSecretPath).
 * @param {string} filePath
 * @returns {boolean}
 */
function isHardSecretPath(filePath) {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    return false;
  }

  const normalized = path.normalize(filePath);
  const segments = normalized.split(path.sep).filter(Boolean);

  return segments.some(isHardSecretSegment);
}

module.exports = { isSecretPath, isHardSecretPath };
