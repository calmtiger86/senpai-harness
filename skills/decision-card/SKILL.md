---
name: decision-card
description: Turns unresolved items from a project's Unknown Map.md into a Decision Card -- a plain-language multiple-choice card (요청/왜 결정이 필요한가/선택지 A-D/추천/추천 이유/이 결정을 하면 바뀌는 것/확인 질문) shown to a non-developer before any build work starts. Invoke this right after the unknown-map skill runs (or once scripts/classify-intent.js detects add_feature/start_project and Unknown Map.md already has entries under "이번 회의에서 결정할 것") and before Build Readiness. Presents four sequential perspectives (기획/기술/위험/최소구현) per card as a lightweight council-of-one, complementing the meeting-level parallel-council skill that already spawns real committee agents at the earlier Council 소집 step. Once the user picks an option, records it as a Decision Record (ADR) via the Write tool under vault/ and clears it from Unknown Map.md (state.json's unresolved_decisions has no reachable writer yet) -- it never writes approved_scope or allowed_files itself; that grant only ever happens through Claude Code's native permissionDecision:"ask" prompt at actual Bash/Write time (scripts/approval-gate.js).
disable-model-invocation: false
---

# Decision Card

## 이 스킬의 역할

`unknown-map` 스킬이 "아직 뭘 모르는지"를 캐냈다면, 이 스킬은 그중 하나를 골라 "그래서 무엇을 선택할지"를 사람이 읽을 수 있는 카드로 바꿉니다. 겉보기엔 버튼 하나지만 실제로는 여러 갈래로 갈리는 결정을, A/B/C/D 중 하나를 고르면 되는 형태로 좁혀주는 것이 이 스킬의 전부입니다 (`docs/00_CONCEPT.md` 철학 2·3번 "Explain Before Decide", "Decide Before Plan").

이 스킬은 **결정을 대신 내리지 않습니다.** 추천은 하지만 선택은 항상 사용자 몫입니다. 그리고 이 스킬은 **승인 플래그를 켜지 않습니다** — 사용자가 고른 결과를 기록만 하지, `.senpai/state.json`의 `approved_scope`를 직접 뒤집지 않습니다. 그 이유는 아래 "절대 하지 않는 일" 섹션에서 자세히 다룹니다.

## 언제 실행하는가

- `vault/10_Projects/<프로젝트>/Unknown Map.md`의 "이번 회의에서 결정할 것" 목록에 항목이 하나라도 남아 있을 때
- `scripts/state-store.js`의 `readState().unresolved_decisions` 배열이 비어 있지 않을 때
- `scripts/select-meeting.js`가 `discovery_meeting` 또는 `scope_meeting`을 반환했고, Unknown Map 작성이 이미 끝난 직후
- 사용자가 Decision Card에서 "D. 더 쉽게 설명해달라고 하기"를 골라 재설명을 요청했을 때 (같은 카드를 다시 만듦)

아직 Unknown Map 자체가 없다면 이 스킬을 건너뛰지 말고 먼저 `unknown-map` 스킬부터 실행하세요. 결정할 것이 정리되지 않은 채로 카드부터 만들면 선택지가 부실해집니다.

## 실행 절차

### 1단계 — Unknown Map에서 결정 항목 하나 꺼내기

`Unknown Map.md`의 "이번 회의에서 결정할 것" 목록에서 **한 번에 하나씩** 처리합니다. 여러 개를 한 카드에 욱여넣지 않습니다 — 사용자가 한 번에 소화할 수 있는 선택은 하나입니다 (`docs/02_PRODUCT_SPEC.md`의 "understanding_state: overloaded" 방지).

목록에 여러 항목이 있으면 가장 근본적인 것(다른 결정에 영향을 주는 것)부터 고릅니다. 예: "로그인을 넣을지 말지"가 "이메일이냐 소셜이냐"보다 먼저입니다 — 전자가 정해져야 후자가 의미 있어지기 때문입니다.

### 2단계 — 4개 관점을 순서대로 채우기 (council-of-one)

`docs/07_MODEL_ROUTING_SPEC.md` "사용자에게 보여주는 방식"은 다음처럼 4관점을 사용자에게 보여주라고 정합니다. 회의 단계의 병렬 자문(`parallel-council` 스킬, guided-auto-drive의 "2.5 Council 소집")은 이번 요청 **전체**에 대해 한 번 열리지만, 개별 Decision Card 하나하나까지 위원을 다시 병렬 스폰하는 것은 과합니다 — 게다가 `small_council`/`fast_single_agent` 경로에서는 애초에 병렬 스폰이 없었습니다. 그래서 이 단계에서는 **한 에이전트가 순서대로 4개 역할의 렌즈를 바꿔 쓰며**(council-of-one) 카드마다 짧은 메모를 채웁니다. 곧장 "추천"으로 건너뛰지 않습니다 — 이 4줄이 없으면 회의처럼 보이지 않고 그냥 AI가 혼자 정한 것처럼 보입니다.

사용자에게 먼저 이렇게 알립니다 (문서 예시 그대로):

```
여러 관점으로 먼저 확인하겠습니다

1. 기획 관점: 이 기능이 지금 필요한지 확인
2. 기술 관점: 기존 코드로 가능한지 확인
3. 위험 관점: 보안이나 데이터 문제가 있는지 확인
4. 최소 구현 관점: 더 작은 버전이 가능한지 확인

결과를 모아서 선택지로 정리하겠습니다.
```

그다음 실제로 4개 메모를 순서대로 채웁니다. 각 관점은 `docs/04_AGENT_SPEC.md`의 해당 에이전트 책임을 그대로 빌려 씁니다.

1. **기획 관점 (Product Strategist 렌즈)** — 이 결정이 지금 MVP 목표와 맞는가, 뒤로 미뤄도 되는가. (`docs/04_AGENT_SPEC.md` §4)
2. **기술 관점 (Project Explorer 렌즈)** — 기존 코드/설정으로 되는가, 새 의존성이나 외부 서비스가 필요한가. 제품 코드를 고치지는 않고 "가능한가"만 확인합니다. (§6)
3. **위험 관점 (Risk Guardian 렌즈)** — 인증/결제/개인정보/데이터 삭제/배포/외부 비용처럼 되돌리기 어려운 요소가 섞여 있는가. (§13)
4. **최소 구현 관점 (Minimality Guardian 렌즈)** — Minimality Ladder 7단계 중 어디서 걸리는가, 더 작은 버전으로 먼저 검증할 수 있는가. (§5, `vault-template/90_System/Minimality Ladder.md`)

4개 메모가 서로 다른 결론을 가리키면 억지로 하나로 합치지 말고, 그 긴장 자체를 "추천 이유"에 솔직히 씁니다. (예: "기술적으로는 지금 가능하지만, 위험 관점에서는 개인정보 저장이 걸려서 최소 구현을 추천합니다.")

### 3단계 — Decision Card 조립하기

`templates/decision-card.md` 구조를 그대로 채웁니다. 이 카드는 **파일로 저장하지 않습니다** — vault에 남는 건 사용자가 고른 뒤의 ADR뿐이고, 카드 자체는 채팅에만 보여주는 일회용 결과물입니다.

```md
# 결정이 필요합니다

## 요청

## 왜 결정이 필요한가

## 선택지

A.
B.
C.
D. 더 쉽게 설명해달라고 하기

## 추천

## 추천 이유

## 이 결정을 하면 바뀌는 것

## 확인 질문
```

채우는 규칙:

- **요청**: 사용자가 원래 한 말 그대로 (Unknown Map "사용자가 말한 것"과 동일 원문).
- **왜 결정이 필요한가**: 1단계에서 고른 항목을 비개발자 언어로. "겉으로는 ~처럼 보이지만 실제로는 아래 결정이 함께 생깁니다" 톤 (`docs/02_PRODUCT_SPEC.md` 예시 참고).
- **선택지 A~C**: 실질적으로 다른 결과를 내는 선택지 2~3개. 사용자가 고른 뒤 실제로 다른 파일/범위가 만들어져야 하므로, 애매하게 겹치는 선택지를 만들지 않습니다.
- **선택지 D**: 항상 고정 문구 "더 쉽게 설명해달라고 하기". 절대 다른 내용으로 바꾸지 않습니다.
- **추천**: 2단계 4관점 메모를 종합한 A/B/C 중 하나. 없는 경우("정말 다 비슷하다")는 드물게만 인정합니다.
- **추천 이유**: 4관점 메모 중 결정적이었던 것 1~2개를 짧게. 모델 이름이나 내부 에이전트 이름은 언급하지 않고 "기획/기술/위험/최소구현 관점에서 보면" 식으로만 씁니다 (`docs/07_MODEL_ROUTING_SPEC.md` "모델 이름을 노출하지 않는다").
- **이 결정을 하면 바뀌는 것**: 이후 Build Readiness에서 "이번에 만들 것 / 만들지 않을 것"에 실제로 반영될 내용을 미리 알려줍니다.
- **확인 질문**: 기본값 "이 방향으로 진행할까요?". 구체적인 대상이 있으면 "이 방향으로 로그인 기능을 만들까요?"처럼 좁혀도 됩니다.

### 4단계 — 사용자에게 카드 제시

조립한 마크다운을 그대로 채팅에 출력합니다. 추가 설명을 덧붙이지 않고, 카드 자체가 충분히 설명적이어야 합니다.

### 5단계 — 사용자 답변 받기

답변을 해석하는 규칙은 엄격합니다.

- 사용자가 **A/B/C/D 중 하나로 명확히 식별되는 답**(글자, 번호, 혹은 선택지 문구를 그대로 반복하는 문장)을 주면 → 6단계로 진행합니다.
- 사용자가 **D**(또는 "모르겠다", "무슨 말이야")를 고르면 → ADR을 만들지 않습니다. 2단계 메모를 더 쉬운 말로 풀어 같은 결정을 다시 카드로 만들고(필요하면 `non-dev-output:explain-by-analogy` 스킬을 빌려 비유로 설명), 4단계로 되돌아갑니다.
- 답변이 **애매하면**(A/B/C 어디에도 명확히 안 들어맞음, 여러 선택지를 동시에 언급함, "다 좋아" 같은 무의미한 답) → 절대 임의로 하나를 골라서 진행하지 않습니다. "A, B, C 중 어느 쪽에 가장 가까운가요?"처럼 좁혀서 다시 묻습니다. 이 판단 하나가 나중에 `allowed_files`에 무엇이 들어갈지를 결정하므로, 프로즈만 보고 짐작하는 것은 여기서 가장 위험한 지점입니다 (`docs/SAFETY_ENFORCEMENT_POLICY.md` G2).

### 6단계 — 결정을 ADR(Decision Record)로 기록하기

사용자의 선택이 확정되면 `templates/decision-record.md` 구조로 채웁니다.

```md
---
type: decision
project: {project}
status: accepted
created: {YYYY-MM-DD}
impact: {low|medium|high}
---

# ADR-{번호} {짧은 제목}

## 결정

## 이유

## 선택지

### A

### B

### C

## 선택한 안

## 영향

## 다시 검토할 시점

## 관련 노트
```

채우는 규칙:

- **번호**: `vault/20_Decisions/`에 있는 기존 `ADR-XXXX-*.md` 파일명에서 가장 큰 번호를 찾아 +1, 4자리로 0-padding. 가장 처음이면 `0001`.
  ```bash
  ls vault/20_Decisions/ADR-*.md 2>/dev/null | sed -E 's/.*ADR-([0-9]{4})-.*/\1/' | sort -n | tail -1
  ```
- **파일명**: `ADR-{번호}-{짧은 영문 kebab-case 슬러그}.md` (예: `ADR-0001-login-scope.md`). 슬러그는 결정 주제를 짧은 영단어로 — 파일명은 어떤 OS에서도 안전해야 하므로 한글/공백을 그대로 쓰지 않습니다.
- **impact**: 결정 주제가 아니라 **사용자가 실제로 고른 선택지**의 되돌리기 난이도로 정합니다. `docs/04_AGENT_SPEC.md` §13 Risk Guardian 차단 대상(인증/결제/배포/DB/개인정보/외부 비용)을 **지금 실제로 만들기로 한 선택**이면 `high` (예: "B. 이메일 로그인까지 포함하기"를 골랐다면 비밀번호 저장이 바로 생기므로 `high`). 같은 주제라도 **미루거나 빼기로 한 선택**(예: "A. 로그인 없이 MVP 먼저 만들기")은 위험 요소를 아직 만들지 않았으므로 한 단계 낮춰 `medium`. 사용자 흐름·저장 방식처럼 되돌리기 번거로운 선택은 `medium`, 문구·UI처럼 쉽게 되돌릴 수 있는 선택은 `low`.
- **결정 / 이유**: Decision Card의 "확인 질문"에 대한 사용자의 답 + "추천 이유"를 합쳐 씁니다.
- **선택지 A/B/C**: Decision Card의 선택지를 그대로 옮깁니다 (D는 재설명용이라 ADR에는 남기지 않습니다).
- **선택한 안**: 사용자가 실제로 고른 글자와 그 내용.
- **영향**: Decision Card의 "이 결정을 하면 바뀌는 것"을 그대로.
- **다시 검토할 시점**: 있으면 적고, 없으면 비워둡니다 ("MVP 이후 재검토" 등).
- **관련 노트**: `[[10_Projects/{project}/Unknown Map]]`처럼 프로젝트 경로를 포함해 백링크합니다 (`obsidian-brain-update/SKILL.md` "위키링크로 연결하기" 참고).

작성한 내용은 `Write` 도구로 `vault/20_Decisions/ADR-{번호}-{슬러그}.md` 경로에 바로 씁니다. `scripts/scope-check.js`는 `vault/` 아래 경로를 build 승인 여부와 무관하게 항상 허용하므로(Obsidian Brain 축은 회의 중 자유롭게 갱신되는 것이 설계 의도 — `docs/SAFETY_ENFORCEMENT_POLICY.md` G2 참고), 이 스킬이 따로 승인을 기다리거나 다른 스크립트를 거칠 필요가 없습니다. 기존 파일을 덮어쓸 때의 백업과 시크릿 경로 차단은 같은 자리(`scope-check.js`)에서 자동으로 처리됩니다.

```
Write 도구:
  file_path: vault/20_Decisions/ADR-0001-login-scope.md
  content: <채워 넣은 ADR 내용>
```

에러가 나면(시크릿 경로 등) 대상 경로를 재확인하고 절대 다른 방법으로 우회하지 않습니다.

### 7단계 — Decision Index 갱신

`vault/20_Decisions/Decision Index.md`는 모든 프로젝트의 ADR을 모아 보여주는 표입니다 (`docs/05_OBSIDIAN_VAULT_SPEC.md` "자동 업데이트 규칙"에 명시된 필수 갱신 대상). `Read` 도구로 기존 내용을 읽어 표에 한 줄을 추가한 뒤, 합쳐진 전체 내용을 `Write` 도구로 같은 경로에 다시 씁니다. 이 경로도 `vault/` 아래이므로 6단계와 같은 이유로 build 승인 없이 바로 쓸 수 있습니다. `번호` 칸에는 숫자만 적지 않고 `[[ADR-000N-{슬러그}]]` 위키링크 전체를 적어, 표에서 바로 ADR 본문으로 이동할 수 있게 합니다.

```
Read 도구:
  file_path: vault/20_Decisions/Decision Index.md

Write 도구:
  file_path: vault/20_Decisions/Decision Index.md
  content: <기존 표 + 새 줄 "| [[ADR-0001-login-scope]] | 로그인 범위 결정 | 카페알바시프트 | accepted | 2026-07-03 |">
```

### 8단계 — Unknown Map에서 지우기 (unresolved_decisions는 아직 쓸 수 없음)

`unknown-map` 스킬은 결정이 나면 해당 항목을 지우는 일을 이 단계로 명시적으로 넘겨둡니다. 실제로 정리할 수 있는 것은 한 곳뿐입니다.

1. `vault/10_Projects/{project}/Unknown Map.md`를 `Read` 도구로 읽어, "이번 회의에서 결정할 것" 목록과 "아직 모르는 것"의 해당 하위 항목을 지운 뒤(번호 목록이면 다시 매김), 합쳐진 전체 내용을 `Write` 도구로 같은 경로에 다시 씁니다. 이 경로도 `vault/` 아래이므로 6~7단계와 같은 이유로 바로 쓸 수 있습니다.

   ```
   Read 도구:
     file_path: vault/10_Projects/{project}/Unknown Map.md

   Write 도구:
     file_path: vault/10_Projects/{project}/Unknown Map.md
     content: <해결된 항목을 지운 전체 내용>
   ```

2. `.senpai/state.json`의 `unresolved_decisions` 필드는 이 스킬을 포함해 어떤 스킬에서도 아직 쓸 방법이 없습니다 — `scripts/state-store.js`의 `writeState()`는 CLI 진입점이 없고, 이는 별도로 추적 중인 알려진 한계이지 이 스킬이 우회해서 해결할 문제가 아닙니다. "아직 안 정한 게 몇 개 남았나"의 실제 근거는 방금 정리한 `Unknown Map.md`의 내용 그 자체이므로, 이후 남은 결정 개수가 필요하면 `state.json`을 참고하지 말고 `Unknown Map.md`를 다시 읽습니다.

두 가지 중 실제로 실행 가능한 것은 1번뿐입니다. 그 외 `state.json`의 다른 필드도 건드리지 않습니다 (9단계 참고).

### 9단계 — 이벤트 로그는 따로 남기지 않아도 됩니다

이 스킬이 지금까지 실행한 모든 `Write`/`Bash` 호출은 `hooks/scripts/handler.js`가 모든 훅 호출마다 자동으로 `.senpai/event_logs.jsonl`에 기록합니다(`{hook_event_name, tool_name, file_path, command, content}`) — 이 스킬이 따로 챙길 일이 없습니다. `scripts/event-log.js`의 `appendEvent()`는 CLI 진입점이 없어 이 스킬에서 직접 호출할 수도 없습니다.

이 결정이 실제로 내려졌다는 내구성 있는 기록은 6~7단계에서 이미 써 둔 ADR 파일과 Decision Index 한 줄 그 자체입니다. `decision_recorded` 같은 커스텀 이벤트를 별도로 남길 필요도, 방법도 없습니다.

### 10단계 — 다음 항목으로 반복, 또는 핸드오프

`Unknown Map.md`의 "이번 회의에서 결정할 것"에 아직 항목이 남아 있으면 1단계로 돌아가 다음 항목의 카드를 만듭니다. 목록이 비면 사용자에게 짧게 알리고 Build Readiness 단계로 넘긴다고 안내합니다 (`docs/02_PRODUCT_SPEC.md` "새 기능 요청 흐름" 8번).

```
결정 감사합니다. 이제 이 결정을 바탕으로 만들어도 되는지 확인하는 단계로 넘어갈게요.
```

이 스킬은 Build Readiness Meeting 자체를 진행하지 않습니다 — 거기서 실제로 `allowed_files`가 정해지고 승인 플래그가 켜집니다.

## 절대 하지 않는 일 (G2 경계)

`docs/SAFETY_ENFORCEMENT_POLICY.md` G2는 결정론적 승인 캡처 + T0~T3 재확인 등급으로 정리되어 있습니다. 이 스킬은 그 경계의 **앞쪽 절반만** 맡습니다.

- 이 스킬은 사용자가 채팅에 "B요", "그걸로 해주세요" 라고 쓴 문장을 **직접 해석해서** `.senpai/state.json`의 `approved_scope`나 `allowed_files`를 쓰는 일을 **절대 하지 않습니다.** 그건 프로즈 추론으로 안전 플래그를 뒤집는 것이고, 정확히 이 정책이 막으려는 것입니다.
- 실제 "이 범위를 만들어도 된다"는 승인은, 나중에 Builder가 그 결정된 범위 안의 파일을 실제로 `Write`/`Bash`로 건드리려는 순간에 일어납니다. 그 호출은 `PreToolUse` 훅 → `scripts/approval-gate.js`(`handlePreToolUse`) → `scripts/scope-check.js`를 거쳐, 대상이 Phase Plan의 `sensitive_files`(또는 코드에 내장된 최소 바닥선)에도 있으면 `permissionDecision: "deny"`(사유에 담긴 `[senpai-touch:{project}:{file}]` 문구를 사용자가 채팅으로 보내야 그 파일만 풀림)를, 그 외 `allowed_files` 안의 나머지 파일은 계획 승인 시점에 이미 확인받았으므로 `"allow"`(재확인 없이 자동 진행)를 반환합니다(T0~T3 등급, `docs/SAFETY_ENFORCEMENT_POLICY.md`). 이건 이미 구현되어 있고, 이 스킬이 만들 필요도 없고 만들어서도 안 됩니다.
- `allowed_files`/`sensitive_files`를 실제로 채우는 것은 이 스킬이 아니라 이후 Build Readiness Meeting(guided-plan)에서 사용자가 채팅에 `[senpai-go:{project}]`를 정확한 프로젝트 이름과 함께 그대로 보낼 때 `scripts/senpai-approve.js`가 인프로세스로 하는 일입니다(별도의 `/senpai-approve` 슬래시 커맨드는 존재하지 않습니다 — `commands/` 디렉토리에는 `init`만 있습니다).
- 이 스킬이 쓰는 파일은 두 종류뿐입니다: (1) `vault/20_Decisions/`의 ADR과 Decision Index, (2) `vault/10_Projects/{project}/Unknown Map.md`. `state.json`의 `unresolved_decisions`는 8단계에서 설명했듯 현재 이 스킬을 포함해 어디서도 쓸 방법이 없는 필드입니다 — 언젠가 쓸 수 있게 되면 이 스킬이 정리해야 할 대상이지만, 지금은 손대지 않습니다. `approved_scope`, `allowed_files`, `session_id`, `scope_hash` 필드는 절대 쓰지 않습니다.

## 실전 예시 — "로그인 기능 붙여줘" (unknown-map 스킬 예시 이어서)

`unknown-map` 스킬의 실전 예시에서 이어집니다. `카페알바시프트` 프로젝트의 `Unknown Map.md`에 아래가 이미 정리되어 있습니다.

```
이번 회의에서 결정할 것
1. 로그인 없이 MVP 먼저 만들지, 로그인부터 넣을지
2. 이메일 로그인인지 소셜 로그인인지
3. 사용자 정보를 어디에 저장할지
```

1단계에서 가장 근본적인 1번 항목을 고릅니다. 2단계 4관점 메모:

1. 기획 관점 — 알바시프트 MVP 목표는 "일정 등록/확인"이지 계정 시스템이 아님. 로그인 없이도 핵심 가치는 검증 가능.
2. 기술 관점 — 로컬 저장(기기 안)만으로 첫 버전은 충분히 가능. 소셜 로그인은 카카오/구글 앱 등록이 추가로 필요.
3. 위험 관점 — 로그인을 넣으면 비밀번호 저장, 개인정보처리방침이 즉시 딸려온다 (Risk Guardian 차단 대상: 인증).
4. 최소 구현 관점 — Minimality Ladder 1번("지금 필요한가?")에서 이미 걸림. 로그인 없이 먼저 검증하는 것이 더 작은 버전.

3~4단계, 실제로 보여줄 카드:

```md
# 결정이 필요합니다

## 요청

로그인 기능 붙여줘

## 왜 결정이 필요한가

겉으로는 버튼 하나처럼 보이지만, 실제로는 아래 결정이 함께 생깁니다.

## 선택지

A. 로그인 없이 MVP 먼저 만들기
B. 이메일 로그인까지 포함하기
C. 소셜 로그인까지 포함하기
D. 더 쉽게 설명해달라고 하기

## 추천

A. 로그인 없이 MVP 먼저 만들기

## 추천 이유

지금 목표(일정 등록/확인)는 로그인 없이도 검증할 수 있고, 로그인을 넣으면 비밀번호 저장·개인정보처리방침이 함께 필요해집니다. 최소 구현 관점에서도 로그인은 지금 단계에서 필요하지 않습니다.

## 이 결정을 하면 바뀌는 것

이번 Build Readiness에서 "만들 것"에 로그인 화면이 빠지고, 데이터는 서버가 아니라 기기 안에만 저장됩니다.

## 확인 질문

이 방향으로 진행할까요?
```

5단계에서 사용자가 "A"라고 명확히 답했다고 가정합니다. 6~9단계로 ADR을 만듭니다.

```md
---
type: decision
project: 카페알바시프트
status: accepted
created: 2026-07-03
impact: medium
---

# ADR-0001 로그인 범위 결정

## 결정

첫 버전(MVP)에서는 로그인 기능 없이 로컬 저장만으로 진행한다.

## 이유

일정 등록/확인이라는 MVP 핵심 목표는 로그인 없이도 검증 가능하고, 로그인을 넣으면 비밀번호 저장과 개인정보처리방침이 함께 필요해져 범위가 커진다. Minimality Ladder 1번("지금 필요한가?")에서 이미 걸린다.

## 선택지

### A

로그인 없이 MVP 먼저 만들기

### B

이메일 로그인까지 포함하기

### C

소셜 로그인까지 포함하기

## 선택한 안

A. 로그인 없이 MVP 먼저 만들기

## 영향

이번 Build Readiness "만들 것"에서 로그인 화면 제외, 데이터는 기기 로컬 저장으로 진행.

## 다시 검토할 시점

MVP 검증 이후, 사용자가 여러 기기에서 접근해야 한다는 요구가 나오면 재검토.

## 관련 노트

[[10_Projects/카페알바시프트/Unknown Map]]
```

`vault/20_Decisions/Decision Index.md`에 `| [[ADR-0001-login-scope]] | 로그인 범위 결정 | 카페알바시프트 | accepted | 2026-07-03 |` 한 줄이 추가되고, `Unknown Map.md`의 1번 항목이 제거됩니다(`state.json`의 `unresolved_decisions`는 8단계에서 설명한 대로 아직 쓸 방법이 없으므로 그대로 둡니다). 2번·3번 항목은 아직 남아 있으므로, 10단계에 따라 다음 카드(이메일 vs 소셜 로그인... 은 사실 A를 골랐으므로 더 이상 의미 없음 → 실제로는 3번 "사용자 정보를 어디에 저장할지"로 넘어갑니다)로 반복합니다.

## 지켜야 할 것

- 카드 하나에 결정 하나만 담습니다. 여러 결정을 한 번에 묻지 않습니다.
- 선택지 D는 항상 "더 쉽게 설명해달라고 하기" 고정 문구입니다.
- 4관점 메모를 건너뛰고 바로 "추천"을 쓰지 않습니다 — 건너뛰면 회의처럼 보이지 않고 AI 혼자 정한 것처럼 보입니다.
- 사용자 답변이 애매하면 절대 짐작해서 진행하지 않습니다. 특히 이후 `allowed_files`에 영향을 줄 결정일수록 더 좁혀서 되묻습니다.
- `.senpai/state.json`의 `approved_scope`, `allowed_files`, `session_id`, `scope_hash`는 이 스킬에서 절대 쓰지 않습니다. `unresolved_decisions`는 8단계에서 설명한 대로 쓸 방법이 아직 없어 건드리지 않습니다.
- vault에 쓰는 모든 파일은 `Write` 도구로 `vault/` 경로에 직접 씁니다 (`scripts/scope-check.js`가 build 승인과 무관하게 항상 허용하며, 백업과 시크릿 경로 차단도 그 안에서 자동으로 처리됩니다).
- ADR을 다 쓴 뒤에는 반드시 Unknown Map.md에서 해당 항목을 지웁니다. 지우지 않으면 이미 끝난 결정을 계속 다시 묻게 됩니다.
