---
type: connectivity_matrix
status: active
updated: {date}
---

# Connectivity Matrix

에이전트 런타임 역할 4가지가 서로 얼마나 강하게 영향을 주고받았는지 나타내는 표입니다. 행은 영향을 준 쪽, 열은 영향을 받은 쪽입니다.

> 지금은 비어있는 템플릿입니다. `Edge Logs.md`는 매 작업마다 실제로 기록이 쌓이지만(`skills/obsidian-brain-update/SKILL.md` 참고), 이 표는 그 누적 기록을 세어 합산하는 별도 집계 단계가 필요합니다. 아직 이 집계를 소비하는 화면/판단이 없어 지금은 만들지 않았습니다 — `Edge Logs.md`에 실제 데이터가 어느 정도 쌓이고 나서, 필요가 확인되면 그때 채웁니다.
>
> 집계할 때 주의할 것: `Edge Logs.md`의 `from`/`to`는 `docs/04_AGENT_SPEC.md`의 13개 에이전트 이름(Senpai Orchestrator, Product Strategist, Risk Guardian, Evidence Reviewer 등)을 그대로 쓰지만, 이 표의 행/열은 4개 런타임 역할(Orchestrator/Meeting, Safety-Minimality, Builder, Evidence-Memory)입니다. 1:1로 이름이 같지 않으므로(예: Risk Guardian·Skeptic → Safety-Minimality), 집계 단계에서 13→4 매핑을 먼저 정의해야 합니다.

| from \ to | Orchestrator/Meeting | Safety-Minimality | Builder | Evidence-Memory |
| --- | --- | --- | --- | --- |
| Orchestrator/Meeting | | | | |
| Safety-Minimality | | | | |
| Builder | | | | |
| Evidence-Memory | | | | |
