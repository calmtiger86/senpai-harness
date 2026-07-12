'use strict';

/**
 * Intent Classifier (docs/06_HOOKS_SPEC.md "2. UserPromptSubmit Hook",
 * docs/09_ACCEPTANCE_CRITERIA.md "4. 의도 감지")
 *
 * Deterministic keyword/pattern fast-path classifier for non-developer
 * natural language input (Korean/English). This is intentionally NOT an
 * ML model -- it is the cheap first pass the UserPromptSubmit hook runs
 * before any meeting/agent routing happens, so it must be simple, fast,
 * and predictable.
 *
 * Returns one of the 8 documented intent labels, or 'unknown' when no
 * rule matches (never force a guess):
 *   continue_work | start_project | add_feature | debug | verify |
 *   finish_session | explain_nondev | brainstorm | unknown
 *
 * `brainstorm` (2026-07 addition): distinct from `explain_nondev`, which
 * is "you explained X, I don't understand X" (a narrow, in-context
 * clarification need). `brainstorm` is "I don't know what I even want" --
 * open-ended decision paralysis with no options yet to clarify. Routes to
 * `design_meeting` (scripts/select-meeting.js), previously documented as
 * unreachable from intent classification alone and only enterable by
 * manually switching mid-meeting -- this is the first explicit entry
 * point a user can reach for directly.
 *
 * Rules are grouped by intent and checked in priority order (most
 * specific/unambiguous signals first) so that overlapping keywords
 * (e.g. "안 돼" for debug vs "다 된" for verify) don't misfire against
 * each other. The first rule group with a matching pattern wins.
 */

const INTENT_RULES = [
  {
    intent: 'explain_nondev',
    patterns: [
      /무슨\s*뜻/, /무슨\s*의미/, /뜻이\s*야/, /뜻이에요/, /뭔\s*말/, /뭔\s*뜻/,
      /이해가\s*안/, /이해를?\s*못/, /설명해/, /설명\s*좀/, /무슨\s*소리/,
      /뭐라는\s*거/,
      /\bexplain\b/i, /\bwhat does .* mean\b/i, /\bwhat is this\b/i, /\bmeaning\b/i,
      /\bwhat does that mean\b/i
    ]
  },
  {
    intent: 'brainstorm',
    patterns: [
      /뭘\s*해야\s*할지\s*모르겠/, /어떻게\s*해야\s*할지\s*모르겠/, /뭐부터\s*해야\s*할지\s*모르겠/,
      /아이디어가?\s*없/, /생각이?\s*안\s*나/, /같이\s*생각해/, /브레인스토밍/,
      /고민이야/, /고민이\s*있어/, /고민\s*중이야/, /막막해/, /막막하네/,
      /뭘\s*원하는지\s*모르겠/, /방향을?\s*못\s*정하/,
      /\bi don'?t know what (to do|i want)\b/i, /\bno idea\b/i, /\bbrainstorm\b/i,
      /\bhelp me think\b/i, /\blet'?s think (this )?through\b/i, /\bi'?m stuck\b/i,
      /\bnot sure what to do\b/i
    ]
  },
  {
    intent: 'debug',
    patterns: [
      /에러/, /오류/, /버그/, /고장/, /먹통/, /실패해/, /안\s*돼/, /안\s*됨/, /안\s*되네/,
      /작동을?\s*안/, /멈춰/, /터졌/, /깨졌/, /안\s*열려/, /안\s*나와/,
      /\berror\b/i, /\bbug\b/i, /\bcrash(ed|ing)?\b/i, /\bbroken\b/i, /\bnot working\b/i,
      /\bfail(s|ed|ing)?\b/i, /\bdoesn'?t work\b/i
    ]
  },
  {
    intent: 'verify',
    patterns: [
      /다\s*됐/, /다\s*된/, /된\s*거야/, /끝났/, /완료\s*됐/, /완료\s*된/, /다\s*만들었/,
      /확인해\s*줘/, /검증해/, /테스트\s*해\s*봤/, /제대로\s*됐/,
      /\bis it done\b/i, /\bare we done\b/i, /\bfinished\?/i, /\bready\?/i,
      /\bdoes it work\b/i, /\bverify\b/i, /\ball done\?/i
    ]
  },
  {
    intent: 'finish_session',
    patterns: [
      /여기까지/, /오늘은\s*그만/, /그만\s*할래/, /그만\s*하자/, /마무리\s*하자/, /마무리\s*할게/,
      /끝낼게/, /여기서\s*끝/, /세션\s*끝/, /오늘은\s*여기서/,
      /\bstop for today\b/i, /\bthat'?s it for today\b/i, /\bwrap up\b/i,
      /\bdone for (the day|today)\b/i, /\bcall it a day\b/i
    ]
  },
  {
    intent: 'continue_work',
    patterns: [
      /이어서/, /이어\s*하자/, /하던\s*거/, /하던\s*일/, /계속\s*해/, /계속\s*하자/, /다시\s*이어/,
      /이어\s*가자/,
      /\bcontinue\b/i, /\bresume\b/i, /\bkeep going\b/i, /\bwhere (we|i) left off\b/i,
      /\bpick up where\b/i
    ]
  },
  {
    intent: 'start_project',
    patterns: [
      /새\s*앱/, /새로운\s*앱/, /새\s*프로젝트/, /새로운\s*프로젝트/, /새\s*서비스/, /새로운\s*서비스/,
      /만들고\s*싶어/, /만들고\s*싶다/, /처음부터\s*만들/, /창업\s*아이템/,
      /\bnew app\b/i, /\bnew project\b/i, /\bstart (a )?(new )?project\b/i, /\bbuild (me )?a new\b/i,
      /\bfrom scratch\b/i
    ]
  },
  {
    intent: 'add_feature',
    patterns: [
      // `.{0,4}` (not `\s*`) between "기능" and the verb -- P6 live-session
      // finding: a bare whitespace gap missed ordinary particles/fillers
      // ("기능도", "기능 좀", "기능은") that Korean speakers insert between
      // noun and verb, so "로그인 기능 좀 넣어주세요" classified as
      // 'unknown' and silently skipped the meeting-dispatch nudge this was
      // meant to trigger (docs/P6_MEETING_DISPATCH_LIVE_VERIFICATION.md).
      // A handful of characters is enough to cover a trailing particle
      // without spanning into an unrelated clause.
      /기능.{0,4}붙여/, /기능.{0,4}추가/, /기능.{0,4}넣어/, /기능.{0,4}만들어/, /기능.{0,4}달아/,
      /붙여\s*줘/, /추가해\s*줘/,
      /\badd (a |the )?feature\b/i, /\badd .* (button|page|screen|login|signup)\b/i, /\bimplement\b/i,
      /\bcan you add\b/i
    ]
  }
];

/**
 * @param {string} userMessage - raw natural language input from the user.
 * @returns {string} one of continue_work, start_project, add_feature,
 *   debug, verify, finish_session, explain_nondev, brainstorm, unknown.
 */
function classifyIntent(userMessage) {
  if (typeof userMessage !== 'string' || userMessage.trim().length === 0) {
    return 'unknown';
  }

  const text = userMessage.trim();

  for (const rule of INTENT_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return rule.intent;
    }
  }

  return 'unknown';
}

module.exports = { classifyIntent };

// CLI entry point (P3 finding): skills documented `node -e "require(...)..."`
// as their invocation pattern, but arbitrary `node -e` execution is -- and
// must stay -- outside the Bash read-only allowlist (docs/SAFETY_ENFORCEMENT_POLICY.md
// G1, "unrecognized/unparseable = deny"). A pure, side-effect-free, argument-only
// CLI form (matching scripts/doctor.js's existing require.main pattern) is the
// correct fix: `node scripts/classify-intent.js "<message>"` is a specific,
// auditable command scope-check.js can safely allowlist, whereas "any node -e"
// cannot be bounded. Prints the classified intent to stdout, nothing else.
if (require.main === module) {
  const message = process.argv[2] || '';
  process.stdout.write(classifyIntent(message) + '\n');
}
