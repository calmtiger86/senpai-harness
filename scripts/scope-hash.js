'use strict';

// Small shared utility: hashes an approved_files list so approval-gate.js
// can detect "scope drift" -- allowed_files being changed without a
// matching re-approval (see docs/SAFETY_ENFORCEMENT_POLICY.md G2/G4 and the
// approved build plan's "session_id+scope_hash 바인딩" requirement).
// Deliberately its own module (not folded into state-store.js) so it has
// zero dependency on state-store's already-tested read/write logic.

const crypto = require('crypto');

/**
 * @param {unknown} allowedFiles expected string[]
 * @returns {string} a stable sha256 hex digest of the sorted list
 */
function computeScopeHash(allowedFiles) {
  const normalized = Array.isArray(allowedFiles) ? [...allowedFiles].sort() : [];
  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

module.exports = { computeScopeHash };
