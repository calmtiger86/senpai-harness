---
name: parallel-council
description: 회의를 연 직후, 요청이 얼마나 불명확하거나 위험한지에 따라 여러 역할의 위원 에이전트를 한 번에 병렬로 소집해 서로 다른 관점의 검토 카드를 모으고, 그 결과를 "여러 관점으로 먼저 확인하겠습니다" 형식으로 종합한 뒤 unknown-map/decision-card로 넘기는 스킬. guided-auto-drive의 "Council 소집" 단계(회의 직후, 숨은 결정 드러내기 직전)에서 호출된다. 소집 여부와 위원 명단은 이 스킬이 임의로 정하지 않고 scripts/select-parallel-council.js(단일 진실 소스)가 결정한다. discovery_council(새 프로젝트/브레인스토밍/미해결 결정이 남은 기능 추가), safety_council(인증·결제·개인정보·배포·데이터 삭제·외부 비용 같은 위험 신호), debug_council(같은 오류 3회 이상 반복)일 때만 실제로 병렬 스폰하고, small_council/fast_single_agent이면 스폰하지 않고 그대로 넘긴다.
disable-model-invocation: false
---

# Parallel Council

## 이 스킬의 역할

`docs/07_MODEL_ROUTING_SPEC.md`의 "Parallel Council Router"를 최상위 대화 루프에서 실제로 실행하는 스킬입니다. 회의가 열린 직후, 요청의 불확실성·위험도에 맞는 여러 역할(위원)을 **한 메시지 안에서 동시에 병렬로** 불러 각자의 관점으로 검토하게 하고, 그 결과를 사용자에게 쉬운 말로 종합한 뒤 다음 단계(숨은 결정 드러내기)로 넘깁니다.

이 병렬 소집의 주체는 **훅 넛지 + 최상위 대화 루프**입니다(`docs/07_MODEL_ROUTING_SPEC.md`의 "Parallel Council Router"·"Single Writer Principle", 실제 소집·명단 결정 로직은 순수 함수 `scripts/select-parallel-council.js`). 위원 에이전트(`agents/*.md`)에는 Task 도구가 없어 스스로 다른 에이전트를 소집하지 못합니다 — 병렬 소집은 항상 **최상위 대화 루프인 이 스킬**이 Task 도구로 직접 합니다.

이 스킬은 **소집 여부와 위원 명단을 스스로 지어내지 않습니다.** 그 결정은 `scripts/select-parallel-council.js`(순수 함수, 감사·재현 가능한 단일 진실 소스)의 몫이고, 이 스킬은 그 결정을 실행할 뿐입니다. 또한 이 스킬은 **어떤 제품 파일도 쓰지 않습니다** — 위원 소집은 전부 읽기 전용 자문이고, 실제 코드 쓰기는 별도의 Single Writer 승인 경로(`docs/SAFETY_ENFORCEMENT_POLICY.md`)로만 일어납니다.

## 언제 실행하는가

- `skills/guided-auto-drive/SKILL.md` 위임표의 **"2.5 Council 소집"** 단계 — 즉 `meeting-system`으로 회의를 연 직후, `unknown-map`으로 숨은 결정을 드러내기 **직전**.
- 그 시점에 이미 분류된 의도(`scripts/classify-intent.js`의 라벨)를 가지고, 아래 1단계로 어떤 Council 모드인지부터 확인합니다.

`fast_single_agent`(대부분의 일반 요청)나 `small_council`(숨은 결정이 이미 다 끝난 기능 추가)이면 **병렬 스폰을 하지 않습니다** — 새 정보 없이 지연만 늘기 때문입니다(`scripts/select-parallel-council.js`의 규칙 5 주석 근거: "a parallel spawn ... would only add latency"). 이 경우 이 스킬은 아무 위원도 부르지 않고 곧바로 다음 단계로 넘깁니다.

## 실행 절차

### 1단계 — 어떤 Council 모드이고 누구를 부를지 확인

소집 모드와 위원 명단(`agents`)은 `scripts/select-parallel-council.js`가 결정합니다. 확인하는 방법:

**(a) handler.js Council 넛지에 mode·agents가 담겨 오면 그대로 씁니다.** 훅이 인프로세스에서 위험 신호/오류 반복까지 포함해 결정을 내려 넛지에 실어 보낸 경우(`docs/06_HOOKS_SPEC.md` UserPromptSubmit 넛지 패턴, D1), 그 `mode`와 `agents` 목록을 신뢰해 그대로 사용합니다.

**(b) 넛지에 모드가 실려 오지 않았다면(예: 회의 dispatch 넛지를 받아 guided-auto-drive를 거쳐 여기 온 경우), 의도로 직접 조회합니다.** `select-meeting.js`와 똑같이 CLI로 실행합니다 — guided-auto-drive 1단계에서 이미 분류해 둔 의도 라벨을 인자로 넘깁니다.

```bash
node scripts/select-parallel-council.js "add_feature"
# -> {"mode":"discovery_council","agents":["unknown-detector","product-strategist","risk-guardian","minimality-guardian"],"user_approval":"required","escalation":"strong_reasoning"}
```

이 CLI는 **의도 하나만** 인자로 받습니다. 두 번째 인자로 signals JSON을 함께 넘기면(`"add_feature" '{...}'`처럼 따옴표 영역이 2개 이상) `scripts/scope-check.js`의 secret-check(`hasUnresolvableSyntax`, round-3 연결 우회 방지)가 무조건 차단합니다 — `select-meeting.js`와 완전히 같은 제약입니다. `node -e "require(...)"` 형태의 임의 실행도 `scope-check.js`(G1)가 항상 막으므로 절대 쓰지 않습니다. 위 CLI 형태만 씁니다.

**의도만으로는 나오지 않는 두 모드(위 CLI의 한계).** 위험/반복 신호는 훅이 인프로세스에서만 결정론적으로 계산하므로, 의도만 넘긴 CLI는 절대 `safety_council`이나 `debug_council`을 반환하지 않습니다. (a)의 넛지가 그 결정을 실어 오지 않았다면, 아래 두 우선 규칙을 이 스킬이 직접 적용해 모드를 올립니다(우선순위는 `select-parallel-council.js` 주석의 결정 테이블 그대로 — 위험이 1순위로 모든 것을 앞섭니다):

- **위험 신호가 있으면 → `safety_council`.** 요청이 다음 6개 범주 중 하나라도 건드리면 CLI가 무엇을 반환했든 `safety_council`로 취급합니다: 인증/로그인, 결제, 개인정보, 배포, 데이터 삭제, 외부 유료 비용. (판별 근거는 `scripts/select-parallel-council.js`의 `RISK_KEYWORD_PATTERNS` 6범주.)
- **같은 오류가 3번째 이상 반복이면 → `debug_council`.** `vault/30_Errors/`의 관련 `ERR-*.md`에서 `recurrence_count`가 2 이상이면(이번이 3번째 이상) `debug_council`로 취급합니다. (`scripts/select-parallel-council.js`의 `readErrorRecurrence`가 읽는 것과 같은 값.)

여기서 모드를 모델이 판단해도 안전한 이유: Council 소집은 **읽기 전용 자문**이라 어떤 파일도 쓰지 못하고, 실제 위험한 쓰기(인증/결제/삭제/배포)는 이 판단과 무관하게 항상 `scripts/scope-check.js`·`scripts/approval-gate.js`가 실제 쓰기 시점에 결정론적으로 막습니다. 즉 여기서 정하는 것은 "누구에게 미리 물어볼까"뿐, 권한이 아닙니다.

각 모드의 위원 명단(단일 진실 소스: `scripts/select-parallel-council.js`, 이름은 `agents/*.md`와 그대로 일치):

| 모드 | 병렬 스폰 위원(읽기 전용) | 승인 |
|---|---|---|
| `safety_council` | `risk-guardian`, `skeptic`, `product-strategist`, `evidence-reviewer` | 무조건 필수 |
| `debug_council` | `debugger`, `memory-librarian`, `project-explorer`, `skeptic` | 범위 변경 시 |
| `discovery_council` | `unknown-detector`, `product-strategist`, `risk-guardian`, `minimality-guardian` | 필수 |
| `small_council` | 없음(병렬 스폰 안 함 — 기존 순차 경로) | 만들기 전 |
| `fast_single_agent` | 없음(병렬 스폰 안 함) | 선택 |

`agents` 목록이 비어 있으면(`small_council`/`fast_single_agent`) 여기서 멈추지 말고 아무 위원도 부르지 않은 채 곧바로 guided-auto-drive의 다음 단계(숨은 결정 드러내기 또는 오류 해결 흐름)로 넘어갑니다.

### 2단계 — 각 위원에게 보낼 Task 프롬프트 구성

명단의 위원마다 Task 도구로 보낼 프롬프트를 만듭니다. 각 위원 에이전트(`agents/*.md`)에는 "## Council 출력 계약" 절이 있으니 그 입력 계약을 그대로 채웁니다.

담아야 할 것:

1. **사용자 요청 요약 — 원문 그대로.** 요약하거나 의역하지 않습니다(위원 계약의 "입력" 규칙). 사용자가 실제로 한 말을 그대로 전달해야 위원들이 같은 사실을 봅니다.
2. **관련 vault 문서 경로(있으면).** 내용을 통째로 붙여넣지 말고 **경로만** 넘깁니다 — 위원은 읽기 도구(`Read`, `Grep`, `Glob`)가 있으니 필요하면 직접 읽습니다. 예: `vault/10_Projects/{project}/Current State.md`, `vault/10_Projects/{project}/Unknown Map.md`, 관련 `vault/20_Decisions/ADR-*.md`, `debug_council`이면 관련 `vault/30_Errors/ERR-*.md`.
3. **되돌려 받을 형식 상기.** "읽기 전용으로, 당신 역할 고유 관점의 짧은 카드 한 장(판단 / 근거 / 권고)만 돌려달라"고 명시합니다(각 위원의 Council 출력 계약과 동일). 위원은 파일을 쓰지도, 더 하위 에이전트를 부르지도 않습니다.

프롬프트에 담지 않는 것: 모델 이름/티어, 다른 위원의 답(위원끼리 서로 보지 않고 독립적으로 판단해야 관점이 겹치지 않습니다), 결정 자체(위원은 선택지를 제시할 뿐 결정하지 않습니다).

### 3단계 — 한 메시지 안에서 병렬로 호출 (순차 금지)

명단의 모든 위원을 **하나의 응답 turn 안에서 여러 Task 블록으로 동시에** 호출합니다. 이것이 Claude Code의 네이티브 병렬 tool-call 메커니즘이고, D1이 말하는 "최상위 루프가 스폰 주체"의 실제 형태입니다.

- 올바름: 한 메시지에 Task 4개(예: `risk-guardian`, `skeptic`, `product-strategist`, `evidence-reviewer`)를 나란히 넣어 동시에 보냄.
- 틀림: Task 하나 호출 → 결과 기다림 → 다음 Task 호출 (순차). 이러면 병렬이 아니고, 앞 위원의 답이 뒤 위원에게 새어 관점이 오염됩니다.

각 Task의 대상은 명단의 위원 이름과 그대로 일치하는 에이전트입니다(`agents/{위원이름}.md`).

### 4단계 — 결과를 "여러 관점으로 먼저 확인하겠습니다" 형식으로 종합

위원들의 카드가 모두 돌아오면, `docs/07_MODEL_ROUTING_SPEC.md` "사용자에게 보여주는 방식"의 출력 형식으로 종합합니다. **모델 이름은 절대 노출하지 않고 역할명(관점)만** 씁니다.

```md
# 여러 관점으로 먼저 확인하겠습니다

1. 기획 관점: 이 기능이 지금 필요한지 확인
2. 기술 관점: 기존 코드로 가능한지 확인
3. 위험 관점: 보안이나 데이터 문제가 있는지 확인
4. 최소 구현 관점: 더 작은 버전이 가능한지 확인

결과를 모아서 선택지로 정리하겠습니다.
```

각 위원의 카드를 그 역할에 맞는 "관점" 줄로 옮깁니다(고정 4개가 아니라 **이번에 실제로 부른 위원 수만큼**):

- `product-strategist` → 기획 관점
- `project-explorer` → 기술 관점
- `risk-guardian` → 위험 관점
- `minimality-guardian` → 최소 구현 관점
- `unknown-detector` → 숨은 결정 관점
- `skeptic` → 반론/의심 관점
- `evidence-reviewer` → 증거 관점
- `debugger` → 오류 원인 관점
- `memory-librarian` → 과거 기억 관점

위원들의 결론이 서로 다르면 억지로 하나로 합치지 말고, 그 긴장을 종합에 솔직히 드러냅니다("기술 관점에서는 지금 가능하지만 위험 관점에서는 개인정보 저장이 걸립니다").

**Nondev Explainer는 별도 위원으로 부르지 않습니다.** `discovery_council` 명단에는 Nondev Explainer가 없습니다 — 이 4단계의 "쉬운 말 종합" 자체가 최상위 대화 루프가 Nondev Explainer 역할을 대신 수행하는 것입니다(`docs/07_MODEL_ROUTING_SPEC.md`의 해당 정정 각주 참고). 마찬가지로 Builder는 어떤 Council에서도 부르지 않습니다(Single Writer 원칙).

### 5단계 — 종합 결과를 다음 스킬로 넘기기

종합한 관점들은 결정을 대신 내리는 게 아니라, "그래서 무엇을 정해야 하는지"를 사용자가 고를 수 있게 다음 스킬로 넘깁니다. `skills/meeting-system/SKILL.md`가 하위 스킬에 위임하는 것과 같은 방식(Skill 도구 호출)으로 넘깁니다.

- `discovery_council` / `safety_council` → Skill 도구로 **`unknown-map`**을 호출해 위원들이 드러낸 숨은 결정을 `vault/10_Projects/{project}/Unknown Map.md`에 기록하게 하고, 이어서 **`decision-card`**로 그 항목을 A/B/C/D 선택지 카드로 만들게 합니다. `safety_council`이면 위험 관점을 카드의 "추천 이유" 앞머리에 분명히 드러냅니다.
- `debug_council` → 회의/결정 카드 대신 오류 해결 흐름(`docs/02_PRODUCT_SPEC.md` "5. 오류 해결 흐름", Debugger)으로 종합을 넘깁니다. 해결 후에는 `skills/error-to-playbook/SKILL.md`가 `ERR-*.md`/Playbook을 갱신합니다.

이 스킬이 직접 Unknown Map이나 Decision Card, ADR을 쓰지 않습니다 — 그 작업은 위임받은 스킬(`unknown-map`, `decision-card`)이 자기 절차대로 합니다.

## 이 스킬이 절대 하지 않는 것

- 제품 파일을 쓰지 않습니다. Council 소집은 전부 읽기 전용 자문입니다.
- `builder`/`builder-runtime`를 위원으로 부르지 않습니다(Single Writer 원칙 — `scripts/select-parallel-council.js`가 이 불변식을 코드로 강제하고 테스트가 검증합니다).
- 위원을 순차로 부르지 않습니다. 반드시 한 메시지 안에서 병렬로 부릅니다.
- 모델 이름/티어를 사용자에게 노출하지 않습니다. 역할명만 씁니다.
- 소집 모드나 위원 명단을 임의로 지어내지 않습니다 — `scripts/select-parallel-council.js`의 결정을 따릅니다.
- `.senpai/state.json`의 승인 필드(`approved_scope`/`allowed_files`/`scope_hash`)를 건드리지 않습니다. 승인은 Build Readiness에서 사용자가 `[senpai-go:{project}]`를 보낼 때 `scripts/senpai-approve.js`만 기록합니다.
