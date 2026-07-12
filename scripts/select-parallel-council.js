'use strict';

/**
 * Parallel Council Router (docs/P7_BIG_ITEMS_IMPLEMENTATION_PLAN.md "1.
 * 아키텍처 결정" 결정 테이블, docs/09_ACCEPTANCE_CRITERIA.md "11. Parallel
 * Council Router" -- previously documented there as "의도적 미구현"
 * (deliberately not built, Phase 2+ scope); this module is that
 * implementation, per docs/08_MVP_SCOPE.md §8's WP-A1 assignment.)
 *
 * Deterministic, rule-based mapping from a detected user intent (see
 * scripts/classify-intent.js for the intent labels) plus a handful of
 * risk/state signals to one of 5 Council modes. Like classify-intent.js and
 * select-meeting.js, this is intentionally NOT an ML model or a
 * self-reported judgment -- it is a pure function over explicit inputs so
 * the routing decision is auditable and reproducible.
 *
 * signals shape (all fields optional, safe defaults so partial/missing
 * signals never throw and never silently escalate):
 *   {
 *     riskKeywordsDetected: boolean,
 *         // see detectRiskKeywords() below. Defaults to false when absent.
 *     hasUnresolvedDecisions: boolean,
 *         // mirrors select-meeting.js's stateHints field of the same name
 *         // (Unknown Detector still has open hidden_decisions). Only
 *         // add_feature reads this; other intents ignore it.
 *     errorRecurrenceCount: number
 *         // see readErrorRecurrence() below. Defaults to 0 when absent or
 *         // not a finite number.
 *   }
 *
 * Priority order (first match wins -- rule 1 outranks every other
 * condition, e.g. "결제 기능 붙여줘" classifies as add_feature via
 * classify-intent.js, but riskKeywordsDetected=true still forces
 * safety_council; a payment feature request is never allowed to slip
 * through as an ordinary small_council/fast_single_agent path):
 *
 * 1. riskKeywordsDetected === true -> safety_council.
 *    Rationale: 인증/로그인, 결제, 개인정보, 배포, 데이터 삭제, 외부 비용 --
 *    any of these categories carries irreversible or costly real-world
 *    consequences, so they get mandatory multi-perspective review
 *    regardless of what the underlying intent happened to classify as.
 *
 * 2. intent === 'debug' && errorRecurrenceCount >= 2 -> debug_council.
 *    Rationale: a single debug pass doesn't need a council (fast_single_agent
 *    handles it below), but a THIRD-plus occurrence of the same error
 *    (recurrence_count already at 2 means this would be the 3rd time) means
 *    the fast path isn't working and warrants memory-librarian/project-explorer
 *    context plus a skeptic's second look.
 *
 * 3. intent === 'start_project' || intent === 'brainstorm' ||
 *    (intent === 'add_feature' && hasUnresolvedDecisions !== false) ->
 *    discovery_council.
 *    Rationale: new projects, open-ended brainstorming, and feature
 *    requests that still have unresolved hidden decisions all need the same
 *    thing -- surfacing what hasn't been decided yet -- before any build
 *    work starts. `!== false` (not `=== true`) mirrors select-meeting.js's
 *    same design choice: an unknown/omitted signal defaults to "treat as
 *    unresolved" (fail-closed toward more discovery, not less).
 *
 * 4. intent === 'add_feature' && hasUnresolvedDecisions === false ->
 *    small_council. Decisions are already settled, so no parallel read-only
 *    spawn is needed -- the existing sequential path handles it, gated only
 *    by the standard before_build approval.
 *
 * 5. everything else (continue_work, verify, finish_session, explain_nondev,
 *    unknown, and a first-time debug with errorRecurrenceCount < 2) ->
 *    fast_single_agent. No new information would come from a parallel
 *    spawn here -- it would only add latency (docs/P7_BIG_ITEMS_IMPLEMENTATION_PLAN.md
 *    "3. 범위 판단" #1).
 *
 * **Invariant**: no mode's `agents` array ever contains 'builder' or
 * 'builder-runtime'. Council spawns are read-only advisory analysis only;
 * writing code goes through the separate, already-enforced Single Writer
 * approval path (docs/SAFETY_ENFORCEMENT_POLICY.md), never through Council
 * membership.
 *
 * @param {string} intent - one of the classify-intent.js labels.
 * @param {{riskKeywordsDetected?: boolean, hasUnresolvedDecisions?: boolean, errorRecurrenceCount?: number}} [signals]
 * @returns {{mode: string, agents: string[], user_approval: string, escalation: (string|null)}}
 */
function selectParallelCouncil(intent, signals) {
  const sig = signals || {};
  const riskKeywordsDetected = sig.riskKeywordsDetected === true;
  const hasUnresolvedDecisions = sig.hasUnresolvedDecisions;
  const errorRecurrenceCount =
    typeof sig.errorRecurrenceCount === 'number' && Number.isFinite(sig.errorRecurrenceCount)
      ? sig.errorRecurrenceCount
      : 0;

  if (riskKeywordsDetected) {
    return {
      mode: 'safety_council',
      agents: ['risk-guardian', 'skeptic', 'product-strategist', 'evidence-reviewer'],
      user_approval: 'mandatory',
      escalation: 'strong_reasoning'
    };
  }

  if (intent === 'debug' && errorRecurrenceCount >= 2) {
    return {
      mode: 'debug_council',
      agents: ['debugger', 'memory-librarian', 'project-explorer', 'skeptic'],
      user_approval: 'required_if_scope_changes',
      escalation: 'strong_reasoning'
    };
  }

  if (
    intent === 'start_project' ||
    intent === 'brainstorm' ||
    (intent === 'add_feature' && hasUnresolvedDecisions !== false)
  ) {
    return {
      mode: 'discovery_council',
      agents: ['unknown-detector', 'product-strategist', 'risk-guardian', 'minimality-guardian'],
      user_approval: 'required',
      escalation: 'strong_reasoning'
    };
  }

  if (intent === 'add_feature' && hasUnresolvedDecisions === false) {
    return {
      mode: 'small_council',
      agents: [],
      user_approval: 'before_build',
      escalation: null
    };
  }

  return {
    mode: 'fast_single_agent',
    agents: [],
    user_approval: 'optional',
    escalation: null
  };
}

// P6 live-session finding (docs/classify-intent.js's own header comment,
// same lesson applied here): a bare whitespace gap (`\s*`) between a noun
// and its verb misses ordinary Korean particles/fillers ("결제도",
// "결제를", "결제 좀") that speakers naturally insert -- `.{0,4}` covers a
// trailing particle without spanning into an unrelated clause. Patterns are
// grouped by the 6 risk categories named in
// docs/P7_BIG_ITEMS_IMPLEMENTATION_PLAN.md's decision table: 인증/로그인,
// 결제, 개인정보, 배포, 데이터 삭제, 외부 비용.
const RISK_KEYWORD_PATTERNS = [
  // 인증/로그인 (auth/login)
  /인증/, /로그인/, /본인\s*확인/, /회원\s*가입/, /비밀\s*번호/, /패스워드/,
  /\bauth(entication)?\b/i, /\blog[\s-]?in\b/i, /\bsign[\s-]?in\b/i, /\bsign[\s-]?up\b/i, /\bpassword\b/i,

  // 결제 (payment)
  /결제/, /카드\s*(정보|번호)/, /계좌\s*정보/, /환불/,
  /\bpayment\b/i, /\bcheckout\b/i, /\bbilling\b/i, /\bcredit\s*card\b/i, /\bcharge\s*(the\s*)?card\b/i, /\brefund\b/i,

  // 개인정보 (personal data / PII)
  /개인\s*정보/, /민감\s*정보/, /주민\s*번호/,
  /\bpersonal\s*(data|info(rmation)?)\b/i, /\bpii\b/i, /\bsensitive\s*data\b/i, /\bprivacy\b/i,

  // 배포 (deployment)
  /배포/, /운영\s*(서버|환경)/, /프로덕션/,
  /\bdeploy(ment)?\b/i, /\bproduction\s*(server|environment)\b/i, /\bgo\s*live\b/i,

  // 데이터 삭제 (data deletion) -- (지우|지워) covers the native-Korean verb
  // 지우다's stem AND its contracted conjugation ("지워줘"); the stem alone
  // would miss the contraction, the same conjugation trap as the particle bug
  // the `.{0,4}` gap already guards against ("데이터를 지우는", "데이터 좀
  // 지워줘").
  /(데이터|디비|계정).{0,4}(삭제|지우|지워)/, /전체\s*삭제/,
  /\bdelete\s+(all\s+)?(the\s+)?data\b/i, /\bdrop\s+table\b/i, /\btruncate\b/i, /\bwipe\s+(the\s+)?database\b/i,

  // 외부 비용 (external/paid cost)
  /외부\s*비용/, /유료\s*api/i, /과금/, /비용.{0,4}발생/,
  /\bpaid\s*api\b/i, /\bexternal\s*cost\b/i, /\bincur(s|red)?\s*cost\b/i
];

/**
 * @param {string} userMessage - raw natural language input from the user.
 * @returns {boolean} true if any of the 6 risk categories (인증/로그인,
 *   결제, 개인정보, 배포, 데이터 삭제, 외부 비용) is detected. Non-string or
 *   empty input safely returns false rather than throwing.
 */
function detectRiskKeywords(userMessage) {
  if (typeof userMessage !== 'string' || userMessage.trim().length === 0) {
    return false;
  }
  return RISK_KEYWORD_PATTERNS.some((pattern) => pattern.test(userMessage));
}

const fs = require('fs');
const path = require('path');

/**
 * Extracts `recurrence_count` from a note's YAML frontmatter block (the
 * region between the first two `---` lines), the same frontmatter-slicing
 * approach scripts/init.js uses -- deliberately NOT a full YAML parser
 * (this project has zero external dependencies), and deliberately scoped to
 * the frontmatter block only (not the whole file body) so an unrelated
 * mention of "recurrence_count" in prose text can't be mistaken for the
 * field.
 * @param {string} content - full file contents of an ERR-*.md note.
 * @returns {number|null} the parsed count, or null if absent/unparseable.
 */
function extractFrontmatterRecurrenceCount(content) {
  if (typeof content !== 'string' || !content.startsWith('---\n')) {
    return null;
  }
  const closingIndex = content.indexOf('\n---', 4);
  if (closingIndex === -1) {
    return null;
  }
  const frontmatter = content.slice(0, closingIndex);
  const match = frontmatter.match(/^recurrence_count:\s*(\d+)\s*$/m);
  if (!match) {
    return null;
  }
  const parsed = parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Reads every `vault/30_Errors/ERR-*.md` note under `projectDir` and
 * returns the highest `recurrence_count` found across all of them (see
 * vault-template/30_Errors/ERR-template.md and skills/error-to-playbook for
 * the frontmatter contract this reads).
 *
 * Fail-closed by design (docs/SAFETY_ENFORCEMENT_POLICY.md "모르면 막는다"
 * applied here as "unreadable/missing -> 0, never throw"): a missing
 * vault/, a missing 30_Errors/ folder, an unreadable file, or any other
 * filesystem error all resolve to 0 rather than propagating an exception --
 * callers (e.g. the CLI entry point below, or a future handler.js
 * integration) must never crash just because a project hasn't hit its
 * first recorded error yet.
 * @param {string} projectDir - repo root to look for vault/30_Errors/ under.
 * @returns {number} the max recurrence_count found, or 0.
 */
function readErrorRecurrence(projectDir) {
  try {
    const dir = typeof projectDir === 'string' && projectDir.length > 0 ? projectDir : '.';
    const errorsDir = path.join(dir, 'vault', '30_Errors');
    if (!fs.existsSync(errorsDir)) {
      return 0;
    }
    const files = fs.readdirSync(errorsDir).filter((name) => /^ERR-.*\.md$/.test(name));
    let max = 0;
    for (const file of files) {
      let content;
      try {
        content = fs.readFileSync(path.join(errorsDir, file), 'utf8');
      } catch (err) {
        continue;
      }
      const count = extractFrontmatterRecurrenceCount(content);
      if (typeof count === 'number' && count > max) {
        max = count;
      }
    }
    return max;
  } catch (err) {
    return 0;
  }
}

module.exports = { selectParallelCouncil, detectRiskKeywords, readErrorRecurrence };

// CLI entry point (same rationale as scripts/select-meeting.js's own CLI
// block): a specific, auditable, side-effect-free command scope-check.js
// can safely allowlist. Per select-meeting.js's module doc warning --
// scope-check.js's secret-check denies any single Bash command carrying 2+
// quoted arguments -- this CLI is designed around its primary real-world
// call shape being intent-only (`node scripts/select-parallel-council.js
// "<intent>"`), with the signals JSON argument an optional secondary form
// for direct/test invocation rather than the common case.
// Prints the selected {mode, agents, user_approval, escalation} object as
// JSON to stdout.
if (require.main === module) {
  const intent = process.argv[2] || '';
  let signals;
  try {
    signals = process.argv[3] ? JSON.parse(process.argv[3]) : undefined;
  } catch {
    signals = undefined;
  }
  process.stdout.write(JSON.stringify(selectParallelCouncil(intent, signals)) + '\n');
}
