#!/usr/bin/env node
'use strict';

// Senpai Harness hook dispatcher. Replaces the P0 throwaway probe (see
// docs/P0_HOOK_VERIFICATION.md for the empirical basis of this design) with
// the real G1-G4 enforcement wired in docs/SAFETY_ENFORCEMENT_POLICY.md.
//
// Reads one JSON hook payload from stdin, dispatches on `hook_event_name`,
// and prints the hook's JSON response to stdout. PreToolUse is the only
// path with real teeth (see policy doc); every other event is
// observe-and-log only. An unhandled exception in the PreToolUse path must
// never mean "let it through" -- that would silently disable the entire
// safety boundary -- so it is wrapped to fail closed (deny).
//
// G0 (independent design-review finding, 2026-07): the opt-in gate is
// checked ONCE at the very top of main(), before any dispatch, instead of
// being re-checked inside each branch. The original per-branch approach
// gated PreToolUse (approval-gate.js) and the event-log call, but the
// UserPromptSubmit approval-capture branch below was added later, copied
// the dispatch shape, and shipped without the gate -- so `[SENPAI-APPROVE]`
// could still write into `.senpai/state.json` in a project that had never
// opted in. A single choke point makes that class of bug structurally
// unreachable for any FUTURE branch too: unmanaged means bare `{}` for
// every event, full stop, before any branch-specific code ever runs.

const fs = require('fs');
const path = require('path');

const { handlePreToolUse } = require(path.join(__dirname, '..', '..', 'scripts', 'approval-gate'));
const { appendEvent } = require(path.join(__dirname, '..', '..', 'scripts', 'event-log'));
const { readState } = require(path.join(__dirname, '..', '..', 'scripts', 'state-store'));
const { isSenpaiManagedProject } = require(path.join(__dirname, '..', '..', 'scripts', 'scope-check'));
const {
  looksLikeApprovalAttempt,
  extractTypedProject,
  recordApproval,
  diagnoseApprovalFailure,
  looksLikeTouchAttempt,
  extractTouchProjectAndFile,
  recordSensitiveFileConfirmation
} = require(path.join(__dirname, '..', '..', 'scripts', 'senpai-approve'));
const { looksLikeStopAttempt, stopManagement } = require(path.join(__dirname, '..', '..', 'scripts', 'reset'));
const { buildGitHygieneContext } = require(path.join(__dirname, '..', '..', 'scripts', 'git-hygiene'));
const { classifyIntent } = require(path.join(__dirname, '..', '..', 'scripts', 'classify-intent'));
const { selectMeeting } = require(path.join(__dirname, '..', '..', 'scripts', 'select-meeting'));
const {
  selectParallelCouncil,
  detectRiskKeywords,
  readErrorRecurrence
} = require(path.join(__dirname, '..', '..', 'scripts', 'select-parallel-council'));

const MEETING_LABELS = {
  orientation_meeting: 'Orientation Meeting',
  discovery_meeting: 'Discovery Meeting',
  design_meeting: 'Design Meeting',
  scope_meeting: 'Scope Meeting',
  build_readiness_meeting: 'Build Readiness Meeting',
  review_meeting: 'Review Meeting',
  checkout_meeting: 'Checkout Meeting'
};

// Council modes (scripts/select-parallel-council.js) that require an
// additional Task-tool parallel-spawn instruction on top of (or instead of,
// when no meeting applies -- e.g. debug_council, since select-meeting.js
// maps 'debug' -> null) the meeting nudge. fast_single_agent/small_council
// deliberately get no extra text here -- WP-A3 spec: "그대로 유지".
const COUNCIL_LABELS = {
  discovery_council: '탐색 위원회(Discovery Council)',
  safety_council: '안전 위원회(Safety Council)',
  debug_council: '디버그 위원회(Debug Council)'
};

// docs/06_HOOKS_SPEC.md "2. UserPromptSubmit Hook" 원설계의 힌트 계산 규칙을
// skills/meeting-system/SKILL.md "2단계"에 문서화된 그대로 옮긴 것.
// `understanding_state`는 현재 아무 코드도 쓰지 않으므로(scripts/state-store.js의
// STATE_FIELDS 주석 참고) buildApproved는 그 필드가 채워지기 전까지 구조적으로
// 항상 false다 -- 이 훅이 새로 만든 제약이 아니라 기존 설계의 알려진 한계를
// 그대로 반영한 것(docs/P6_MEETING_DISPATCH_LIVE_VERIFICATION.md 참고).
function deriveMeetingStateHints(state) {
  const valid = state && state.valid !== false;
  const hasUnresolvedDecisions = !valid || (state.unresolved_decisions ?? 1) > 0;
  const buildApproved = Boolean(
    valid &&
    state.approved_scope === true &&
    (state.unresolved_decisions ?? 1) === 0 &&
    ['user_confirmed', 'decision_confirmed'].includes(state.understanding_state) &&
    Array.isArray(state.verification_targets) && state.verification_targets.length > 0
  );
  return { buildApproved, hasUnresolvedDecisions };
}

// council is scripts/select-parallel-council.js's {mode, agents, ...} result
// (optional -- callers that don't have one yet, or tests calling this
// directly, keep the old meeting-only behavior). Priority: a council mode
// (discovery_council/safety_council/debug_council) always adds its
// committee-roster instruction on top of whatever the meeting nudge said --
// including when there IS no meeting nudge (meeting === null), since
// select-meeting.js maps 'debug' -> null unconditionally but debug_council
// still needs to fire on a 3rd+ recurrence (see select-parallel-council.js's
// module doc, rule 2). fast_single_agent/small_council get no council text,
// only ever the pre-existing meeting nudge (or nothing, same as before).
function buildMeetingDispatchContext(intent, meeting, council) {
  const councilMode = council && council.mode;
  const isCouncilMode = councilMode === 'discovery_council' || councilMode === 'safety_council' || councilMode === 'debug_council';
  if (!meeting && !isCouncilMode) {
    return null;
  }
  const base = meeting
    ? `[하네스] 감지된 의도: ${intent} -> ${MEETING_LABELS[meeting] || meeting}. 코드를 바로 쓰지 말고 Skill 도구로 guided-auto-drive를 호출해 이어가세요.`
    : `[하네스] 감지된 의도: ${intent}.`;
  if (!isCouncilMode) {
    return base;
  }
  const agents = (council.agents || []).join(', ');
  return `${base} 이 요청은 ${COUNCIL_LABELS[councilMode]} 대상입니다. Task 도구로 다음 관점을 한 메시지 안에서 병렬로 호출하세요: ${agents}`;
}

const APPROVAL_FAILURE_REASONS = {
  no_pending_plan: 'Phase Plan을 아직 작성/저장하지 않았습니다.',
  plan_path_nonstandard: 'Phase Plan이 예상된 위치(vault/10_Projects/프로젝트명/)에 있지 않아 이름으로 승인을 확인할 수 없습니다.',
  plan_unreadable: '저장된 Phase Plan 파일을 찾을 수 없습니다.',
  no_allowed_files: 'Phase Plan에 allowed_files 목록이 비어 있습니다.',
  project_mismatch: '지금 진행 중인 프로젝트와 다른 승인 문구입니다.'
};

function buildApprovalContext(approvalResult, typedProject) {
  if (approvalResult) {
    const files = approvalResult.allowed_files.join(', ');
    const commands = approvalResult.verification_targets || [];
    const sensitiveNote = approvalResult.sensitive_files && approvalResult.sensitive_files.length > 0
      ? ` / 이 중 ${approvalResult.sensitive_files.join(', ')}은(는) 민감 항목이라 실제로 쓸 때 한 번 더 확인을 요청드립니다`
      : '';
    const verificationNote = commands.length > 0
      ? ` / 완료 확인 시 사용자에게 직접 실행을 요청할 명령 ${commands.length}개(자동 실행 안 됨): ${commands.join(', ')}`
      : '';
    return `[하네스] 승인 완료 -- ${approvalResult.allowed_files.length}개 파일 범위가 열렸습니다: ${files}${sensitiveNote}${verificationNote}`;
  }
  const diagnosis = diagnoseApprovalFailure(readState(), typedProject);
  const reason = diagnosis ? diagnosis.reason : null;
  const reasonText = APPROVAL_FAILURE_REASONS[reason] || '알 수 없는 이유로 승인이 기록되지 않았습니다.';
  const phraseNote = diagnosis && diagnosis.expectedPhrase
    ? ` 정확히 이 문구를 다시 보내주세요: ${diagnosis.expectedPhrase}`
    : reason === 'no_pending_plan' ? '' : ' 계획을 다시 확인해 채운 뒤 다시 보내주세요.';
  return `[하네스] 승인 실패 -- ${reasonText}${phraseNote}`;
}

function buildTouchContext(confirmedList, typedFile) {
  if (confirmedList) {
    return `[하네스] 개별 확인 완료 -- "${typedFile}" 파일을 이제 쓸 수 있습니다.`;
  }
  return '[하네스] 개별 확인 실패 -- 유효한 승인이 없거나(먼저 계획을 승인해야 합니다), 프로젝트 이름이 지금 진행 중인 것과 다릅니다. 방금 거부 메시지에 나온 문구를 정확히 그대로 다시 보내주세요.';
}

function buildStopContext(result) {
  if (result.stopped) {
    return '[하네스] 관리 중단 완료 -- 이 프로젝트는 이제 Senpai Harness가 관리하지 않습니다. vault/, CLAUDE.md, AGENTS.md는 그대로 남아 있습니다. 다시 쓰고 싶으면 /senpai-harness:init을 다시 실행하세요.';
  }
  return '[하네스] 관리 중단 실패 -- 이 프로젝트는 이미 Senpai Harness가 관리하고 있지 않습니다.';
}

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function safeAppendEvent(event) {
  try {
    appendEvent(event);
  } catch {
    // Logging must never block or crash the hook.
  }
}

function main() {
  const raw = readStdin();
  let input = {};
  try {
    input = JSON.parse(raw);
  } catch {
    input = { parse_error: true };
  }

  // G0 single choke point -- see module doc above. Nothing below this line
  // may run for an unmanaged project: no logging, no approval capture, no
  // PreToolUse handling. This is deliberately a hard early-return, not a
  // per-branch condition.
  if (!isSenpaiManagedProject(process.cwd())) {
    process.stdout.write('{}');
    process.exit(0);
  }

  const toolInput = input.tool_input || {};
  safeAppendEvent({
    hook_event_name: input.hook_event_name,
    tool_name: input.tool_name,
    file_path: toolInput.file_path,
    command: toolInput.command,
    content: toolInput.content
  });

  if (input.hook_event_name === 'PreToolUse') {
    let output;
    try {
      output = handlePreToolUse(input);
    } catch (err) {
      output = {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: `internal hook error, fail-closed per G4: ${err && err.message}`
        }
      };
    }
    process.stdout.write(JSON.stringify(output));
    process.exit(0);
  }

  // Trusted approval capture (docs/SAFETY_ENFORCEMENT_POLICY.md G2, see
  // scripts/senpai-approve.js's module doc). UserPromptSubmit only ever
  // fires on a genuine user-submitted chat message -- the model has no
  // tool call that forges one -- so a match on the `[senpai-go:<project>]`
  // trigger pattern here is a human-triggered, model-unforgeable approval
  // signal. This runs in-process (not via a Bash/CLI form) specifically so
  // it is never reachable through the model's own tool calls.
  if (input.hook_event_name === 'UserPromptSubmit' && looksLikeApprovalAttempt(input.prompt)) {
    const typedProject = extractTypedProject(input.prompt);
    let approvalResult = null;
    let context;
    try {
      approvalResult = recordApproval(input.session_id, typedProject);
      context = buildApprovalContext(approvalResult, typedProject);
    } catch (err) {
      // Never let approval-capture crash the hook; a failed approval just
      // means state.json is unchanged, which fails closed (G4) anyway. The
      // user still deserves to know it didn't silently succeed.
      context = `[하네스] 승인 처리 중 오류가 발생해 승인이 기록되지 않았을 수 있습니다: ${err && err.message}`;
    }
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: context
      }
    }));
    process.exit(0);
  }

  // T2 individual sensitive-file re-confirmation (independent review
  // finding, 2026-07, HIGH/MAJOR/CONFIRMED -- see scripts/senpai-approve.js's
  // recordSensitiveFileConfirmation doc). Same model-unforgeable guarantee
  // as the approval-capture branch above: only a genuine user-submitted
  // chat message reaches here.
  if (input.hook_event_name === 'UserPromptSubmit' && looksLikeTouchAttempt(input.prompt)) {
    const parsed = extractTouchProjectAndFile(input.prompt);
    let confirmedList = null;
    let context;
    try {
      confirmedList = parsed ? recordSensitiveFileConfirmation(input.session_id, parsed.project, parsed.file) : null;
      context = buildTouchContext(confirmedList, parsed && parsed.file);
    } catch (err) {
      context = `[하네스] 개별 확인 처리 중 오류가 발생해 기록되지 않았을 수 있습니다: ${err && err.message}`;
    }
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: context
      }
    }));
    process.exit(0);
  }

  // Trusted opt-out capture (see scripts/reset.js's module doc). Same
  // model-unforgeable guarantee as the two branches above -- only a genuine
  // user-submitted chat message reaches here, and this runs entirely
  // in-process, never through a PreToolUse-gated tool call, which is the
  // only way to remove a control-plane-protected file at all.
  if (input.hook_event_name === 'UserPromptSubmit' && looksLikeStopAttempt(input.prompt)) {
    let result;
    let context;
    try {
      result = stopManagement(process.cwd());
      context = buildStopContext(result);
    } catch (err) {
      context = `[하네스] 관리 중단 처리 중 오류가 발생해 실행되지 않았을 수 있습니다: ${err && err.message}`;
    }
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: context
      }
    }));
    process.exit(0);
  }

  // Meeting dispatch (docs/06_HOOKS_SPEC.md "2. UserPromptSubmit Hook" 원설계
  // -- classifyIntent()/selectMeeting()은 이미 테스트된 순수 함수였지만, 실제
  // 훅은 승인/터치/중단 문구 3개 분기만 처리했고 이 분기 자체가 빠져 있었다
  // (2026-07 라이브 세션 실측: 5턴 내내 Task/Skill 호출 0회로 재현,
  // docs/P6_MEETING_DISPATCH_LIVE_VERIFICATION.md). 위 세 분기 중 하나라도
  // 매치됐다면 이미 return했으므로, 여기 도달하는 것은 그 어느 것도 아닌
  // 일반 대화 메시지뿐이다. intent가 'unknown'이거나 selectMeeting이 null을
  // 반환하면(회의가 필요 없는 흐름) 조용히 넘어간다 -- 불확실한 신호로 매번
  // 넛지를 주입하지 않는다.
  if (input.hook_event_name === 'UserPromptSubmit') {
    try {
      const intent = classifyIntent(input.prompt);
      if (intent !== 'unknown') {
        const hints = deriveMeetingStateHints(readState());
        const meeting = selectMeeting(intent, hints);
        const council = selectParallelCouncil(intent, {
          riskKeywordsDetected: detectRiskKeywords(input.prompt),
          hasUnresolvedDecisions: hints.hasUnresolvedDecisions,
          errorRecurrenceCount: readErrorRecurrence(process.cwd())
        });
        const context = buildMeetingDispatchContext(intent, meeting, council);
        if (context) {
          process.stdout.write(JSON.stringify({
            hookSpecificOutput: {
              hookEventName: 'UserPromptSubmit',
              additionalContext: context
            }
          }));
          process.exit(0);
        }
      }
    } catch {
      // A nudge failure must never crash the hook or block the prompt;
      // fall through to the plain {} response below (security-reviewer finding L1).
    }
  }

  // Git hygiene nudges (scripts/git-hygiene.js's module doc explains why
  // this lives on Stop instead of PostToolUse-on-`git commit`). Stop fires
  // once per assistant turn, not once per session (verified against the
  // official hooks docs) -- git-hygiene.js's own marker file is what keeps
  // this from repeating every single turn once a nudge has already fired.
  // Purely observational: reads git state, never denies/blocks anything,
  // so a failure here must never turn into a blocked Stop.
  if (input.hook_event_name === 'Stop') {
    let context = null;
    try {
      context = buildGitHygieneContext(process.cwd());
    } catch {
      context = null;
    }
    if (context) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'Stop',
          additionalContext: context
        }
      }));
      process.exit(0);
    }
  }

  // All other events: no opinion, just observe/log.
  process.stdout.write('{}');
  process.exit(0);
}

main();
