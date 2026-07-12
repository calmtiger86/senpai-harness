---
name: unknown-map
description: 사용자가 "기능 붙여줘/추가해줘/만들어줘", "새 앱/새 프로젝트 만들고 싶어" 같은 요청을 할 때, 겉으로 안 보이는 숨은 결정(제품 방향/사용자 흐름/데이터 저장/로그인·인증/개인정보·보안/배포·운영/검증 기준)을 찾아내 프로젝트의 Unknown Map.md에 정리·기록한다. classify-intent.js가 add_feature/start_project를 감지해 Discovery Meeting으로 이어질 때, Decision Card를 만들거나 구현을 시작하기 전에 반드시 먼저 실행한다. 이 스킬은 결정을 대신 내리거나 코드를 구현하지 않는다 — 아직 안 정해진 것을 드러내고 기록하는 것까지만 한다.
disable-model-invocation: false
---

# Unknown Map

## 이 스킬의 역할

사용자가 "기능 붙여줘" "이거 만들어줘"라고 말하면, 겉으로는 버튼 하나처럼 보여도 실제로는 여러 결정이 함께 딸려 옵니다. 이 스킬은 그 숨은 결정을 놓치지 않고 캐내서, 사용자가 모르는 채로 AI가 마음대로 정해버리는 일을 막습니다. (`docs/00_CONCEPT.md` 1번째 철학 "Ask Before Build")

이 스킬은 **구현하지 않습니다.** 결정을 대신 내리지도 않습니다. 오직 "무엇을 아직 안 정했는지"를 정리해서 `Unknown Map.md`에 적고, 다음 단계(Decision Card)로 넘길 재료를 만드는 것까지가 역할입니다.

## 언제 실행하는가

- `scripts/classify-intent.js`의 `classifyIntent(userMessage)`가 `add_feature` 또는 `start_project`를 반환했을 때
- `scripts/select-meeting.js`의 `selectMeeting(intent, stateHints)`가 `discovery_meeting`(또는 `hasUnresolvedDecisions: false`로 `scope_meeting`)을 반환했을 때
- 사용자가 큰 방향 전환을 요청했는데 아직 Decision Record가 없을 때
- 이미 있는 프로젝트에서 사용자가 "이것도 확인해줘" "뭐가 걸려있는지 봐줘"라고 직접 요청할 때(수동 트리거)

바로 코드를 고치거나 파일을 만들기 시작했다면, 그건 이 스킬을 건너뛴 것입니다. 반드시 먼저 이 스킬부터 돌리세요.

## 실행 절차

### 1단계 — 사용자가 말한 것을 그대로 옮기기

사용자의 요청 문장을 각색하지 말고 원문 그대로 `Unknown Map.md`의 "사용자가 말한 것" 섹션에 넣을 준비를 합니다. 이 스킬은 사용자의 말을 해석하기 전에 먼저 있는 그대로 기록합니다.

### 2단계 — 10개 확인 범주로 숨은 결정 캐내기

`docs/04_AGENT_SPEC.md`의 Unknown Detector가 정의한 10개 확인 범주(`vault-template/90_System/Unknown Detector.md`의 체크리스트와 동일)를 하나씩 스스로 질문해봅니다.

1. **제품 방향** — 이 요청이 전체 제품 목적과 맞는가, 지금 꼭 필요한가
2. **사용자 흐름** — 사용자가 실제로 어떤 순서/화면으로 쓰게 되는가
3. **데이터 저장** — 무엇을 어디에 어떤 형태로 저장하는가
4. **로그인/인증** — 로그인이 필요한가, 이메일인가 소셜인가
5. **결제** — 결제가 관련되는가, 안전장치가 필요한가
6. **개인정보** — 개인정보를 다루는가, 어디까지 수집/보호하는가
7. **플랫폼 제한** — 웹/모바일/OS 등 사용 환경 제약이 있는가
8. **배포** — 언제 어떻게 배포하는가(또는 아직 안 하는가)
9. **유지보수** — 나중에 누가 어떻게 고치고 관리하는가
10. **검증 기준** — "완료"라고 말할 수 있는 기준이 무엇인가

10개를 전부 확인할 필요는 없지만, 건너뛴 범주가 있다면 그 이유를 반드시 사용자에게 말해야 합니다 (`vault-template/90_System/Unknown Detector.md` 마지막 규칙).

### 3단계 — 10개 범주를 `Unknown Map.md`의 7개 섹션으로 정리하기

실제로 파일에 적히는 `Unknown Map.md`(템플릿: `templates/unknown-map.md`, `vault-template/10_Projects/_template/Unknown Map.md`)는 아래 7개 섹션만 씁니다. 2단계에서 나온 내용을 이 표대로 옮겨 담습니다.

| 파일에 쓰는 섹션 | 2단계 범주 매핑 |
|---|---|
| 제품 방향 | 제품 방향, 플랫폼 제한 |
| 사용자 흐름 | 사용자 흐름 |
| 데이터 저장 | 데이터 저장, 결제(결제 데이터가 있다면) |
| 로그인/인증 | 로그인/인증 |
| 개인정보/보안 | 개인정보, 결제(안전장치 관련) |
| 배포/운영 | 배포, 유지보수 |
| 검증 기준 | 검증 기준 |

각 섹션에는 사용자에게 물어야 할 질문 형태로 짧게 적습니다. 확정된 답이 아니라 "아직 모르는 것"만 적는 곳입니다 — 이미 결정된 것은 여기 넣지 않고 Decision Record로 넘어간 상태입니다.

### 4단계 — hidden_decisions / risk_candidates / decision_questions 만들기

`docs/04_AGENT_SPEC.md`가 요구하는 세 출력물을 정리합니다. 이건 파일에 그대로 저장하는 별도 파일이 아니라, 다음 단계(Decision Card 생성)에 바로 넘길 작업 중간 산출물입니다.

- `hidden_decisions`: 사용자가 몰랐던 결정 목록 (3단계에서 채운 항목들)
- `risk_candidates`: 그중 잘못 정하면 되돌리기 어렵거나 위험한 것 (예: 개인정보 수집 범위, 결제 연동)
- `decision_questions`: 사용자에게 실제로 물어볼 질문 목록 — 너무 많이 묻지 말고, "이번 회의에서 결정할 것" 1~3개로 추립니다

### 5단계 — `Unknown Map.md` 파일 쓰기

대상 경로는 `vault/10_Projects/<프로젝트 폴더명>/Unknown Map.md` 입니다.

- 프로젝트 폴더가 이미 있으면 기존 파일을 읽어 이어서 갱신합니다(새로 결정된 항목은 지우고, 새로 드러난 항목만 추가) — `Write`는 파일 전체를 덮어쓰므로, 먼저 `Read`로 기존 내용을 확인한 뒤 이어서 갱신한 전체 내용을 다시 씁니다.
- 프로젝트 폴더가 아직 없으면(최초 Discovery Meeting) `vault-template/10_Projects/_template/`의 구조를 참고해서 같은 이름의 폴더를 만들고, 그 안에 `Unknown Map.md`를 새로 씁니다.
- `vault/10_Projects/{project}/Project Brief.md`가 이미 있으면(Orientation Meeting을 먼저 거친 경우), "사용자가 말한 것" 섹션에서 `[[10_Projects/{project}/Project Brief]]`로 링크해 원래 요청과 연결합니다(경로 포함 — `obsidian-brain-update/SKILL.md` "위키링크로 연결하기" 참고). 아직 없으면 링크할 것이 없으니 그냥 넘어갑니다.

`Unknown Map.md`는 제품 코드가 아니라 하네스 자체의 작업 기억(Obsidian Vault)입니다. 그래서 `scripts/approval-gate.js`가 지키는 제품-코드 승인 체크는 거치지 않고, `Write` 도구로 `vault/...` 경로에 바로 씁니다 (`scripts/scope-check.js`가 `vault/`를 build 승인과 무관하게 항상 허용 — `skills/guided-plan/SKILL.md` "3단계 — Write 도구로 실제 저장" 참고). secret 경로 쓰기 거부와 덮어쓰기 전 자동 백업(`.senpai/backups/`)은 이 허용 판단과 같은 자리(`scope-check.js`)에서 자동으로 처리되므로, 이 스킬이 따로 챙길 필요가 없습니다.

```
Write 도구:
  file_path: vault/10_Projects/<프로젝트 폴더명>/Unknown Map.md
  content: <채워 넣은 Unknown Map.md 전체 내용>
```

만약 이 `Write` 호출이 거부되면(대상 경로가 시크릿으로 분류된 경우) 대상 경로를 다시 확인하세요 — 절대 우회하지 않습니다.

### 6단계 — "아직 모르는 것"의 최신 상태는 `Unknown Map.md`로 확인하기

`.senpai/state.json`의 `unresolved_decisions` 필드는 현재 어떤 스킬에서도 쓸 수 있는 경로가 없습니다 — `scripts/state-store.js`의 `writeState()`는 CLI 진입점이 없고, 이를 우회하려고 `node -e "..."`로 임의 코드를 실행하는 것은 `docs/SAFETY_ENFORCEMENT_POLICY.md` G1 정책상 항상 차단됩니다. 이건 이 스킬만의 문제가 아니라 하네스 전체에 걸쳐 이미 별도로 추적 중인 갭이므로, 이 스킬이 대신 새 우회 경로를 만들지 않습니다.

그래서 "지금 뭐가 아직 안 정해졌는지"의 실질적인 기록은 `state.json`이 아니라 5단계에서 이미 저장한 `Unknown Map.md` 그 자체입니다. `select-meeting.js`의 `hasUnresolvedDecisions` 판단이 필요할 때(또는 이 스킬이 다시 열릴 때)는, `.senpai/state.json`을 갱신하는 대신 `Unknown Map.md`의 "아직 모르는 것" / "이번 회의에서 결정할 것" 섹션을 다시 읽어서 무엇이 풀렸고 무엇이 남았는지 그때그때 확인하세요.

결정이 실제로 나면(Decision Record 작성 후) 해당 항목을 `Unknown Map.md`의 "아직 모르는 것"에서 제거하세요. 그대로 두면 이미 끝난 결정을 계속 "아직 모르는 것"이라고 사용자에게 반복해서 묻는 꼴이 됩니다.

### 7단계 — 사용자에게 넘기기 (Decision Card로 핸드오프)

이 스킬은 `Unknown Map.md`를 쓰는 데서 끝납니다. `decision_questions`를 골라 실제 선택지 카드로 바꾸는 것은 `templates/decision-card.md` 형식을 쓰는 다음 단계(오케스트레이터 / Decision Card 생성)의 몫입니다. 이 스킬을 마칠 때는 사용자에게 아래처럼 짧게 알려주고 넘기세요.

```
숨은 결정 몇 가지를 찾았어요. Unknown Map에 정리해뒀고,
곧 선택할 수 있는 카드로 보여드릴게요.
```

## 실전 예시 — "로그인 기능 붙여줘"

`docs/02_PRODUCT_SPEC.md` "새 기능 요청 흐름"의 예시와 동일한 입력입니다.

1. `classifyIntent("로그인 기능 붙여줘")` → `add_feature` (패턴 `/기능\s*붙여/` 매칭)
2. `selectMeeting("add_feature", { hasUnresolvedDecisions: true })` → `discovery_meeting`
3. 10개 범주 확인 결과 → 아래처럼 나옵니다.

- 제품 방향: 로그인이 지금 버전에 꼭 필요한가, 나중에 추가해도 되는가
- 사용자 흐름: 이메일 로그인인가 소셜 로그인인가, 비밀번호 재설정 흐름이 필요한가
- 데이터 저장: 사용자 정보(이메일, 비밀번호 등)를 어디에 저장하는가
- 로그인/인증: 로그인 상태를 얼마나 유지하는가
- 개인정보: 비밀번호를 안전하게 암호화해서 저장하는가, 개인정보처리방침이 필요한가
- 배포: 소셜 로그인을 쓰면 카카오/구글 개발자 센터에 앱 등록과 키 발급이 필요한데 지금 준비 가능한가
- 검증 기준: "로그인이 완료됐다"고 말할 기준(로그인 성공/실패 표시, 새로고침해도 상태 유지 등)이 무엇인가

4. 이걸 `Unknown Map.md` 7개 섹션에 옮기면 이렇게 됩니다.

```md
---
type: unknown_map
project: 카페알바시프트
status: active
updated: 2026-07-03
---

# Unknown Map

## 사용자가 말한 것

로그인 기능 붙여줘

## 아직 모르는 것

### 제품 방향

- 로그인이 지금 버전(MVP)에서 꼭 필요한 기능인가요, 나중에 추가해도 되는 기능인가요?

### 사용자 흐름

- 이메일로 로그인하나요, 카카오/구글 같은 소셜 로그인인가요?
- 비밀번호를 잊어버렸을 때 다시 설정하는 흐름이 필요한가요?

### 데이터 저장

- 사용자 정보(이메일, 비밀번호 등)는 어디에 저장하나요?

### 로그인/인증

- 로그인 상태를 얼마나 오래 유지할 건가요?

### 개인정보/보안

- 비밀번호는 암호화해서 저장하나요?
- 개인정보처리방침이 필요한가요?

### 배포/운영

- 소셜 로그인을 쓰면 카카오/구글 개발자 센터에 앱을 등록하고 키를 발급받아야 하는데, 지금 준비할 수 있나요?

### 검증 기준

- "로그인 기능이 완료됐다"고 말할 수 있는 기준은 무엇인가요?

## 이번 회의에서 결정할 것

1. 로그인 없이 MVP 먼저 만들지, 로그인부터 넣을지
2. 이메일 로그인인지 소셜 로그인인지
3. 사용자 정보를 어디에 저장할지
```

5. `hidden_decisions` / `risk_candidates` / `decision_questions`는 다음 단계로 넘어갑니다.

```
hidden_decisions: [MVP 포함 여부, 로그인 방식, 데이터 저장 위치, 비밀번호 재설정 여부]
risk_candidates: [비밀번호 저장 방식(암호화 누락 시 보안 사고), 개인정보처리방침 누락]
decision_questions: [
  "로그인 없이 MVP 먼저 만들까요, 로그인까지 포함할까요?",
  "이메일 로그인과 소셜 로그인 중 어느 쪽으로 할까요?"
]
```

6. 사용자에게는 `docs/02_PRODUCT_SPEC.md`에 나온 것과 같은 형태로 요약해 보여주고(추천: "첫 버전에서는 로그인 없이 시작하는 것을 추천합니다"), Decision Card 단계로 넘깁니다.

## 지켜야 할 것

- 사용자 승인 없이 결정을 대신 내리지 않습니다. 이 스킬은 질문을 만드는 것이지, 답을 정하는 것이 아닙니다.
- 위험할 수 있는 범주(개인정보, 결제, 데이터 손실)는 절대 조용히 넘어가지 않습니다.
- `Unknown Map.md`는 `Write` 도구로 `vault/10_Projects/<프로젝트 폴더명>/Unknown Map.md` 경로에 씁니다. 기존 파일이 있으면 먼저 읽어서 이어서 갱신하고, 그대로 덮어써서 기존 내용(과거 회의에서 남은 미결 항목)을 날리지 않습니다.
- 이미 Decision Record로 해결된 항목은 "아직 모르는 것"에 남겨두지 않습니다. 남겨두면 사용자가 같은 질문을 반복해서 받게 됩니다.
- 이 스킬 다음에는 절대 바로 코드를 수정하지 않습니다. Decision Card → 사용자 선택 → Decision Record → Build Readiness Meeting 순서를 건너뛰지 않습니다 (`docs/02_PRODUCT_SPEC.md` "새 기능 요청 흐름").
