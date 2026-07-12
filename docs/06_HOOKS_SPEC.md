# 06. Hooks Specification

## 목적

Hooks는 Senpai Harness의 자율주행을 구현합니다. 사용자가 명령어를 외우지 않아도 세션 시작, 요청, 도구 실행, 작업 완료, 종료 시점에 필요한 회의와 기록을 자동으로 실행합니다.

## Hook 목록

```text
session-start.js
user-prompt-submit.js
pre-tool-use.js
post-tool-use.js
task-completed.js
stop.js
session-end.js
```

## 1. SessionStart Hook

파일:

```text
.claude/hooks/session-start.js
```

역할:

- Senpai 프로젝트 여부 확인
- Obsidian Vault 존재 확인
- 현재 프로젝트 상태 읽기
- 최근 세션 요약 읽기
- 미완료 결정/오류/작업 확인
- 자동 체크인 카드 생성

읽는 파일:

- `senpai.config.yaml`
- `vault/10_Projects/{project}/Current State.md`
- `vault/10_Projects/{project}/Session Memory.md`
- `vault/20_Decisions/Decision Index.md`
- `vault/30_Errors/Error Index.md`

출력:

- Today Card
- Next Recommended Meeting

의사코드:

```js
async function onSessionStart() {
  const project = detectProject();
  if (!project.hasSenpaiHarness) return suggestInstallOrSetup();

  const state = readCurrentState(project);
  const memory = readRecentSessionMemory(project, 3);
  const decisions = readOpenDecisions(project);
  const errors = readRecentErrors(project, 5);

  return renderCheckinCard({ state, memory, decisions, errors });
}
```

## 2. UserPromptSubmit Hook

파일:

```text
.claude/hooks/user-prompt-submit.js
```

역할:

- 사용자 자연어 의도 분류
- 필요한 회의 선택
- 직접 구현 경로 차단
- 라우팅 이벤트 기록

의도 유형:

- continue_work
- start_project
- add_feature
- debug
- verify
- finish_session
- explain_nondev

출력:

- selected_intent
- selected_meeting
- required_agents
- route_summary

의사코드:

```js
async function onUserPromptSubmit(prompt) {
  const intent = classifyUserIntent(prompt);
  const state = readCurrentState();
  const meeting = selectMeeting(intent, state);

  if (requiresMeetingBeforeBuild(intent)) {
    blockDirectBuild();
  }

  appendEventLog({ type: 'intent_detected', intent, meeting });
  return activateMeeting(meeting);
}
```

## 3. PreToolUse Hook

파일:

```text
.claude/hooks/pre-tool-use.js
```

역할:

- 위험 작업 감지
- secret 파일 접근 방지
- 승인 없는 코드 수정 차단
- Minimality Ladder 실행
- 병렬 쓰기 정책 확인

차단 조건:

- 사용자 승인 전 제품 코드 수정
- secret 파일 읽기/출력
- destructive operation
- dependency install
- auth/payment/deployment/database 변경
- 계획 밖 파일 수정

출력:

- allow
- block
- ask_user_approval
- open_scope_meeting

의사코드:

```js
async function onPreToolUse(toolCall) {
  const risk = detectRisk(toolCall);
  const approval = checkUserApproval(toolCall);
  const secret = protectSecrets(toolCall);
  const scope = checkScope(toolCall);

  if (secret.blocked) return block(secret.reason);
  if (risk.requiresApproval && !approval.exists) return askApproval(risk);
  if (!scope.allowed) return openScopeMeeting(scope);

  return allow();
}
```

## 4. PostToolUse Hook

파일:

```text
.claude/hooks/post-tool-use.js
```

역할:

- 변경 파일 기록
- 이벤트 로그 생성
- Edge Log 후보 생성
- 검증 필요 플래그 설정

출력:

- changed_files
- event_log
- edge_log_candidate
- verification_needed

의사코드:

```js
async function onPostToolUse(result) {
  const changes = summarizeChanges(result);
  appendEventLog(changes);

  if (changes.filesChanged) {
    markVerificationNeeded();
    appendEdgeLog(inferEdgeFromChange(changes));
  }

  return changes;
}
```

## 5. TaskCompleted Hook — **정정 (2026-07 감사): 전용 파일로 구현되지 않음, evidence-loop 스킬로 대체됨**

`hooks/hooks.json`에 `TaskCompleted` 이벤트 자체는 등록돼 있고 범용 `hooks/scripts/handler.js`로 연결돼 있지만, 아래 명세가 전제한 전용 파일(`.claude/hooks/task-completed.js`, 애초에 경로도 옛 `.claude/` 레이아웃 가정 — 03_TECHNICAL_SPEC.md 정정 참고)은 만들어진 적이 없고 `handler.js`에도 `TaskCompleted` 전용 분기 로직이 없다.

대신 이 역할(완료 증거 확인, 완료 표현 제한)은 코드 훅이 아니라 **`skills/evidence-loop/SKILL.md`(프롬프트 레벨)**가 맡고 있다 — Completion Evidence Board 확인, "증거 없이 완료라고 말하지 않는다"는 표현 제한이 전부 이 스킬 안에 있다. 이 대체가 안전 결함은 아니다: 완료 판정은 애초에 결정론적 게이트(G1~G4)가 다루는 종류의 mutating 작업이 아니라 "설명"이므로, 코드 훅으로 강제할 이유가 약하다. 다만 이 대체 결정 자체가 이전에는 어느 문서에도 명시되지 않았던 것을 여기 기록한다 — TaskCompleted가 "만들다 만 기능"이 아니라 "다른 층으로 흡수된 기능"임을 분명히 하기 위함.

아래는 원래 설계 의도(참고용, 실제로는 위 스킬이 프롬프트로 수행):

파일(옛 계획, 실제로 만들어지지 않음):

```text
.claude/hooks/task-completed.js
```

역할:

- Completion Evidence 확인
- Verification Report 생성
- Obsidian 업데이트 요청
- 완료 표현 제한

출력:

- evidence_status
- completion_status
- missing_evidence
- next_recommendation

## 6. Stop Hook

파일:

```text
.claude/hooks/stop.js
```

역할:

- 사용자가 멈추거나 세션을 끝내려는 흐름 감지
- Checkout Meeting 카드 생성
- 저장할 내용 요약

출력:

- checkout_card
- save_recommendation

## 7. SessionEnd Hook

파일:

```text
.claude/hooks/session-end.js
```

역할:

- 세션 기억 저장
- Current State 업데이트
- Agent Graph 업데이트
- 로그 flush
- 다음 세션 시작점 저장

출력:

- session_summary
- updated_files
- next_start_point

## Hook 공통 요구사항

모든 hook은 다음을 만족해야 합니다.

- 실패해도 사용자 파일을 손상시키지 않습니다.
- 에러 메시지는 비개발자가 이해할 수 있어야 합니다.
- 로그는 `.senpai/` 아래에 남깁니다.
- secret 값을 출력하지 않습니다.
- 기존 파일 수정 전 백업합니다.
