---
name: meeting-system
description: 사용자의 자연어 요청에서 의도를 감지해 orientation/discovery/design/scope/build_readiness/review/checkout 7개 회의 모드 중 무엇을 열지 정하고, 그 회의를 실제로 진행해 vault-template 산출물을 만든다. "기능 추가해줘", "새 프로젝트 만들고 싶어", "다 됐어?", "오늘 여기까지", "뭘 해야 할지 모르겠어" 같은 요청이 들어와 다음에 무슨 회의를 열지 판단해야 할 때, 세션 시작/종료 시, 또는 구현 직전 진행 가능 여부를 확인해야 할 때 사용한다.
disable-model-invocation: false
---

# Meeting System

## 이 스킬이 하는 일

`docs/04_AGENT_SPEC.md`의 "2. Meeting Selector" 에이전트 역할을 실제로 수행한다. 사용자 요청을 바로 구현으로 연결하지 않고, 먼저 지금 상황에 맞는 회의를 자동으로 골라 열어서 숨은 결정을 드러내고, 사용자의 이해와 승인을 확인한 뒤에만 다음 단계(주로 구현)로 넘어가게 만든다. `docs/00_CONCEPT.md`의 "Ask Before Build" 철학을 라우팅 레벨에서 강제하는 스킬이다.

절대 하지 않는 것: 회의를 건너뛰고 바로 코드를 쓰거나, 사용자 승인 없이 회의 결과를 확정하는 것.

## 언제 발동하는가

- 세션 시작 직후 (자동 체크인 흐름, `docs/02_PRODUCT_SPEC.md` "1. 자동 체크인 흐름")
- 사용자가 새 기능/새 프로젝트를 요청할 때
- 사용자가 "다 됐어?", "확인해줘"라고 물을 때
- 사용자가 세션을 끝내려 할 때
- Build Gate를 통과해야 하는 시점 (구현 직전)

## 실행 절차

### 1단계 — 빠른 의도 분류 (`scripts/classify-intent.js`)

`classify-intent.js`는 CLI 실행 블록(`require.main`)을 가진 스크립트다. `node -e "require(...)..."` 형태는 임의 코드 실행이라 `scripts/scope-check.js`(G1)가 항상 차단한다 — 절대 이 형태를 쓰지 않는다.

**경로는 `scripts/classify-intent.js`(상대경로)가 아니라 `${CLAUDE_PLUGIN_ROOT}` 환경변수로 가리킨다.** 이 스킬은 이 저장소가 아니라 실제 사용자 프로젝트에서 실행되고, `scripts/init.js`는 사용자 프로젝트에 `scripts/` 디렉토리를 복사하지 않는다 — 상대경로 `scripts/classify-intent.js`는 사용자 프로젝트의 cwd에 존재하지 않는 파일을 가리켜, `scripts/scope-check.js`의 PreToolUse 훅이 Bash 호출 자체를 `unrecognized/unparseable command, fail-closed per G1`로 거부한다(Node가 실행되기 전에 훅이 막으므로 "Cannot find module" 같은 런타임 에러조차 보이지 않는다 — 실제 사용자 프로젝트로 라이브 재현한 실측 결과 확인됨). `${CLAUDE_PLUGIN_ROOT}`는 `commands/init.md`/`doctor.md`/`status.md`가 이미 쓰는 것과 같은 표준 환경변수로, 플러그인의 실제 설치 경로를 가리킨다.

**인자가 있는 스크립트는 경로를 따옴표로 감싸지 않는다.** `scripts/shell-tokenize.js`의 `hasUnresolvableSyntax`는 한 Bash 명령 안에 최상위 따옴표 영역이 2개 이상이면 무조건 차단한다(round-3 문자열 연결 우회 방지 규칙 — 아래 3단계의 `select-meeting.js` 2-인자 제약과 같은 이유). `"${CLAUDE_PLUGIN_ROOT}/scripts/classify-intent.js" "메시지"`처럼 경로와 메시지 인자를 둘 다 따옴표로 감싸면 따옴표 영역이 2개가 되어 차단된다(직접 재현 확인) — 경로는 따옴표 없이, 메시지 인자만 따옴표로 감싼다:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/classify-intent.js "로그인 기능 붙여줘"
# -> add_feature
```

반환되는 9개 라벨: `continue_work | start_project | add_feature | debug | verify | finish_session | explain_nondev | brainstorm | unknown`

이 라벨들은 규칙 기반 키워드 매칭이다 (한/영 혼용 가능). 애매하면 `unknown`을 반환하며, 이 경우 절대 임의로 라벨을 추측해 다음 단계로 넘기지 말고 사용자에게 "무엇을 하고 싶으신지" 다시 물어본다.

### 2단계 — 현재 상태 힌트 읽기 (`scripts/state-store.js`)

`select-meeting.js`는 `stateHints`(`buildApproved`, `hasUnresolvedDecisions`)를 받는다. 이 힌트는 `.senpai/state.json`(외부 진실源, 모델의 자기 보고를 신뢰하지 않는다 — `docs/SAFETY_ENFORCEMENT_POLICY.md`)에서 유도한다.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/state-store.js"
```

(`state-store.js`도 1단계의 `classify-intent.js`처럼 `require.main` CLI 블록을 가진 스크립트라 이 형태로 바로 실행되며 `readState()`의 JSON을 그대로 출력한다. `node -e "require(...)..."` 형태는 1단계와 똑같은 이유로 여기서도 항상 차단되므로 절대 쓰지 않는다. 경로를 `${CLAUDE_PLUGIN_ROOT}`로 가리키는 이유는 1단계 참고 — 이 스크립트는 인자가 없으므로 경로를 따옴표로 감싸도 최상위 따옴표 영역이 1개뿐이라 안전하다(`commands/status.md`가 쓰는 것과 같은 형태).)

`readState()`는 절대 throw하지 않는다: 파일이 없거나 손상되면 `{ valid: false, reason: 'missing' | 'corrupt' }`를 반환한다 (fail-closed, G4). 이 경우 아래처럼 **가장 보수적인 값**을 쓴다 — "아직 아무것도 결정된 게 없다"고 가정한다.

힌트 계산 규칙 (`docs/02_PRODUCT_SPEC.md`의 `before_build` 게이트를 그대로 따른다):

```js
const state = readState();
const valid = state.valid !== false;

// hasUnresolvedDecisions: add_feature일 때만 쓰인다.
const hasUnresolvedDecisions = !valid || (state.unresolved_decisions ?? 1) > 0;

// buildApproved: before_build 4개 조건을 모두 만족해야 true.
// mvp_scope_exists는 별도 필드가 없으므로 approved_scope로 근사한다.
const buildApproved = valid &&
  state.approved_scope === true &&
  (state.unresolved_decisions ?? 1) === 0 &&
  ['user_confirmed', 'decision_confirmed'].includes(state.understanding_state) &&
  Array.isArray(state.verification_targets) && state.verification_targets.length > 0;
```

`state.json`이 없거나 손상됐으면 `hasUnresolvedDecisions = true`, `buildApproved = false`로 취급한다. 이건 버그가 아니라 의도된 fail-closed 동작이다 — 절대 "일단 통과시키자"로 넘어가지 않는다.

### 3단계 — 회의 매핑 (`scripts/select-meeting.js`)

`select-meeting.js`도 CLI 실행 블록이 있다 — `node ${CLAUDE_PLUGIN_ROOT}/scripts/select-meeting.js <intent> [stateHintsJson]` 형태로 실행한다(경로를 `${CLAUDE_PLUGIN_ROOT}`로 가리키는 이유와 경로를 따옴표로 감싸지 않는 이유는 1단계 참고).

**주의: 두 번째 인자(`stateHintsJson`)는 이 CLI 형태로 넘기지 않는다.** 하나의 Bash 명령 안에 최상위 따옴표 영역이 2개 이상 있으면(`"add_feature" '{...}'`처럼, 또는 경로 자체를 따옴표로 감싸고 인자도 따옴표로 감싸는 경우도 마찬가지) `scripts/scope-check.js`의 secret-check(`hasUnresolvableSyntax`)가 "따옴표 영역이 여러 개"라는 이유로 무조건 차단한다(round-3 연결 우회 방지 규칙, 스크립트 이름과 무관하게 적용됨). 대부분의 경우 2단계에서 이미 `hasUnresolvedDecisions`/`buildApproved`를 계산해뒀으므로, `stateHints`가 필요 없는 기본 형태만 쓴다:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/select-meeting.js "add_feature"
# -> discovery_meeting (stateHints 없으면 hasUnresolvedDecisions/buildApproved 모두 "아직 아니다"로 취급 -- add_feature 기본값과 동일)
```

`selectMeeting(intent, stateHints)`의 실제 결정 로직 (스크립트 안 주석을 그대로 반영):

1. `buildApproved === true`이고 intent가 `finish_session`/`verify`/`brainstorm`이 아니면 → 무조건 `build_readiness_meeting` (구현 직전이 다른 모든 것보다 우선).
2. `start_project` → `orientation_meeting`
3. `add_feature` → `hasUnresolvedDecisions === false`면 `scope_meeting`, 그 외(기본값)에는 `discovery_meeting`
4. `verify` → `review_meeting`
5. `finish_session` → `checkout_meeting`
6. `brainstorm` → `design_meeting` (2026-07 추가, 아래 참고)
7. `debug`, `continue_work`, `explain_nondev`, `unknown` → **`null`** (7개 회의 중 어느 것도 아님 — 4단계 참고)

**`design_meeting`은 `brainstorm` 의도로 직접 도달할 수 있다(2026-07 추가)** — 예전에는 "이 셀렉터에서 절대 나오지 않는다"고 문서화돼 있었지만, "뭘 해야 할지 모르겠어"/"아이디어가 없어" 같은 말을 인식하는 `brainstorm` 의도가 생기면서 명시적 진입 경로가 됐다. 그 외에도 여전히 Discovery/Scope 회의 도중 설계 선택지가 여러 개로 갈릴 때 그 회의 **안에서** 수동으로 전환해 들어갈 수 있다. `buildApproved`가 true여도 `brainstorm`은 build_readiness_meeting으로 밀리지 않는다 — 뭘 원하는지 모르겠다는 신호가 나온 이상, 이미 승인된 빌드가 있어도 먼저 멈추고 생각하는 게 맞다.

### 4단계 — 라우팅 근거는 이미 자동으로 기록된다

회의를 고르기까지 실행한 `classify-intent.js`/`select-meeting.js` CLI 호출은 `hooks/scripts/handler.js`가 모든 훅 호출마다 자동으로 `.senpai/event_logs.jsonl`에 남긴다(`{hook_event_name, tool_name, command, ...}`, secret 경로는 자동으로 redact됨). `scripts/event-log.js`의 `appendEvent()`는 Bash CLI 진입점이 없어 이 스킬에서 직접 호출할 수 없으므로(`node -e` 형태의 임의 실행은 1단계와 같은 이유로 항상 차단된다), 별도로 라우팅 이벤트를 남기려 하지 않는다.

### 5단계 — 회의 진행 + 산출물 작성 (`Write` 도구, `vault/` 경로)

`vault-template/10_Projects/_template/*.md`는 **틀(shape)**이다. 실제 산출물은 이 틀을 복사해 실제 프로젝트 vault의 `10_Projects/{project-name}/*.md`에 채워 넣는다. `{project}`, `{date}` 같은 placeholder를 실제 값으로 바꾼 내용을 `Write` 도구로 `vault/...` 경로에 쓴다.

`vault/` 아래 경로는 `scripts/scope-check.js`가 build 승인 여부와 무관하게 항상 허용한다(Obsidian Brain 축은 회의 중 자유롭게 갱신되는 것이 설계 의도 — `docs/SAFETY_ENFORCEMENT_POLICY.md` G2 참고). **`vault-template/`는 절대 쓰기 대상이 아니다** — 그건 플러그인 자체의 읽기 전용 틀이고, 실제 프로젝트 데이터는 항상 `vault/`(vault-template이 아니라)에 쓴다. `scripts/vault-writer.js`의 `writeVaultFile()`은 현재 Bash에서 호출할 CLI 진입점이 없어 이 스킬에서 쓸 수 없다 — 대신 `Write` 도구를 직접 쓴다. 기존 파일을 덮어쓸 때의 백업은 `scope-check.js`가 PreToolUse 시점에 자동으로 처리한다(`.senpai/backups/`에 보관) — 이 스킬이 따로 백업을 챙길 필요는 없다.

```
Write 도구:
  file_path: vault/10_Projects/my-app/Unknown Map.md
  content: <채워 넣은 내용>
```

## 7가지 회의 모드 상세

아래 정의는 `vault-template/90_System/Meeting Rules.md` (실제로 사용자 vault에 배포되는, `docs/02_PRODUCT_SPEC.md` "회의 모드"를 풀어쓴 시스템 문서)를 그대로 따른다. 이 스킬과 vault 문서가 서로 다른 말을 하면 사용자가 혼란스러우므로, 새 표현을 만들지 말고 이 정의를 그대로 쓴다.

### Orientation Meeting

- **언제**: 처음 프로젝트를 시작하거나, 맥락이 불명확할 때 (`selectMeeting`은 `start_project`의 기본값으로 이 회의를 고른다)
- **산출**: "지금 상황 카드" + 다음 회의 추천. `Project Brief.md`와 `Current State.md`가 없으면 이것부터 만든다.
- **실제로 할 일**:
  1. `vault/10_Projects/{project}/Project Brief.md`가 있는지 확인. 없으면 세 가지만 묻는다 — "무엇을 만들고 싶으신가요?", "왜 필요한가요?", "무엇이 되면 성공인가요?" — 답을 `Project Brief.md` 틀(`사용자가 원하는 것 / 왜 필요한지 / 성공 기준`)에 채워 쓴다.
  2. `Current State.md`(`현재 단계 / 최근 변경 / 다음 할 일`)를 새로 만들거나 확인한다.
  3. `Project Home.md`(한 줄 설명, 현재 단계, 현재 MVP 범위, 중요한 결정, 최근 오류, 완료 증거 상태, 다음 추천)를 갱신한다. "중요한 결정"에는 관련 `[[ADR-XXXX-...]]`를, "최근 오류"에는 관련 `[[ERR-XXXX-...]]`를 위키링크로 적는다(경로 없이 그대로 — 번호 붙는 문서라 vault 전체에서 고유하다. `obsidian-brain-update/SKILL.md` "위키링크로 연결하기" 참고).
  4. 다음 회의로 Discovery 또는 Design을 추천하고 사용자에게 진행 여부를 확인한다.

### Discovery Meeting

- **언제**: 사용자가 모르는 숨은 결정이 많을 때 (`add_feature`의 기본값)
- **산출**: Unknown Detector가 만드는 Unknown Map + 사용자가 고를 수 있는 Decision Card. 여기서 답한 내용은 Decision Record로 저장된다.
- **실제로 할 일 (직접 처리하지 말고 아래 순서대로 위임할 것 — 2026-07 정정)**:

  **정정 (2026-07): Discovery Meeting의 실제 프로세스가 설계보다 단순화되었음을 확인하고 정정합니다.** 이 절이 원래 1~4단계를 이 스킬이 직접 처리하는 것처럼 적어놓았으나, 실제로 Unknown Map과 Decision Card는 더 자세하고 신중한 별도 스킬(`skills/unknown-map/SKILL.md`, `skills/decision-card/SKILL.md`)로 설계되어 있습니다. 아래로 정정한다 — 이 스킬은 각 하위 스킬이 이미 만든 결과를 사용자에게 보여주는 진행자 역할만 한다.**

  1. Skill 도구로 **`unknown-map`**을 호출한다. 이 스킬이 `docs/04_AGENT_SPEC.md` "3. Unknown Detector"의 10개 확인 범주를 훑어 `vault/10_Projects/{project}/Unknown Map.md`를 채운다.
  2. Unknown Map이 채워지고 "이번 회의에서 결정할 것"에 항목이 남아 있으면, Skill 도구로 **`decision-card`**를 호출한다. 이 스킬이 그 항목 하나를 골라 `docs/02_PRODUCT_SPEC.md` "2. 새 기능 요청 흐름" 형식의 Decision Card(A/B/C/D)를 만든다.
  3. 사용자가 선택하면, 다시 Skill 도구로 **`decision-card`**를 호출해 그 선택을 ADR(`vault/20_Decisions/ADR-XXXX-{title}.md`, `ADR-template.md` 틀)로 기록하고 `Decision Index.md`에 반영하도록 맡긴다 — 이 스킬(meeting-system)이 직접 ADR을 만들지 않는다.
  4. Unknown Map에 남은 결정 항목이 있으면 2~3단계를 반복한다(한 번에 하나씩).
  5. 결정이 끝나면 Scope Meeting 또는 Build Readiness Meeting으로 넘어갈지 사용자에게 확인한다.

### Design Meeting

- **언제**: 여러 설계 선택지를 비교해야 할 때, 또는 사용자가 "뭘 해야 할지 모르겠어"/"아이디어가 없어"처럼 비교할 선택지 자체가 아직 없을 때(`classify-intent.js`의 `brainstorm` 의도, 2026-07 추가 — `selectMeeting('brainstorm', ...)`이 이 회의로 직접 연결된다). 그 외에도 Discovery/Scope 회의 진행 중 "이 결정은 방식이 여러 개라 비교가 필요하다"고 판단되면 그 안에서 수동으로 전환할 수 있다.
- **산출**: 선택지별 장단점 비교표 + Decision Card. 선택 결과는 `20_Decisions`에 Decision Record로 남는다.
- **실제로 할 일 (2026-07 정정: Discovery Meeting과 같은 이유로 위임 방식으로 변경)**:
  1. **선택지가 아직 없는 경우(brainstorm)만, 비교 전에 먼저**: 곧바로 "그래서 뭘 고를까요"로 넘어가지 않는다. Skill 도구로 **`decision-card`**를 호출하되, 이번엔 비교가 아니라 **생성** 목적임을 알린다 — "지금 상황에서 나올 수 있는 방향이 뭐가 있을지" 4관점(기획/기술/위험/최소구현)에서 후보를 뽑도록 요청한다. 후보가 하나도 안 나오면 억지로 채우지 말고 "지금 정보로는 방향을 못 정하겠다, 뭐가 더 필요한지"를 사용자에게 되묻는다.
  2. 후보 2~4개가 나오면 "선택지 A/B/C"로 삼아 다시 Skill 도구로 **`decision-card`**를 호출해 장단점·난이도 비교표를 만들고 사용자의 선택을 기다린다. 사용자가 고르면 같은 스킬이 ADR로 기록한다(meeting-system이 직접 ADR을 만들지 않는다). 절대 이 스킬(meeting-system)이 하나를 대신 골라주지 않는다 — 추천은 하되 결정은 사용자 몫이다.

### Scope Meeting

- **언제**: MVP에 넣을 것과 뺄 것을 정할 때 (`add_feature`이고 `hasUnresolvedDecisions === false`일 때 — 숨은 결정은 이미 끝났고 범위만 좁히면 되는 경우)
- **산출**: MVP Scope, Feature Priority, Scope Recommendation. "이번에 만들 것"과 "이번에 만들지 않을 것"을 명확히 나눈다.
- **실제로 할 일 (2026-07 정정: 3단계를 `minimality-ladder` 스킬 위임으로 변경)**:
  1. `vault/10_Projects/{project}/PRD.md`의 "핵심 기능"/"제외 범위" 섹션을 채우거나 갱신한다. "목표" 섹션에서 원래 요청을 `[[10_Projects/{project}/Project Brief]]`로 링크한다.
  2. `docs/04_AGENT_SPEC.md` "4. Product Strategist" 관점에서 이번 단계에 정말 필요한 것과 다음으로 미룰 것을 나눠 추천한다.
  3. Skill 도구로 **`minimality-ladder`**를 호출한다. **정정**: Scope Meeting은 이 스킬이 직접 사다리를 통과하는 것이 아니라, 더 자세한 `skills/minimality-ladder/SKILL.md`(각 단계 실제 확인 방법, 절대 줄이면 안 되는 7가지, Minimality Check 노트 작성)를 별도로 호출해야 합니다. 이제 이 스킬을 직접 호출해 제대로 된 절차와 `Minimality Check.md` 기록을 맡깁니다.
  4. 사용자에게 최종 범위를 확인받는다. 이 확인이 끝나야 `hasUnresolvedDecisions`가 사실상 0이 되어 Build Readiness Meeting으로 넘어갈 조건이 갖춰진다.

### Build Readiness Meeting

- **언제**: 실제 구현 전에 진행 가능 여부를 확인할 때. `stateHints.buildApproved === true`면 다른 어떤 intent(단, `finish_session`/`verify` 제외)든 무조건 여기로 온다.
- **산출**: Build Checklist(작업 체크리스트) + Verification Target. 이 회의를 통과해야 `vault-template/90_System/Build Gates.md`의 Build Gate를 넘어 Builder가 움직일 수 있다.
- **실제로 할 일 (순서를 반드시 이대로 지킨다 — 승인 문구를 먼저 안내했다가 승인 시도가 실패한 뒤에야 Phase Plan.md를 작성한 역전이 실제 라이브 세션에서 관측된 적이 있다)**:
  1. `vault/10_Projects/{project}/Phase Plan.md` 틀을 `Write` 도구로 **실제로 저장**한다 — 목표 / 이번에 할 것 / 이번에 하지 않을 것 / 작업 체크리스트 / 완료 증거 / 승인 상태(사용자가 범위를 이해함, 사용자가 진행을 승인함 두 체크박스). 자세한 절차는 `guided-plan` 스킬로 위임한다.
  2. `Build Gates.md`의 통과 체크리스트를 그대로 확인한다 — Phase Plan.md 실제 저장됨(1번에서 방금 했는지), Project Brief 존재, Current State 파악됨, MVP Scope 존재, Unknown Map 검토됨, 미해결 결정 0개(또는 명시적으로 미룸), 사용자 승인 완료, Minimality Ladder 통과, 검증 목표 존재. 하나라도 비면 그 항목을 채우기 위해 Discovery/Scope Meeting으로 돌아간다 — 절대 임의로 통과시키지 않는다.
  3. `docs/02_PRODUCT_SPEC.md` "3. Build Readiness 흐름"의 출력 형식대로 사용자에게 최종 확인을 받는다 — "이번에 만들 것 / 만들지 않을 것 / 확인 방법"을 보여주고 "이 범위로 진행할까요?"라고 묻는다. **이 화면과 `[senpai-go:...]` 안내는 1번의 `Write` 호출이 이미 끝난 뒤에만 보여준다.**
  4. 사용자가 채팅에 `[senpai-go:{project}]`를 정확한 프로젝트 이름과 함께 그대로 보내야 `scripts/senpai-approve.js`가 인프로세스로 `.senpai/state.json`에 `approved_scope: true`, `allowed_files`, `sensitive_files`, `verification_targets`를 기록하고, 그래야 실제 PreToolUse 게이트(`scripts/scope-check.js`)가 Builder의 쓰기를 허용한다(별도의 `/senpai-approve` 슬래시 커맨드는 존재하지 않는다). 이 스킬은 Phase Plan 문서만 만들고 사용자에게 이 문구를 정확히 보내야 한다고 안내할 뿐, `state.json` 갱신 자체는 스스로 하지 않는다. "이 범위로 진행할까요?"에 "네"/"좋아요" 같은 다른 말로 답하거나 프로젝트 이름을 틀리면 승인이 기록되지 않는다는 것을 사용자에게 분명히 알린다.

### Review Meeting

- **언제**: 구현 결과를 검토하고 다음 방향을 정할 때 (`verify` intent는 항상 여기로 고정)
- **산출**: Verification Report + Evidence Status. 완료 상태가 정확한 말(부분 완료 / 구현 완료, 검증 전 / 로컬 기준 완료 / 빌드 기준 완료 / 검증 완료)로 정리된다.
- **실제로 할 일**:
  1. `vault/10_Projects/{project}/Verification.md` 표(테스트 항목/기대 결과/실제 결과/상태)와 `Completion Evidence.md`(완료라고 말하려면 필요한 증거 5가지: 파일 생성/수정 확인, 빌드 성공, 테스트 통과, 사용자 흐름 확인, 비개발자용 결과 설명 완료)를 대조한다.
  2. 실제로 빌드/테스트/파일 변경을 확인하지 않고 "완료"라고 말하지 않는다 (`docs/02_PRODUCT_SPEC.md` "6. 검증 흐름"의 금지 표현: 증거 없이 "완료했습니다", 테스트 없이 "문제 없습니다", 확인 안 한 기능을 "작동합니다"라고 단정).
  3. 부족한 증거가 있으면 정확히 무엇이 부족한지, 다음에 뭘 확인해야 하는지 사용자에게 알린다.
  4. `Task Log.md`에 이번 작업 결과를 한 줄 추가한다.

### Checkout Meeting

- **언제**: 세션을 정리하고 다음 시작점을 저장할 때 (`finish_session` intent는 항상 여기로 고정)
- **산출**: 오늘 완료한 일/남은 일 요약 + 다음 세션 시작점.
- **실제로 할 일**:
  1. `docs/02_PRODUCT_SPEC.md` "7. 자동 체크아웃 흐름" 출력 형식대로 요약한다 — 완료한 일 / 아직 남은 일 / 다음 세션 시작점.
  2. `vault/10_Projects/{project}/Session Memory.md` 맨 위에 새 세션 블록을 **추가**한다(기존 기록은 절대 지우지 않는다) — 오늘 한 일 / 결정한 것 / 남은 일 / 다음 세션 시작점. "결정한 것"에는 해당 `[[ADR-XXXX-...]]`를 위키링크로 적는다.
  3. `Current State.md`의 현재 단계/최근 변경/다음 할 일을 갱신한다.
  4. `Project Home.md`의 완료 증거 상태와 다음 추천도 함께 갱신한다. "중요한 결정"/"최근 오류" 위키링크 규칙은 Orientation Meeting 3번과 동일하다.

## `null`인 경우 (7개 회의 중 어느 것도 아님)

`selectMeeting`이 `null`을 반환하면 회의를 억지로 열지 않는다. intent별로 다음 흐름으로 보낸다.

- `debug` → 회의가 아니라 오류 해결 흐름(`docs/02_PRODUCT_SPEC.md` "5. 오류 해결 흐름", Debugger 에이전트, `vault/30_Errors/ERR-template.md`)으로 라우팅한다.
- `continue_work` → 자동 체크인 흐름(`docs/02_PRODUCT_SPEC.md` "1. 자동 체크인 흐름")으로 라우팅해 `Current State.md`/`Session Memory.md`를 읽고 그냥 이어간다. 단, `stateHints.buildApproved === true`면 3단계 로직에 의해 이미 `build_readiness_meeting`으로 단락되므로 이 분기까지 오지 않는다.
- `explain_nondev` → 회의가 아니라 인라인 설명(Nondev Explainer: 몰라도 되는 것 / 알아야 하는 것 / 결정해야 하는 것 / 추천 / 이유)으로 답한다.
- `unknown` → 무엇을 원하는지 다시 묻는다. 절대 임의의 회의로 추측해서 넘어가지 않는다.

## 예시 (엔드투엔드)

입력: `"로그인 기능 붙여줘"`

```bash
# 1. 의도 분류 (경로는 따옴표 없이, 메시지 인자만 따옴표로 -- 1단계 참고)
node ${CLAUDE_PLUGIN_ROOT}/scripts/classify-intent.js "로그인 기능 붙여줘"
# -> add_feature

# 2. 상태 힌트 (신규 프로젝트라 state.json 없음 -> fail-closed. 인자 없는 스크립트라 경로를 따옴표로 감싸도 안전)
node "${CLAUDE_PLUGIN_ROOT}/scripts/state-store.js"
# -> {"valid":false,"reason":"missing"}
# => hasUnresolvedDecisions=true, buildApproved=false

# 3. 회의 선택 (stateHints 없이 -- add_feature 기본값이 이미 discovery_meeting)
node ${CLAUDE_PLUGIN_ROOT}/scripts/select-meeting.js "add_feature"
# -> discovery_meeting
```

4단계(라우팅 이벤트 기록)는 생략 가능하다 -- `hooks/scripts/handler.js`가 모든 훅 이벤트(이 UserPromptSubmit 포함)마다 이미 자동으로 `.senpai/event_logs.jsonl`에 기록하므로, `event-log.js`를 스킬에서 따로 또 호출하지 않아도 감사 추적은 이미 남는다.

→ Discovery Meeting을 연다. Unknown Map을 채우고, `docs/02_PRODUCT_SPEC.md`의 예시처럼 "이메일 로그인인가요, 소셜 로그인인가요? / 비밀번호 재설정이 필요한가요? / 사용자 정보는 어디에 저장하나요? / 첫 MVP에서 꼭 필요한가요?"를 물은 뒤 A/B/C/D 선택지를 제시한다.

## 알려진 제약

`classify-intent.js`, `select-meeting.js`, `state-store.js`, `doctor.js`는 모두 `require.main` CLI 블록을 가진 스크립트라 `node ${CLAUDE_PLUGIN_ROOT}/scripts/<name>.js [args]`로 바로 실행된다(경로를 상대경로 `scripts/<name>.js`가 아니라 `${CLAUDE_PLUGIN_ROOT}`로 가리키는 이유, 그리고 인자가 있을 때 경로를 따옴표로 감싸면 안 되는 이유는 1단계 참고) — **`node -e "require(...)..."` 형태는 절대 쓰지 않는다.** 임의 코드 실행이라 `scripts/scope-check.js`(G1)가 스크립트 이름과 무관하게 항상 차단한다.

**상대경로 `node scripts/<name>.js` 형태를 쓰지 않는다.** 이 저장소(플러그인 개발 저장소) 안에서는 우연히 동작하지만, `scripts/init.js`가 사용자 프로젝트에 `scripts/` 디렉토리를 복사하지 않으므로 실제 사용자 프로젝트에서는 항상 G1 fail-closed deny로 거부된다(라이브 재현 실측으로 확인됨). 이 거부는 Bash 호출 자체가 훅에 막혀 일어나므로 Node의 "Cannot find module" 에러조차 보이지 않고, 모델이 그 상황에서 스스로 절대경로로 재시도하는 것도 실측상 관측되지 않았다 — 그래서 위 예시들은 처음부터 `${CLAUDE_PLUGIN_ROOT}` 절대경로 형태로 문서화되어 있다.

`state-store.js`의 CLI 형태는 **읽기 전용**이다(`readState()`만 호출하고 인자는 전부 무시한다) — `approved_scope`/`allowed_files`를 실제로 켜는 것은 이 스킬도, 다른 어떤 스킬도 아니다. 그건 `scripts/senpai-approve.js`(사용자가 정확한 프로젝트 이름과 함께 `[senpai-go:{project}]` 문구를 직접 보낼 때만 `hooks/scripts/handler.js`의 `UserPromptSubmit` 처리 안에서 실행됨)만의 몫이다. Build Readiness 승인 흐름은 `skills/guided-plan/SKILL.md`를 참고한다.

`event-log.js`의 `appendEvent()`는 현재 Bash CLI 진입점이 없다 — 필수는 아니다. `hooks/scripts/handler.js`가 모든 훅 이벤트마다 이미 자동으로 로그를 남기므로, 이 스킬이 감사 추적을 위해 따로 더 호출할 필요는 없다.
