---
name: obsidian-brain-update
description: Guided Work, Review Meeting, Checkout Meeting이 끝난 뒤 Obsidian Vault의 7개 핵심 기억 파일(Current State.md, Session Memory.md, Decision Index.md, Error Index.md, Completion Evidence.md, Agent Graph.md, Edge Logs.md)을 Write 도구로 vault/ 아래에 직접 갱신한다(scope-check.js가 백업/secret 차단을 자동 처리). 결정/오류/증거/진행 단계에 실제 변화가 생긴 "의미 있는 작업" 뒤에만 호출하고, 순수 질문이나 읽기 전용 탐색 뒤에는 호출하지 않는다.
disable-model-invocation: false
---

# Obsidian Brain Update

## 이 스킬의 역할

Senpai Harness는 작업이 끝나면 결정, 오류, 검증, 다음 단계가 Obsidian에 남아야 합니다 (`docs/00_CONCEPT.md` 핵심 철학 "7. Remember After Work"). 이 스킬은 그 약속을 실제로 지키는 담당자입니다. 에이전트 스펙의 Memory Librarian 역할(`docs/04_AGENT_SPEC.md` §10)을 이 스킬이 수행한다고 보면 됩니다.

이 스킬은 **회의를 여는 스킬이 아니라 회의/작업이 끝난 뒤 뒷정리를 하는 스킬**입니다. 회의 자체를 진행하려면 `meeting-system` 스킬을, 결정 카드를 만들려면 `decision-card` 스킬을 먼저 실행하세요. 이 스킬은 그 결과물을 받아서 Vault에 기록만 합니다.

## 언제 실행하나

아래 세 시점 직후에 **반드시** 실행합니다 (`docs/02_PRODUCT_SPEC.md`에 명시된 지점).

1. **Guided Work 흐름이 끝난 직후** — Builder가 승인된 체크리스트 항목을 구현하고, Evidence Reviewer가 완료 증거를 확인한 다음. (`docs/02_PRODUCT_SPEC.md` "4. Guided Work 흐름" 6단계: "Memory Librarian이 변경 요약 저장")
2. **Review Meeting이 끝난 직후** — 구현 결과를 검토하고 다음 방향을 정한 다음.
3. **Checkout Meeting이 끝난 직후** — 세션을 정리하고 다음 시작점을 저장하는 단계. (`docs/02_PRODUCT_SPEC.md` "7. 자동 체크아웃 흐름" 7단계: "Obsidian 업데이트")

추가로, 사용자가 "정리해줘", "기억해둬", "저장해줘", "오늘 여기까지"처럼 명시적으로 요청하면 그 즉시 실행합니다.

## "의미 있는 작업"이란

`docs/00_CONCEPT.md`가 말하는 "결정, 오류, 검증, 다음 단계"를 실행 조건으로 풀면 다음과 같습니다. **아래 중 하나라도 해당하면 실행**합니다.

- 결정이 하나 이상 내려졌다 (사용자가 Decision Card 중 하나를 선택했다)
- 오류가 새로 발생했거나, 기존 오류가 해결됐거나, 반복됐다
- 완료 증거가 새로 생기거나 바뀌었다 (파일 생성/수정, 빌드 성공, 테스트 통과, 사용자 흐름 확인 등)
- 프로젝트의 현재 단계나 다음 할 일이 바뀌었다
- 에이전트 간에 실제로 영향을 준 경로가 발생했다 (예: 사용자 결정이 Builder의 구현 범위를 바꿨다)

**아래는 실행하지 않습니다** (실행하면 오히려 소음이 됩니다).

- 순수 질문/설명만 하고 끝난 대화 (코드도, 결정도, 증거도 바뀌지 않음)
- Project Explorer의 읽기 전용 탐색만 있었던 경우
- 회의가 아직 진행 중이라 사용자 선택을 기다리는 중간 상태
- 이번 스킬을 이미 같은 작업 단위에서 실행해서 갱신할 내용이 실제로 없는 경우

## 스코프: 정확히 이 7개 파일만

| 파일 | 위치 | 갱신 방식 |
| --- | --- | --- |
| `Current State.md` | `vault/10_Projects/{project}/Current State.md` | 스냅샷 덮어쓰기 |
| `Session Memory.md` | `vault/10_Projects/{project}/Session Memory.md` | 이어쓰기 (맨 위에 추가) |
| `Decision Index.md` | `vault/20_Decisions/Decision Index.md` | 이어쓰기 (표에 행 추가) |
| `Error Index.md` | `vault/30_Errors/Error Index.md` | 이어쓰기 (행 추가 또는 반복횟수 갱신) |
| `Completion Evidence.md` | `vault/10_Projects/{project}/Completion Evidence.md` | 스냅샷 덮어쓰기 |
| `Agent Graph.md` | `vault/60_Agent_Graph/Agent Graph.md` | 스냅샷 덮어쓰기 |
| `Edge Logs.md` | `vault/60_Agent_Graph/Edge Logs.md` | 이어쓰기 (표에 행 추가) |

`Task Log.md`, `30_Errors/ERR-*.md`(개별 오류 기록), `40_Playbooks/`(Playbook 전체), `60_Agent_Graph/Connectivity Matrix.md`, `60_Agent_Graph/Rewire History.md`는 이 스킬의 범위 밖입니다. Task Log는 Guided Work 진행 중 작업 단위로 바로 기록되고, 개별 오류 기록 파일(`ERR-000N.md`)과 Playbook 승격(`PB-000N.md`, `Playbook Index.md`)은 `skills/error-to-playbook/SKILL.md`(2026-07 구현)의 몫입니다 — 그 스킬이 이 스킬보다 먼저 실행되어 ERR 파일을 만들거나 갱신해두면, 이 스킬은 아래 "Error Index.md" 절에서 그 결과를 표에 반영하기만 합니다. Connectivity Matrix와 Rewire History는 `Edge Logs.md`에 쌓인 기록을 나중에 집계/비교해야 채울 수 있는 표라서 아직 스키마 단계로 남아 있습니다(`vault-template/60_Agent_Graph/Connectivity Matrix.md` 안내문 참고) — 이 스킬은 그 집계를 하지 않습니다. 이 파일들은 건드리지 마세요.

`00_Dashboard/Completion Evidence.md`(`type: completion_evidence_dashboard`)도 건드리지 않습니다. 그 파일은 여러 프로젝트를 가로지르는 정적 안내문이고, 표 형태의 프로젝트별 데이터를 담지 않습니다. 실제로 매 작업마다 바뀌어야 하는 것은 프로젝트 폴더 안의 `Completion Evidence.md`(`type: completion_evidence`, `templates/completion-evidence.md` 기반)입니다.

### 왜 "덮어쓰기"와 "이어쓰기"를 구분하는가

`Write` 도구는 파일 전체를 새 내용으로 **통째로 교체**합니다(이어붙이기가 아닙니다). 그래서:

- **이어쓰기 대상**(Session Memory, Decision Index, Error Index, Edge Logs)은 반드시 **먼저 Read 툴로 기존 내용을 읽고, 옛 내용 위에 새 내용을 합친 전체 텍스트를 만들어서** `Write` 도구에 넘겨야 합니다. 옛 내용을 빼고 새 내용만 넘기면 그 파일의 과거 기록이 통째로 사라집니다.
- **덮어쓰기 대상**(Current State, Completion Evidence, Agent Graph)은 애초에 "지금 상태의 스냅샷"이라서 과거 내용을 지우고 최신 내용으로 교체하는 것이 맞습니다. 각 노트 명세 자체가 "현재 단계", "이번 작업" 같은 현재형 섹션으로만 구성돼 있고(`docs/05_OBSIDIAN_VAULT_SPEC.md`), Agent Graph는 "이번 작업의 강한 경로"처럼 회차마다 새로 채우는 구조이며 누적 이력은 별도로 `60_Agent_Graph/Rewire History.md`, `Edge Logs.md`가 담당합니다.

덮어쓰기 전 자동 백업(`.senpai/backups/`)과 secret 경로 차단은 `Write` 호출 자체를 가로채는 `scripts/scope-check.js`가 처리하므로, 이 스킬이 따로 구현할 필요가 없습니다. `.senpai/event_logs.jsonl`에 자동으로 쌓이는 로그(4단계 참고)만이 진짜 "추가 전용(append-only)" 기록입니다. 마크다운 파일의 "이어쓰기"는 어디까지나 이 스킬이 직접 옛 내용 + 새 내용을 합친 뒤 `Write`로 통째로 다시 쓰는 것임을 잊지 마세요.

## 노트 사이를 위키링크로 연결하기

Obsidian은 `[[노트 이름]]`으로 두 노트를 연결합니다. 연결된 노트는 서로의 "백링크" 목록에 자동으로 나타나므로, 관계를 보여주려고 양쪽 파일을 다 갱신할 필요가 없습니다. 이 규칙은 vault에 쓰는 모든 스킬(`decision-card`, `guided-plan`, `meeting-system`, `evidence-loop`, `unknown-map`)에 공통으로 적용됩니다.

- **프로젝트별 문서**(Current State, Session Memory, Phase Plan, Unknown Map, Project Brief, Project Home, Project Wiki, PRD, Task Log, Verification, Completion Evidence, Minimality Check)는 같은 파일명이 프로젝트마다 반복되므로, 경로를 포함해서 링크합니다: `[[10_Projects/{project}/Session Memory]]`. 프로젝트 이름을 빼고 `[[Session Memory]]`라고만 쓰면, Obsidian이 다른 프로젝트의 동명 파일로 잘못 연결할 수 있습니다.
- **번호가 붙는 문서**(ADR-XXXX, ERR-XXXX, PB-XXXX)는 파일명 자체가 vault 전체에서 고유하므로 그대로 링크합니다: `[[ADR-0004-no-login-mvp]]`.
- **vault 전체에 하나뿐인 문서**(Decision Index, Error Index, Playbook Index, Agent Graph, Connectivity Matrix, Edge Logs, Rewire History, `90_System/`·`00_Dashboard/`의 모든 문서)도 그대로 링크합니다: `[[Decision Index]]`. 단 `00_Dashboard/Completion Evidence.md`는 예외입니다 — 프로젝트별 `Completion Evidence.md`와 파일명이 겹치므로, 이 대시보드 파일만은 `[[00_Dashboard/Completion Evidence]]`처럼 경로를 포함합니다.
- 아직 만들어지지 않은 노트를 먼저 링크해도 됩니다(예: Error Index에 아직 없는 ERR 파일). Obsidian은 그 노트가 생기기 전까지 "연결 안 됨"으로 표시할 뿐, 오류가 나지 않습니다.

## 프로젝트 & Vault 경로 확인

1. `senpai.config.yaml`이 저장소 루트에 있으면 `obsidian.vault_path`를 읽어 그 경로를 vault 루트로 씁니다. 없으면 기본값 `./vault`를 씁니다 (`docs/03_TECHNICAL_SPEC.md` 설정 파일 초안 기준).
2. 프로젝트 이름은 자동 탐지 스크립트가 아직 없습니다 (`scripts/detect-project.js`는 설계 문서에만 있고 아직 구현되지 않았습니다). 대신 다음 순서로 판단하세요.
   - 이번 세션에서 이미 다루고 있던 프로젝트가 있으면 그 이름을 그대로 씁니다.
   - `{vault}/10_Projects/` 아래 폴더가 정확히 하나뿐이면 그 폴더를 씁니다.
   - 그 외(여러 개거나 하나도 없음)에는 **추측하지 말고 사용자에게 물어봅니다.** ("어느 프로젝트 기록을 갱신할까요?") — 이것이 하네스의 "사용자가 모르는 결정을 마음대로 처리하지 않는다"는 원칙입니다.
3. 프로젝트 폴더가 아직 vault에 없으면, `vault-template/10_Projects/_template/`의 10개 템플릿 파일을 새 프로젝트 이름으로 먼저 만든 뒤(각 파일을 `Write` 도구로 `vault/10_Projects/<프로젝트 이름>/`에 생성) 갱신을 진행합니다.

## 실행 절차

작업 단위마다 아래 순서를 따릅니다. 7개 파일 중 이번에 실제로 바뀔 내용이 있는 파일만 다룹니다 — 이번에 새 오류가 없었다면 `Error Index.md`는 건드리지 않습니다.

### 1단계 — 이번 작업에서 무엇이 바뀌었는지 정리

대화와 방금 끝난 회의/Guided Work 결과에서 다음을 뽑아냅니다.

- 새로 내려진 결정 (제목, 선택한 안, 이유, ADR 번호 — `decision-card`/`meeting-system` 스킬 결과물)
- 새로 발생했거나 해결된 오류 (제목, 증상, 원인, 해결 방법, 반복 여부)
- 이번에 만들어진/바뀐 완료 증거 (체크리스트 항목별 상태)
- 프로젝트의 새 "현재 단계"와 "다음 할 일"
- 이번에 실제로 영향을 준 에이전트 경로 (예: "사용자 결정 → Product Strategist → Builder 범위 축소")
- Builder가 체크리스트 항목 경계마다 보고한 "알아서 정한 것" 줄 (`agents/builder-runtime.md` "빌드 중 판단 규칙" 4단계 — Session Memory에 그대로 옮겨 적을 대상)
- "먼저 확인할 영역"의 격상/강등에 대한 **사용자 동의**가 있었는지 (동의 없으면 기록하지 않음 — 아래 Current State.md 절 참고)

### 2단계 — 파일별로 새 전체 내용을 만든다

아래 "파일별 갱신 방법" 절을 따라, 각 대상 파일의 **다음 버전 전체 텍스트**를 만듭니다. 이어쓰기 대상은 반드시 Read 툴로 기존 파일을 먼저 읽습니다.

### 3단계 — `Write` 도구로 각 파일에 직접 반영

`scripts/scope-check.js`가 `vault/` 아래 경로를 build 승인 여부와 무관하게 항상 허용하면서, 덮어쓰기 전 자동 백업(`.senpai/backups/`)과 secret 경로 차단을 그 자리에서 함께 처리합니다(`skills/guided-plan/SKILL.md` "3단계 — Write 도구로 실제 저장" 참고). 스크래치 파일이나 별도 스크립트를 거칠 필요 없이, 2단계에서 만든 병합된 전체 내용을 그대로 `Write` 도구에 넘깁니다.

```
Write 도구:
  file_path: vault/10_Projects/<project>/Session Memory.md
  content: <병합된 Session Memory 전체 내용>
```

이번에 바뀐 파일 각각에 대해 이 호출을 반복합니다(이어쓰기 대상은 직전에 `Read`로 기존 내용을 읽었는지 다시 확인하세요 — 안 읽고 쓰면 과거 기록이 사라집니다). `Write` 호출이 거부되면(시크릿 경로로 오인된 경우 등) 대상 경로를 다시 확인하고 절대 다른 방법으로 우회하지 않습니다.

### 4단계 — 이번 갱신은 별도로 기록하지 않아도 됩니다

3단계의 `Write` 호출들은 `hooks/scripts/handler.js`가 모든 훅 호출마다 자동으로 `.senpai/event_logs.jsonl`에 남기므로(`{hook_event_name, tool_name, file_path, ...}`), 이 스킬이 별도로 이벤트를 남길 필요가 없습니다. `scripts/event-log.js`의 `appendEvent()`는 Bash CLI 진입점이 없어 이 스킬에서 직접 호출할 수도 없습니다(`node -e` 형태의 임의 실행은 `scope-check.js`가 항상 거부합니다).

이번 갱신이 실제로 일어났다는 내구성 있는 기록은 3단계에서 이미 쓴 vault 파일들 그 자체입니다. `obsidian_brain_update` 같은 커스텀 이벤트를 별도로 남길 필요도, 방법도 없습니다.

### 5단계 — 사용자에게 결과 보고

"완료 보고" 절의 형식대로 무엇을 갱신했고 무엇은 이번에 건드리지 않았는지 짧게 알려줍니다.

## 파일별 갱신 방법

### Current State.md (덮어쓰기)

템플릿(`vault-template/10_Projects/_template/Current State.md`):

```md
---
type: current_state
project: {project}
status: active
updated: {date}
---

# Current State

## 현재 단계

## 최근 변경

## 다음 할 일
```

기존 파일을 참고용으로 Read하되(사용자에게 "무엇이 바뀌었는지" 설명하기 위해서), 최종적으로 쓰는 내용은 옛 내용이 아니라 **지금 시점의 사실**로 세 섹션을 다시 채운 전체 텍스트입니다. `updated`를 오늘 날짜로 바꿉니다. "최근 변경"·"다음 할 일"에서 특정 결정이나 오류를 언급할 때는 `[[ADR-XXXX-...]]`, `[[ERR-XXXX-...]]`처럼 위키링크로 씁니다.

**"먼저 확인할 영역" 섹션 (있을 때만)**

Guided Work 중 사용자가 Builder의 "알아서 정한 것" 보고에 관찰 가능한 행동으로 반응했고(되돌리기 요청, "왜 이렇게 했어요?"라는 질문, 같은 영역 반복 수정 요청 — 표정·기분 같은 감정 추측은 신호가 아닙니다), Builder가 "앞으로 이 영역은 먼저 여쭤볼까요?"라고 제안해 **사용자가 동의한 경우에만**, 세 섹션 아래에 이 섹션을 두고 한 줄씩 기록합니다 (`agents/builder-runtime.md` "빌드 중 판단 규칙" 공통 규칙 참고).

```md
## 먼저 확인할 영역

- 색상/배색 — 되돌리기 요청 2회 → 사용자 동의로 격상 (2026-07-05)
```

- 한 줄 형식: `{영역} — {관찰된 행동} → 사용자 동의로 격상 ({날짜})`. 사용자가 동의하지 않았으면 절대 적지 않습니다 — AI 관찰만으로 조용히 격을 올리는 것은 사용자 몰래 상호작용 방식을 바꾸는 일입니다.
- **덮어쓰기의 유일한 예외**: Current State.md는 스냅샷 덮어쓰기 파일이지만, 이 섹션의 기존 항목만은 새 스냅샷에 **그대로 옮겨 적습니다** — 세션이 바뀌어도 유지돼야 하는 기억이기 때문입니다(이 파일을 쓰기 전에 반드시 Read해야 하는 이유가 하나 더 늘었습니다). 항목을 지우는 경우는 아래 강등뿐입니다.
- **강등(원상복구)도 대칭으로**: 사용자가 "그냥 알아서 해요", "이제 안 물어봐도 돼요"처럼 명시하면 해당 항목을 삭제합니다. 이때도 사용자 말 없이 AI 판단만으로 지우지 않습니다.
- 격상된 항목이 하나도 없으면 이 섹션 자체를 만들지 않습니다 — 일어나지 않은 일을 기록하지 않습니다.
- **읽는 쪽**: Builder가 작업을 시작할 때 이 섹션을 읽고, 적힌 영역은 4단 판정에서 처음부터 한 단계 위에서 다룹니다.
- 이 기억은 프로젝트 vault 안에만 둡니다 — 새 프로젝트를 시작하면 초기화됩니다. 프로젝트를 가로지르는 사용자 프로필은 MVP에서는 과설계라 만들지 않습니다(같은 사용자라도 프로젝트마다 민감한 영역이 다를 수 있어, 프로젝트 단위 초기화가 오히려 안전한 기본값입니다).

### Session Memory.md (이어쓰기 — 맨 위에 추가)

1. Read 툴로 기존 `Session Memory.md`를 읽습니다.
2. frontmatter + `# Session Memory` 제목 + 안내 문장("새 세션이 끝날 때마다...") 바로 다음, 기존에 있던 첫 `## {date} 세션` 항목보다 **앞에** 새 블록을 끼워 넣습니다.

```md
## {오늘 날짜} 세션

### 오늘 한 일

### 결정한 것

### 남은 일

### 다음 세션 시작점
```

3. frontmatter의 `updated`를 오늘 날짜로 바꿉니다.
4. "새 블록 + 기존에 있던 모든 옛 블록"을 합친 전체 텍스트를 `Write` 도구로 넘깁니다. 옛 블록을 절대 지우지 않습니다.

"결정한 것"에는 해당 `[[ADR-XXXX-...]]`를, "다음 세션 시작점"에서 이어갈 계획을 가리킬 때는 `[[10_Projects/{project}/Phase Plan]]`을 위키링크로 겁니다.

"오늘 한 일" 아래에는 Guided Work 중 Builder가 체크리스트 항목 경계마다 보고한 "알아서 정한 것" 줄이 있으면 **그대로 옮겨 적습니다** — 요약하거나 빼지 않습니다. 이 줄들이 남아 있어야 나중에 "그때 왜 그렇게 됐지?"를 되짚을 수 있고, 조용히 진행한 결정이 없던 일이 되지 않습니다 (`agents/builder-runtime.md` "빌드 중 판단 규칙" 4단계).

### Decision Index.md (이어쓰기 — 표에 행 추가)

1. Read 툴로 기존 표를 읽습니다.
2. 이번에 새로 내려진 결정마다 표에 한 줄을 추가합니다.

```md
| 번호 | 제목 | 프로젝트 | 상태 | 날짜 |
| ---- | ---- | -------- | ---- | ---- |
| [[ADR-0003-no-login-mvp]] | 로그인 없이 MVP 먼저 | 알바시프트 | accepted | 2026-07-03 |
```

- `번호` 칸에는 숫자만이 아니라 `[[ADR-000N-{슬러그}]]` 위키링크 전체를 적습니다 — 실제 ADR 파일명과 정확히 일치해야 연결됩니다. 번호 자체는 기존 표의 가장 큰 ADR 번호 + 1입니다 (또는 프로젝트의 `20_Decisions/ADR-*.md` 실제 파일 개수를 세서 확인).
- 실제 `ADR-000N-{title}.md` 결정 기록 파일 자체를 새로 만드는 것은 `decision-card`/`meeting-system` 스킬의 일입니다. 이 스킬은 그 결과를 인덱스 표에 한 줄 반영만 합니다. 그 결정 기록 파일이 아직 없다면 먼저 그쪽 스킬을 통해 만든 뒤 이 인덱스를 갱신하세요.
3. 기존 행 + 새 행을 합친 전체 표를 `Write` 도구로 넘깁니다. 기존 행을 지우지 않습니다.

### Error Index.md (이어쓰기 — 행 추가 또는 반복횟수 갱신)

1. Read 툴로 기존 표를 읽습니다.
2. 이번 오류의 제목/프로젝트가 기존 행과 일치하면 **그 행의 `반복횟수`만 1 올립니다.**
3. 처음 보는 오류면 새 행을 추가합니다.

```md
| 번호 | 제목 | 프로젝트 | 반복횟수 | 상태 |
| ---- | ---- | -------- | -------- | ---- |
| [[ERR-0002-local-storage-reset]] | 로컬 저장값이 재시작 후 사라짐 | 알바시프트 | 1 | open |
```

- `번호` 칸에는 `[[ERR-000N-{슬러그}]]` 위키링크를 적습니다. 그 파일 자체의 생성/갱신은 `skills/error-to-playbook/SKILL.md`의 몫이라 이 스킬보다 먼저 실행돼 있는 게 보통입니다 — 이 표의 `반복횟수`는 그 스킬이 이미 갱신해둔 ERR 파일의 `recurrence_count` frontmatter와 일치해야 합니다(불일치하면 ERR 파일 쪽을 진짜 값으로 신뢰하고 표를 맞춥니다). `error-to-playbook`이 아직 실행되지 않아 ERR 파일이 없는 경우에만, 파일이 생기기 전에 이 스킬이 먼저 링크를 걸어둬도 됩니다(Obsidian은 "연결 안 됨"으로 표시할 뿐 오류가 나지 않습니다).
- 반복횟수가 3 이상인데 아직 Playbook으로 승격되지 않았다면, `error-to-playbook` 스킬을 먼저 실행하도록 안내합니다 — 이 스킬은 Playbook을 직접 만들지 않습니다.

### Completion Evidence.md (프로젝트별, 덮어쓰기)

경로: `vault/10_Projects/{project}/Completion Evidence.md`. 아직 없으면 `templates/completion-evidence.md`를 그대로 base로 새로 만듭니다.

```md
---
type: completion_evidence
project: {project}
status: partial
updated: {date}
---

# Completion Evidence

## 이번 작업

## 완료라고 말하려면 필요한 증거

- [ ] 파일 생성/수정 확인
- [ ] 빌드 성공
- [ ] 테스트 통과
- [ ] 사용자 흐름 확인
- [ ] 비개발자용 결과 설명 완료

## 현재 상태

## 부족한 증거

## 허용되는 완료 표현
```

- "이번 작업" 섹션에서는 이 증거가 어떤 계획에 대한 것인지 `[[10_Projects/{project}/Phase Plan]]`으로 링크합니다.
- `status`는 `partial | done`, 체크리스트 각 항목의 체크 여부는 Evidence Reviewer가 실제로 확인한 것만 체크합니다. 확인 안 된 항목은 반드시 빈 칸(`[ ]`)으로 남깁니다.
- "허용되는 완료 표현"에는 `docs/02_PRODUCT_SPEC.md` "검증 흐름"의 허용 문구 중 지금 상태에 맞는 것만 적습니다 (부분 완료 / 구현 완료, 검증 전 / 로컬 기준 완료 / 빌드 기준 완료 / 검증 완료). "완료했습니다", "문제 없습니다" 같은 금지 표현은 절대 쓰지 않습니다.
- 이 파일은 매번 이번 작업 기준으로 **덮어씁니다.** 과거 회차의 증거 이력이 필요하면 `Verification.md`(같은 프로젝트 폴더, 누적 표)를 참고하세요 — 그건 이 스킬의 범위가 아닙니다.

### Agent Graph.md (덮어쓰기)

```md
---
type: agent_graph
status: active
updated: {date}
---

# Agent Graph

## 이번 작업의 강한 경로

## 보조 경로

## 차단된 경로

## 사용자 결정이 영향을 준 지점

## 다음 작업의 라우팅 변경
```

- 각 섹션은 "이번 작업"만 담습니다 (누적 아님). 예: `Senpai Orchestrator → Product Strategist → Builder (강함, 사용자가 B안을 승인해서 결정)`.
- "사용자 결정이 영향을 준 지점"에서는 실제 결정을 `[[ADR-XXXX-...]]`로 링크해, 어떤 결정이 어떤 경로를 바꿨는지 클릭으로 따라갈 수 있게 합니다.
- 차단된 경로에는 Risk Guardian이나 Skeptic이 막은 시도를 적습니다.
- 여기 적은 "강한 경로"/"보조 경로"/"차단된 경로" 각 항목은 바로 아래 `Edge Logs.md`에 누적 행으로도 남깁니다 — 두 파일을 같은 판단으로 함께 채우는 것이지, 따로 다시 분석하는 게 아닙니다. `Rewire History.md`(라우팅이 실제로 바뀐 이력 집계)와 `Connectivity Matrix.md`(누적 집계표)는 여전히 이 스킬의 범위 밖입니다 — 둘 다 여러 회차의 `Edge Logs.md`를 모아서 비교/합산해야 채울 수 있는 표라서, 지금 이 스킬이 보는 "이번 작업 한 번"의 정보만으로는 채울 수 없습니다.

### Edge Logs.md (이어쓰기 — 표에 행 추가)

`Agent Graph.md`가 "이번 작업의 스냅샷"이라면, `Edge Logs.md`는 그 스냅샷을 매번 한 줄씩 쌓는 누적 기록입니다. 같은 판단(방금 만든 강한/보조/차단 경로, 사용자 결정이 영향을 준 지점)을 다시 표 형식으로 옮기기만 하면 되고, 새로 분석할 것은 없습니다.

1. `Read` 도구로 기존 `Edge Logs.md`를 읽습니다.
2. `Agent Graph.md`에 적은 경로마다 한 행씩 추가합니다. 이번 작업에 "차단된 경로"가 없었다면 그 행도 만들지 않습니다 — 일어나지 않은 일을 기록하지 않습니다.

```md
| from | to | weight | directness | state | artifact | user_understanding | user_decision | impact |
| ---- | -- | ------ | ---------- | ----- | -------- | ------------------- | -------------- | ------ |
| Senpai Orchestrator | Builder | 강함 | direct | build_readiness_meeting | [[ADR-0003-no-login-mvp]] | confirmed | 로그인 없이 MVP 먼저 | Builder 범위에서 로그인 화면 제외 |
```

- **weight**는 `강함`/`보조`/`차단` 중 하나만 씁니다 — 방금 `Agent Graph.md`의 어느 섹션에 적었는지 그대로 옮기는 것이지, 새로 확신도를 매기지 않습니다(`vault-template/60_Agent_Graph/Edge Logs.md` "항목 읽는 법" 참고). 0.91 같은 소수점 점수는 절대 지어내지 않습니다 — 근거 없는 숫자는 이 하네스가 막으려는 실패(확인 안 된 것을 확인됐다고 말하기)와 같은 종류입니다.
- **directness**는 `direct`(바로 다음 에이전트가 결과를 이어받음) 또는 `indirect`(vault 문서를 다시 읽어서 이어받음) 중 실제로 있었던 쪽만 씁니다.
- **artifact**는 이 경로의 근거가 된 실제 파일 경로를 위키링크로 겁니다 — 프로젝트별 문서는 `[[10_Projects/{project}/...]]`, ADR/ERR은 그대로.
- **user_understanding**/**user_decision**은 관련 결정이 있을 때만 채우고, 없으면 빈 칸으로 둡니다(지어내지 않습니다).
3. 기존 행 + 새 행을 합친 전체 표를 `Write` 도구로 넘깁니다. 기존 행을 지우지 않습니다.

## 실패 처리

- `Write` 호출이 secret 경로로 분류돼 거부되면 **절대 우회하지 말고** 있는 그대로 사용자에게 보고합니다. vault 안의 파일 경로가 정상적으로 secret 패턴(`.env`, `*.pem`, id_rsa류 SSH 키 이름 등, `scripts/protect-secrets.js`의 `isHardSecretPath` 기준)에 걸릴 일은 없으므로, 걸렸다면 프로젝트 이름이나 파일명 자체에 문제가 있다는 신호입니다.
- 이어쓰기 대상 파일을 읽었는데 내용이 형식에서 크게 벗어나 있거나(frontmatter 깨짐), 명백히 다른 프로젝트의 내용이 섞여 있으면 덮어쓰지 말고 먼저 사용자에게 확인합니다.
- 프로젝트 이름이 애매하면(2번 항목 참고) 절대 추측하지 않고 사용자에게 묻습니다.

## 완료 보고 (사용자에게 보여줄 형식)

Memory Librarian의 출력 스펙(`docs/04_AGENT_SPEC.md` §10: Obsidian Update Summary, Updated Files List)에 맞춰 짧고 쉬운 말로 보고합니다.

```md
# 기억 저장 완료

이번 작업에서 있었던 일을 Obsidian에 기록했습니다.

갱신한 파일:
- Current State.md — 현재 단계를 "Build Readiness 완료"로 업데이트
- Session Memory.md — 오늘 세션 기록 추가
- Completion Evidence.md — 완료 증거 상태 갱신 (부분 완료)
- Agent Graph.md — 이번 작업 경로 기록
- Edge Logs.md — 이번 작업 경로를 누적 표에 추가

이번엔 건드리지 않은 파일:
- Decision Index.md — 새 결정 없음
- Error Index.md — 새 오류 없음
```

## 예시 시나리오

**상황**: 사용자가 "온보딩 화면 로컬 저장 기능"의 Guided Work를 승인했고, Builder가 구현을 마쳤고, Evidence Reviewer가 "빌드 성공, 설정값 저장 확인, 재시작 후 값 유지는 아직 미확인"이라고 보고했습니다. 새 결정이나 새 오류는 없었습니다.

**이 스킬이 하는 일**:

1. 조건 확인 → Guided Work 완료 = 실행 조건 충족.
2. 바뀐 것 정리 → 완료 증거 일부 확인, 현재 단계 변화 있음. 결정/오류는 변화 없음 → `Decision Index.md`, `Error Index.md`는 이번에 건드리지 않음.
3. `Current State.md`를 다음 내용으로 덮어쓰기:
   ```md
   ## 현재 단계
   온보딩 화면 로컬 저장 구현 완료, 검증 진행 중

   ## 최근 변경
   설정 화면 초안 생성, 로컬 저장 방식 적용

   ## 다음 할 일
   앱 재시작 후 저장값 유지 확인
   ```
4. `Session Memory.md` 맨 위에 오늘 세션 블록 추가 (기존 기록은 그대로 아래 유지).
5. `Completion Evidence.md`를 다음처럼 덮어쓰기: `- [x] 파일 생성/수정 확인`, `- [x] 빌드 성공`, `- [ ] 테스트 통과`, `- [ ] 사용자 흐름 확인`(재시작 후 유지 미확인), `status: partial`, 허용 표현은 "구현 완료, 검증 전".
6. `Agent Graph.md`에 "Builder → Evidence Reviewer (강함, 구현 결과 검증)" 경로 기록.
7. 같은 경로를 `Edge Logs.md`에 `| Builder | Evidence Reviewer | 강함 | direct | guided_work | [[10_Projects/카페알바시프트/Completion Evidence]] | | | 재시작 후 유지는 아직 미확인으로 남음 |` 행으로 추가(사용자 결정이 아니라 구현 검증 경로라 user_understanding/user_decision은 빈 칸. `state`는 이 경로가 실제로 일어난 단계인 "Guided Work 흐름"을 적습니다 — 회의 이름이 아닙니다).
8. `Write` 도구로 5개 파일 각각 `vault/` 아래에 직접 반영(각 호출은 훅이 자동으로 이벤트 로그에 남기므로 따로 기록할 것 없음).
9. 사용자에게 위 "완료 보고" 형식으로 요약 전달.

## 참고

- `docs/00_CONCEPT.md` 핵심 철학 "7. Remember After Work"
- `docs/02_PRODUCT_SPEC.md` "4. Guided Work 흐름", "7. 자동 체크아웃 흐름"
- `docs/04_AGENT_SPEC.md` §10 Memory Librarian
- `docs/05_OBSIDIAN_VAULT_SPEC.md` "주요 노트 명세", "자동 업데이트 규칙"
- `scripts/scope-check.js` (vault/ 쓰기 허용, 자동 백업/secret 차단), `hooks/scripts/handler.js` (모든 훅 호출 자동 이벤트 로깅)
- `templates/completion-evidence.md`, `templates/decision-record.md`, `templates/error-record.md`
- `vault-template/10_Projects/_template/*`, `vault-template/20_Decisions/`, `vault-template/30_Errors/`, `vault-template/60_Agent_Graph/`
