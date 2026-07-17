---
name: guided-plan
description: 사용자가 회의에서 숨은 결정을 다 정하고 "이제 만들어도 돼", "진행하자", "계획 짜줘"처럼 구현 진행을 승인했을 때 사용한다. 승인된 결정을 실행 가능한 Phase Plan.md(체크리스트 + 완료 증거)로 바꾸고, Build Gate 조건을 확인한 뒤 Builder에게 넘긴다. Build Readiness Meeting 직후, 또는 Decision Card가 전부 해결된 직후에 자동으로 이어진다.
disable-model-invocation: false
---

# Guided Plan

## 이 스킬은 무엇을 하는가

Guided Plan은 "결정은 끝났지만 아직 체크리스트는 없는" 상태를, "Builder가 그대로 집어 들 수 있는 계획"으로 바꾸는 스킬입니다.

입력은 대화 중에 쌓인 승인된 결정들이고, 출력은 `vault/10_Projects/{project}/Phase Plan.md` 한 장입니다. 이 스킬 자체는 제품 코드를 한 줄도 건드리지 않습니다. 계획을 쓰고, Build Gate 조건을 사용자에게 보여주고, 통과하면 Builder에게 넘기는 것까지가 이 스킬의 일입니다.

docs/00_CONCEPT.md의 "4. Plan Before Build" 원칙 그대로입니다: 승인된 계획 없이는 제품 코드를 수정하지 않고, 계획에는 반드시 체크리스트와 완료 증거 조건이 들어갑니다.

## 언제 열리는가

- Build Readiness Meeting에서 사용자가 범위에 동의했을 때 (docs/02_PRODUCT_SPEC.md "3. Build Readiness 흐름" 완료 직후)
- Decision Card / Discovery Meeting에서 남은 결정이 0개가 됐을 때
- 사용자가 "이제 만들자", "진행해도 돼", "계획 짜줘", "체크리스트 만들어줘"라고 말했을 때

아직 결정이 안 끝났다면 이 스킬을 열지 않습니다. 대신 사용자를 Discovery Meeting이나 Scope Meeting으로 돌려보냅니다. 미해결 결정이 남은 채로 Phase Plan을 쓰는 것은 이 스킬의 존재 이유를 무너뜨립니다.

## 절대 하지 않는 일

- 제품 코드(Write/Edit로 `src/`, `app/` 등 실제 구현 파일 수정) 를 직접 만지지 않습니다. 그건 Builder의 일입니다.
- Build Gate 9개 조건(첫 조건은 "Phase Plan.md가 실제로 `Write` 도구로 저장되어 있다")이 다 채워지기 전에 "이제 진행합니다"라고 사용자에게 말하지 않습니다. **특히 Phase Plan.md를 아직 저장하지 않았다면 `[senpai-go:...]` 승인 문구를 절대 먼저 보여주지 않습니다** — 이 순서가 뒤집혀(승인 문구부터 안내 → 승인 시도 실패 → 그제서야 계획 작성) 실제 라이브 세션에서 관측된 적이 있습니다.
- 계획에 없던 항목(새 의존성, 인증/결제/배포/데이터 삭제)을 체크리스트에 슬쩍 끼워 넣지 않습니다. 그런 항목이 필요하면 별도로 사용자에게 알리고 승인을 받습니다.
- `approval-gate.js`를 우회할 방법을 찾지 않습니다. 아래 "실제 집행자" 절을 보세요 — 이 스킬이 뭐라고 말하든 최종 결정권은 그 스크립트에 있습니다.

## 실행 절차

### 0단계 — 전제 조건 읽기

Phase Plan을 쓰기 전에 아래 파일들을 먼저 읽습니다. 없으면 그 자체가 신호입니다 (Build Gate 조건 미충족 → Build Readiness Meeting으로 돌아감).

- `vault/10_Projects/{project}/Project Brief.md` — 이 프로젝트가 뭘 하려는지
- `vault/10_Projects/{project}/Current State.md` — 지금 어느 단계인지
- `vault/10_Projects/{project}/Unknown Map.md` — 숨은 결정이 검토됐는지
- `vault/20_Decisions/Decision Index.md` — 관련 결정이 실제로 승인 상태인지

### 1단계 — 승인된 결정과 MVP 범위 모으기

대화와 Decision Index에서 다음을 정리합니다.

- 이번에 만들 것 (승인된 범위 안)
- 이번에 만들지 않을 것 (범위 밖으로 명시적으로 뺀 것)
- 남은 결정이 있다면 "지금은 미룬다"고 분명히 밝혀졌는지 확인 (`unresolved_decisions == 0 or explicitly_deferred`)

### 2단계 — Phase Plan.md 채우기

템플릿은 `vault-template/10_Projects/_template/Phase Plan.md`입니다. 그대로 복사해서 자리표시자만 채웁니다. 구조를 바꾸지 않습니다.

```markdown
---
type: phase_plan
project: {project}
phase: {phase}
status: active
allowed_files:
  - {file}
sensitive_files:
  - {file, only if it touches a require_approval_for category}
verification_commands:
  - {command}
---

# Phase Plan

## 목표

## 이번에 할 것

## 이번에 하지 않을 것

## 작업 체크리스트

- [ ]

## 완료 증거

- [ ]

## 승인 상태

- [ ] 사용자가 범위를 이해함
- [ ] 사용자가 진행을 승인함
```

채울 때 지킬 것:

- **프론트매터 `allowed_files`는 절대 빈 채로 두거나 자리표시자(`{file}`)를 남겨두지 않습니다.** 이 목록이 실제로 승인 시 Builder에게 열리는 파일 범위 그 자체입니다(`scripts/senpai-approve.js`가 이 프론트매터에서 직접 읽어갑니다 — 다른 곳에는 안 적어도 됩니다). "작업 체크리스트"에서 언급한 파일/경로를 그대로 한 줄씩 옮겨 적습니다. 아직 정확한 파일 경로를 모른다면(새 파일이라 등) 만들어질 경로를 최대한 구체적으로 추정해 적습니다 — "로그인 화면 만들기"처럼 뭉뚱그리지 않습니다.
- **프론트매터 `sensitive_files`는 `allowed_files` 중 `senpai.config.yaml`의 `require_approval_for` 카테고리(인증/로그인, 결제, 배포, DB 마이그레이션, 새 패키지 설치, 삭제성 작업)를 실제로 건드리는 파일만 골라 적습니다.** 해당하는 게 없으면 목록을 비워둡니다(자리표시자 줄 자체를 지웁니다). 여기 적힌 파일은 계획을 한 번에 승인해도 실제로 쓸 때 개별적으로 다시 막힙니다(T2 — 아래 4단계 참고) — 나머지 `allowed_files`는 계획 승인 한 번으로 자동 진행됩니다(T1). 아무 파일이나 조심스럽게 전부 여기 적지 않습니다 — 매번 재확인이 필요한 진짜 민감한 항목만 골라야, 나머지 평범한 파일들이 계획 승인 시점에 이미 확인받은 대로 매끄럽게 진행됩니다. **참고**: `package.json`/`Dockerfile`/`*.sql`나 경로에 `auth`/`payment`/`migration`/`deploy` 등이 들어간 파일은 여기 안 적어도 `scripts/scope-check.js`가 코드 차원에서 자동으로 T2로 취급합니다(모델이 빠뜨려도 걸리는 최소 바닥선) — 이 필드는 그 바닥선 위에 항목을 "더" 추가하는 용도이지, 바닥선에 걸린 파일을 빼내는 용도가 아닙니다.
- **프론트매터 `verification_commands`도 비워두지 않습니다.** "완료 증거"를 실제로 확인할 수 있는 명령이 있다면(`npm run build`, `node tests/unit/foo.test.js` 등) 여기에 적습니다. **이 명령은 자동으로 실행되지 않습니다** — 안전장치가 임의 명령의 자동 실행을 절대 허용하지 않기 때문에(보안 검토로 확인됨: `npm`/`node` 같은 실행기는 그 자체로 임의 코드를 실행할 수 있어 어떤 승인 절차로도 자동 실행을 안전하게 만들 수 없습니다), evidence-loop 단계에서 **사용자에게 이 명령을 직접 실행해달라고 요청하고 결과를 전달받는** 용도로만 쓰입니다. 확인할 명령이 마땅치 않으면 목록을 비우지 말고 `- (없음, 사용자가 직접 확인)`처럼 명시적으로 적습니다.
- **작업 체크리스트**는 사람이 읽는 목록입니다. "로그인 화면 만들기"처럼 뭉뚱그리지 말고, Builder가 어떤 파일/영역을 건드릴지 알 수 있을 만큼 구체적으로 씁니다. `allowed_files` 프론트매터와 내용이 어긋나지 않게 합니다. 체크리스트 항목 하나하나는 나중에 Builder가 중간 보고를 하는 경계이기도 합니다(아래 "만드는 동안 Builder는 이렇게 중간 보고를 합니다" 참고) — 항목을 너무 크게 뭉치면 보고도 그만큼 뜸해집니다.
- **완료 증거**는 "느낌"이 아니라 실제로 확인 가능한 조건이어야 합니다. docs/02_PRODUCT_SPEC.md의 예시를 기준으로 삼습니다: "빌드 성공", "설정값 저장", "앱 재시작 후 값 유지"처럼, 나중에 `vault/10_Projects/{project}/Verification.md` 표에 한 줄로 옮겨 적을 수 있는 문장으로 씁니다.
- **승인 상태** 두 체크박스는 실제로 사용자가 이해했다고 확인하고 진행을 승인한 뒤에만 체크합니다. 미리 체크해두지 않습니다.
- **목표** 섹션에서는 이 계획이 근거한 문서를 위키링크로 언급합니다 — 예: `[[10_Projects/{project}/Unknown Map]]`에서 확인된 결정을 바탕으로, `[[ADR-XXXX-...]]`를 따라 이번 범위를 정함. 프로젝트별 문서는 경로 포함, ADR은 그대로 링크합니다 (`obsidian-brain-update/SKILL.md` "위키링크로 연결하기" 참고).

### 3단계 — Write 도구로 실제 저장

Phase Plan은 제품 코드가 아니라 하네스 자체의 작업 기억(Obsidian Vault)입니다. 그래서 `scripts/approval-gate.js`가 지키는 PreToolUse 관문의 제품-코드 승인 체크는 거치지 않고, `Write` 도구로 `vault/...` 경로에 바로 씁니다 (`scripts/scope-check.js`가 `vault/`를 build 승인과 무관하게 항상 허용 — `skills/meeting-system/SKILL.md` "5단계" 참고). secret 경로 쓰기 거부와 덮어쓰기 전 자동 백업(`.senpai/backups/`)은 이 허용 판단과 같은 자리(`scope-check.js`)에서 자동으로 처리되므로, 이 스킬이 따로 챙길 필요가 없습니다.

```
Write 도구:
  file_path: vault/10_Projects/<project-name>/Phase Plan.md
  content: <채워 넣은 Phase Plan 내용>
```

이 단계는 아직 `approved_scope`가 true가 아니어도 실행할 수 있습니다 — docs/03_TECHNICAL_SPEC.md "3.3 Guided Plan"이 금지하는 것은 "계획 단계의 제품 코드 수정"이지 Vault 문서 작성이 아닙니다.

### 4단계 — Build Gate 조건 확인하고 사용자에게 보여주기

**이 단계를 시작하기 전에 먼저 확인하세요: 3단계의 `Write` 도구 호출을 이미 실제로 실행했습니까?** `vault/10_Projects/{project}/Phase Plan.md`가 아직 디스크에 저장되지 않았다면 이 4단계로 넘어가지 말고 2~3단계로 돌아가 저장부터 완료하세요. **`[senpai-go:{project}]` 승인 문구는 Phase Plan.md가 실제로 저장된 뒤에만 사용자에게 보여줍니다.** 승인 문구를 먼저 안내하고 계획은 나중에 쓰는 순서(또는 승인 시도가 실패해야 그제서야 계획을 쓰는 순서)는 이 스킬의 설계를 위반합니다 — 실제 라이브 세션에서 정확히 이 역전(승인 문구부터 안내 → 1차 승인 시도 실패("Phase Plan을 아직 작성/저장하지 않았습니다") → 그제서야 Phase Plan.md 작성)이 재현된 적이 있습니다.

체크리스트로 확인하세요 (순서대로, 하나라도 안 됐으면 다음 항목으로 넘어가지 않습니다):

- [ ] `Write` 도구로 `vault/10_Projects/{project}/Phase Plan.md`를 실제로 저장했다 (2~3단계)
- [ ] 저장한 Phase Plan의 프론트매터에 `allowed_files`가 비어 있지 않다
- [ ] 그 다음에만 아래 "Build Gate" 절의 9개 조건을 하나씩 짚어 사용자에게 보여준다
- [ ] 9개가 전부 채워졌을 때만 Build Gate 요약과 `[senpai-go:{project}]` 문구를 사용자에게 보여준다

하나라도 비었으면 어느 조건이 왜 안 됐는지 말하고, 해당 회의(Discovery/Scope/Build Readiness)로 돌아갑니다.

출력 예시:

```md
# 이 계획대로 진행해도 되는지 확인합니다

이번 Phase에서 만들 것:
- 온보딩 화면
- 일일 목표 시간 설정
- 로컬 저장

이번에 만들지 않을 것:
- 로그인 / 서버 / 결제 / 배포

완료로 인정하는 기준:
- 빌드 성공
- 설정값 저장
- 앱 재시작 후 값 유지

완료 확인 단계에서 직접 실행해서 결과를 알려주시게 될 명령(자동 실행되지 않습니다):
- npm run build

민감 항목(승인 후에도 실제로 쓸 때 각각 따로 한 번 더 확인이 필요합니다):
- src/auth.ts (로그인 처리)

Build Gate 상태: 9/9 통과
Phase Plan 저장 위치: vault/10_Projects/my-app/Phase Plan.md

이대로 진행해도 괜찮으면, 채팅창에 아래 문구를 정확히 그대로 입력해서 승인해 주세요.
다른 말(예: "네", "좋아요", "진행해줘")로는 실제 승인이 기록되지 않습니다.

[senpai-go:my-app]
```

("민감 항목" 줄은 `sensitive_files`가 비어 있으면 통째로 생략합니다.)

**이 안내 문구는 절대 생략하지 않습니다.** `[senpai-go:{project}]` — 대괄호 안 프로젝트 이름을 지금 이 Phase Plan의 `project`(= `vault/10_Projects/{project}/` 폴더명)로 정확히 채워 보여줍니다. 이 문구는 사람이 직접 채팅으로, 정확한 프로젝트 이름과 함께 보낼 때만 `scripts/senpai-approve.js`가 인식하는 유일한 승인 신호입니다(대화 속 "네", "좋아요" 같은 자연어는 절대 승인으로 인식되지 않습니다 — G2 정책). 다른 프로젝트 이름을 넣거나 대괄호를 빼면 승인되지 않습니다. 이 문구를 사용자에게 알려주지 않으면, Build Gate를 아무리 잘 보여줘도 사용자는 무엇을 입력해야 진행되는지 알 방법이 없습니다.

사용자가 `[senpai-go:...]` 형태의 문구를 보낸 직후, 다음 사용자 메시지 앞에 하네스가 승인 성공/실패 결과를 자동으로 알려줍니다(`additionalContext`로 주입됨). 실패 메시지는 왜 안 됐는지(allowed_files 비어 있음, 프로젝트 이름 불일치 등)와 함께 **지금 정확히 보내야 할 문구를 그대로 다시 알려줍니다** — 그 문구를 그대로 복사해 보내달라고 안내하면 됩니다. `allowed_files`/`sensitive_files` 프론트매터를 고쳤다면 2단계로 돌아가 Phase Plan을 다시 저장한 뒤 안내합니다.

**민감 항목(T2)은 `[senpai-go:...]` 승인만으로는 실제로 쓰이지 않습니다.** Builder가 `src/auth.ts`처럼 표시된 파일을 실제로 쓰려고 하면 하네스가 그 시도를 막고, 정확히 어떤 문구를 보내야 하는지(`[senpai-touch:my-app:src/auth.ts]` 형태) 사유에 담아 알려줍니다. Builder는 이 거부를 받으면 사용자에게 "이 파일은 민감 항목이라 따로 한 번 더 확인이 필요합니다, 아래 문구를 보내주세요"라며 그 정확한 문구를 그대로 전달해야 합니다 — 이 스킬이 4단계에서 미리 목록으로 보여준 것과 같은 파일들이므로, 사용자가 원하면 Build Gate 확인 직후 `[senpai-go:...]`와 함께 해당 `[senpai-touch:...]` 문구들도 미리 보내둘 수 있다고 안내해도 됩니다(순서는 상관없음 — `[senpai-touch:...]`는 이미 scope가 승인된 뒤에만 유효합니다).

### 5단계 — Agent 도구로 Builder 서브에이전트를 실제로 스폰

사용자가 최종 승인하면(`[senpai-go:{project}]` 처리 성공 확인 후), **이 스킬을 실행하는 최상위 대화 루프가 직접 제품 코드를 고치지 않고, Agent 도구로 Builder 서브에이전트를 실제로 스폰합니다.** "Builder에게 넘깁니다"는 프로즈 설명이 아니라 실제 도구 호출입니다 — 과거 라이브 검증에서 이 문구가 프로즈에 그쳐 최상위 세션이 서브에이전트 위임 없이 제품 코드를 직접 Edit한 사례가 관측된 적이 있으므로, 그 편차가 다시 재현되지 않도록 아래 호출을 그대로 실행합니다.

```
Agent 도구 호출:
  subagent_type: senpai-harness:builder-runtime
  prompt에 반드시 담을 것:
    1. Phase Plan 경로 — vault/10_Projects/{project}/Phase Plan.md
    2. 승인된 작업 범위 — Phase Plan "작업 체크리스트" 항목 그대로
       (= 프론트매터 allowed_files와 정확히 일치하는 파일 범위.
       이 목록 밖의 파일/기능은 건드릴 수 없다는 점을 명시)
    3. 완료 증거 기준 — Phase Plan "완료 증거" 목록
       (Evidence Reviewer가 나중에 이 기준으로 확인함)
    4. 금지 항목 — 새 의존성 설치, 인증/결제/배포/데이터 삭제는
       계획에 명시적으로 없으면 여전히 금지라는 점
```

(`agents/builder-runtime.md` frontmatter의 `name: builder-runtime`, `tools: Read, Grep, Glob, Write, Edit, Bash`가 스폰 대상의 실체입니다. `skills/parallel-council/SKILL.md` "2단계"가 위원 소집 시 Task 프롬프트를 실제로 구성해 호출하는 것과 같은 방식으로, 여기서도 프롬프트를 실제로 구성해 호출합니다 — 위임을 말로만 서술하고 끝내지 않습니다.)

이 스킬 자신은 "절대 하지 않는 일"에 적힌 대로 `src/`, `app/` 등 제품 코드를 Write/Edit로 건드리지 않습니다. 실제 제품 코드 Write/Edit/Bash는 스폰된 `senpai-harness:builder-runtime` Agent만 수행하며, 그 Agent가 시도하는 모든 Write/Edit/Bash는 스폰 여부와 무관하게 여전히 `scripts/approval-gate.js`가 PreToolUse 훅으로 가로채 `allowed_files`/`sensitive_files`와 대조합니다(아래 "실제 집행자는 누구인가" 절 그대로 — 스폰이 안전을 대신하지 않고, `allowed_files` 대조가 여전히 최종 안전장치입니다).

이 스킬의 역할은 여기서 끝납니다. 실제 코드 작성부터는 스폰된 `senpai-harness:builder-runtime`(탐색 → 구현 → 필요 시 원인분석을 하나로 통합한 실행 에이전트, `docs/02_PRODUCT_SPEC.md` "4. Guided Work 흐름"의 Project Explorer → Builder → Debugger 역할)가 이어받습니다.

### 만드는 동안 Builder는 이렇게 중간 보고를 합니다

이 부분은 Builder의 일이지만, 계획을 승인하기 전에 사용자가 미리 알아두면 좋은 것이라 여기 적습니다. 승인 후 Builder가 실제로 만드는 동안에는 (`agents/builder-runtime.md` "빌드 중 판단 규칙 — 선배의 4단 판정" 참고):

- **체크리스트 항목 하나가 끝날 때마다**, 그 항목에서 "알아서 정한 것"(구현 세부, 기술 관례 수준의 선택)을 **최대 3줄**로 묶어 쉬운 말로 보고합니다.
- 이 보고는 **답을 기다리지 않습니다** — 알려드리고 다음 항목으로 계속 진행하는 게 기본이고, 계획에서 벗어나는 신호가 감지될 때만 멈춥니다. 물론 보고에 답하시면(되돌려 달라거나, 왜 그랬는지 묻거나) Builder가 그에 맞춰 움직입니다.
- 보고 줄은 세션이 끝날 때 `Session Memory.md`에 그대로 남습니다 — 나중에 "그때 왜 그렇게 됐지?"를 되짚을 수 있습니다.
- 이 보고는 승인된 범위 **안에서의** 판단을 알리는 것이지, 파일 접근 승인(`[senpai-go:...]`)을 다시 묻는 게 아닙니다 — 한 번 승인된 범위는 그대로 유효합니다.

4단계에서 Build Gate를 보여줄 때, 원하면 "만드는 동안 항목이 끝날 때마다 짧은 중간 보고를 드립니다"라고 한 줄로 함께 안내해도 좋습니다. 이 중간 보고 흐름은 프롬프트 지침으로만 돌아갑니다 — 보고 누락이 실제로 관찰되기 전에는 훅 같은 코드 장치로 강제하지 않습니다(`agents/builder-runtime.md` 같은 절 참고).

## Build Gate — 통과해야 하는 9개 조건

원본 yaml (`vault-template/90_System/Build Gates.md`, 동일 내용이 설계 문서에도 있음):

```yaml
build_gate:
  require:
    - Phase Plan.md written (Write 도구로 실제 저장 완료)
    - Project Brief exists
    - Current State known
    - MVP Scope exists
    - Unknown Map reviewed
    - unresolved_decisions == 0 or explicitly_deferred
    - user_approval == true
    - minimality_ladder_passed == true
    - verification_target_exists == true
```

**첫 조건("Phase Plan.md written")은 다른 8개보다 먼저 확인합니다** — 이 조건이 비어 있으면 나머지 8개를 아무리 채워도 사용자에게 승인 문구를 보여줄 수 없습니다(승인 문구는 Phase Plan 프론트매터에서 `allowed_files`를 읽어가므로, 파일이 없으면 승인 자체가 기록되지 않습니다 — 아래 "실제 집행자" 절 참고).

각 조건이 실제로 무엇을 확인하는지:

| 조건 | 무엇을 보고 판단하는가 |
| --- | --- |
| Phase Plan.md written | `vault/10_Projects/{project}/Phase Plan.md`가 이번 세션에서 `Write` 도구로 실제로 저장되어 있음(3단계). 아직이면 승인 문구를 보여주지 않고 2~3단계로 돌아갑니다. |
| Project Brief exists | `vault/10_Projects/{project}/Project Brief.md` 존재 |
| Current State known | `vault/10_Projects/{project}/Current State.md`에 현재 단계가 적혀 있음 |
| MVP Scope exists | Phase Plan의 "이번에 할 것 / 하지 않을 것"이 채워짐 |
| Unknown Map reviewed | `Unknown Map.md`의 "이번 회의에서 결정할 것" 항목이 처리됨 |
| unresolved_decisions == 0 or explicitly_deferred | `20_Decisions/Decision Index.md`에 열린 결정이 없거나, 미룬다고 명시됨 |
| user_approval == true | 사용자가 이 범위로 진행해도 좋다고 말로 확인함 |
| minimality_ladder_passed == true | Minimality Ladder 7단계를 거쳤음 ([[Minimality Ladder]] 참고) |
| verification_target_exists == true | Phase Plan "완료 증거"가 구체적으로 채워짐 |

이 9개는 docs/06_HOOKS_SPEC.md의 PreToolUse 차단 조건("사용자 승인 전 제품 코드 수정 금지", "계획 밖 파일 수정 금지")이 실제로 무엇을 막으려는 것인지를 구체화한 목록입니다. Guided Plan 스킬은 이 9개를 대화 속에서 확인하고 보여주는 역할이고, 실제로 코드 쓰기를 막거나 허용하는 것은 다음 절의 스크립트입니다.

## 실제 집행자는 누구인가 — approval-gate.js

**중요: 이 스킬이 "9/9 통과했습니다, 진행하세요"라고 말하는 것과, 실제로 Builder의 Write/Edit/Bash가 허용되는 것은 별개입니다.**

이 스킬은 대화를 안내할 뿐, 코드 쓰기를 실제로 막거나 여는 것은 `scripts/approval-gate.js`(`handlePreToolUse`)입니다. 이 스크립트는 PreToolUse Hook에서 모든 Write/Edit/Bash 호출마다 실행되며, 세 가지를 조합해 최종 판단합니다.

1. `scripts/state-store.js#readState()` — `.senpai/state.json`에 실제로 저장된 승인 상태 (모델이 "승인됐다"고 말한 것이 아니라, 디스크에 쓰인 값)
2. `scripts/scope-hash.js#computeScopeHash()` — `allowed_files` 목록이 승인 시점 그대로인지 (승인 후에 몰래 바뀌면 `scope_drift`로 거부)
3. `scripts/scope-check.js#checkToolCall()` — 대상 파일이 `allowed_files` 안에 있는지, secret 경로는 아닌지 등 G1~G4 규칙

즉 이 스킬이 아무리 완벽하게 9개 조건을 확인했다고 말해도, `.senpai/state.json`에 `session_id`, `approved_scope: true`, `allowed_files`, 그리고 그 목록과 일치하는 `scope_hash`가 실제로 기록되어 있지 않으면 `approval-gate.js`는 무조건 `deny`합니다 (fail-closed, G4). 이 스킬은 Phase Plan을 쓰고 사용자 승인을 받아내는 대화 절차이고, `.senpai/state.json`을 실제로 갱신하는 것은 이 스킬의 책임 밖입니다 — 사용자가 `[senpai-go:{project}]`를 정확한 프로젝트 이름과 함께 보내면 `scripts/senpai-approve.js#recordApproval`이 (1) 대괄호 안 이름이 이 Phase Plan의 실제 프로젝트와 일치하는지 먼저 확인하고, (2) 일치하면 프론트매터의 `allowed_files`/`sensitive_files`/`verification_commands`를 직접 읽어 State Store에 씁니다. 이 스킬은 그 프론트매터가 실제 승인 시점에 읽힐 유일한 소스라는 사실과, 무엇을 입력해야 그 트리거가 발동하는지를 사용자에게 정확히 알리는 것까지만 합니다.

`allowed_files`가 비어 있거나(프론트매터를 채우지 않고 저장한 경우) 대괄호 안 프로젝트 이름이 안 맞으면 `recordApproval`은 아무것도 쓰지 않고 조용히 `null`을 반환합니다 — 승인 자체가 아예 기록되지 않으므로, 2단계에서 프론트매터를 반드시 채워야 하는 이유가 이것입니다.

**승인 이후 재확인 등급(T0~T3)도 이 스크립트가 정합니다.** `scripts/scope-check.js`는 `allowed_files` 중 `sensitive_files`(+ 코드에 내장된 최소 바닥선, 위 2단계 참고)에도 걸리는 파일은 실제로 쓸 때 `deny`로 막고 `[senpai-touch:{project}:{file}]` 문구를 사유에 담아 알려주며, 그 외 나머지 `allowed_files`는 계획 승인 한 번으로 `allow`(자동 진행, 재확인 없음)합니다. 이전 설계는 이 재확인을 Claude Code의 네이티브 허용 팝업(`ask`)에 맡겼는데, 실세션 검증에서 `permissions.defaultMode: acceptEdits`가 켜진 환경에서는 그 팝업 자체가 뜨지 않는다는 게 확인돼(G2 정책 문서 참고) `deny`+채팅 문구 방식으로 교체됐습니다 — `deny`와 채팅 캡처는 권한 모드와 무관하게 항상 작동합니다. 즉 이 스킬이 2단계에서 `sensitive_files`를 정확히 골라 적는 것이, 사용자가 실제로 어떤 파일에서 개별 확인을 요구받을지를 결정합니다(코드 바닥선에 걸리는 파일은 안 적어도 자동으로 걸림) — 아무렇게나 비워두면 바닥선 밖의 다른 민감 파일이 자동 진행될 수 있고, 아무렇게나 다 채우면 평범한 설정 파일까지 매번 재확인을 요구해 사용자를 지치게 만듭니다.

## Phase Plan 쓰기와 제품 코드 쓰기는 완전히 다른 경로입니다

혼동하기 쉬운 지점이라 다시 한번 분리해서 적습니다.

- **Phase Plan.md 쓰기** → `Write` 도구로 `vault/...` 경로에 직접 → Obsidian Vault 문서일 뿐이라 `approval-gate.js`의 제품-코드 승인 체크를 거치지 않음(백업/secret 차단은 `scope-check.js`가 여전히 적용) → 계획 단계에서, `approved_scope`가 아직 false여도 가능
- **제품 코드 쓰기 (Builder)** → Write/Edit/Bash → PreToolUse Hook → `approval-gate.js` → `.senpai/state.json`에 `approved_scope: true`가 실제로 기록돼 있어야만 통과

Guided Plan 스킬은 첫 번째 경로만 사용합니다. 두 번째 경로는 절대 대신 열어주지 않습니다.

## 막혔을 때

- **결정이 아직 안 끝남**: Phase Plan을 쓰지 않고 Discovery Meeting/Scope Meeting으로 돌아갑니다.
- **Phase Plan.md를 아직 저장하지 않았는데 승인 문구를 보여줄 뻔함**: 지금 멈추고 3단계(`Write` 도구 호출)부터 실제로 완료하세요. 승인 문구는 그 다음에만 보여줍니다.
- **Build Gate 9개 중 일부 미충족**: 어느 조건이 왜 비었는지 말하고, 그 조건을 채울 수 있는 이전 회의로 돌아갑니다. 억지로 다음 단계로 넘기지 않습니다.
- **사용자가 계획 도중 마음을 바꿈**: Phase Plan을 덮어쓰기 전에 `scope-check.js`가 자동 백업하므로, 이전 버전은 `.senpai/backups/`에서 복구할 수 있다고 안내합니다.
- **하네스 상태가 이상해 보임**: `node scripts/doctor.js`로 `.senpai/state.json`과 vault 구조가 정상인지 먼저 확인하라고 안내합니다.
