'use strict';

/**
 * Model Tier Router (docs/07_MODEL_ROUTING_SPEC.md "모델 티어" / "에이전트별 기본 모델 티어")
 *
 * Single source of truth for translating an abstract model *tier*
 * (fast, coding, strong_reasoning, long_context, cheap_background) and an
 * abstract *agent name* (the 12 agents listed in docs/07_MODEL_ROUTING_SPEC.md's
 * `agent_model_map` YAML block) into a concrete model identifier.
 *
 * The data below is a direct transcription of docs/07_MODEL_ROUTING_SPEC.md's
 * `model_tiers` and `agent_model_map` YAML blocks -- do not hand-tune values
 * here without updating that doc (or vice versa); tests/unit/route-model-tier.test.js
 * cross-checks this file against agents/*.md frontmatter `model:` values.
 */

/**
 * @type {Record<string, string>}
 * Maps each abstract tier name to a concrete model identifier.
 */
const TIER_TO_MODEL = {
  fast: 'haiku',
  coding: 'sonnet',
  strong_reasoning: 'opus',
  // WP-B2 조사 결론(docs/07_MODEL_ROUTING_SPEC.md "long_context 티어 실현
  // 가능성 조사"): 서브에이전트 frontmatter의 model: 필드는 확장 컨텍스트
  // 티어/표기를 지원하지 않는다(공식 문서 + GitHub #45169 확인). 따라서
  // long_context는 별도 API 티어가 아니라 sonnet + 분할 읽기/누적 요약
  // 전략으로 실현한다 -- 확정값이며 임시값이 아니다.
  long_context: 'sonnet',
  cheap_background: 'haiku',
};

/**
 * @type {Record<string, {default: string, escalate_to?: string, when?: string, fallback?: string}>}
 * Direct transcription of docs/07_MODEL_ROUTING_SPEC.md's `agent_model_map`.
 */
const AGENT_MODEL_MAP = {
  'Meeting Selector': {
    default: 'fast',
    escalate_to: 'strong_reasoning',
    when: '새 프로젝트이거나 범위가 큼',
  },
  'Unknown Detector': {
    default: 'strong_reasoning',
  },
  'Product Strategist': {
    default: 'strong_reasoning',
  },
  'Minimality Guardian': {
    default: 'strong_reasoning',
  },
  'Project Explorer': {
    default: 'long_context',
    fallback: 'coding',
  },
  Builder: {
    default: 'coding',
  },
  Debugger: {
    default: 'coding',
    escalate_to: 'strong_reasoning',
    when: '같은 오류가 2회 이상 반복',
  },
  'Evidence Reviewer': {
    default: 'strong_reasoning',
  },
  'Memory Librarian': {
    default: 'fast',
    escalate_to: 'long_context',
    when: '과거 세션 5개 이상 회수 필요',
  },
  'Nondev Explainer': {
    default: 'fast',
  },
  Skeptic: {
    default: 'strong_reasoning',
  },
  'Risk Guardian': {
    default: 'strong_reasoning',
  },
};

/**
 * Resolves an abstract model tier to a concrete model identifier.
 *
 * Never throws: an unknown tier falls back to the `coding` tier's model
 * (currently `sonnet`) as a safe default rather than blocking execution.
 *
 * @param {string} tier - one of TIER_TO_MODEL's keys (fast, coding,
 *   strong_reasoning, long_context, cheap_background).
 * @returns {string} concrete model identifier (e.g. 'sonnet').
 */
function getModelForTier(tier) {
  if (Object.prototype.hasOwnProperty.call(TIER_TO_MODEL, tier)) {
    return TIER_TO_MODEL[tier];
  }
  return TIER_TO_MODEL.coding;
}

module.exports = { TIER_TO_MODEL, AGENT_MODEL_MAP, getModelForTier };

// CLI entry point (same shape as scripts/select-meeting.js):
// `node scripts/route-model-tier.js <tier>` prints the resolved model name.
// NOTE: unlike select-meeting.js, this script is deliberately NOT registered
// in scope-check.js's KNOWN_SAFE_SCRIPT_NAMES (fail-closed) -- runtime
// consumers should require() the exported mapping instead of shelling out,
// and the CLI exists for human/dev auditing. Only register it there if a
// skill concretely needs to invoke this CLI at runtime, and re-review the
// invocation surface when doing so.
if (require.main === module) {
  const tier = process.argv[2] || '';
  process.stdout.write(getModelForTier(tier) + '\n');
}
