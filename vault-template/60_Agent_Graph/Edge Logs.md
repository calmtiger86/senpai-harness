---
type: edge_log
status: active
updated: {date}
---

# Edge Logs

에이전트 사이에 실제로 오간 영향(Edge Log)을 사람이 읽기 쉬운 표로 누적 기록합니다. 이 표 자체가 원본 기록입니다 — `obsidian-brain-update` 스킬이 매 작업 단위마다 `Write` 도구로 맨 아래에 행을 추가하고, 기존 행은 지우지 않습니다 (`skills/obsidian-brain-update/SKILL.md` "Edge Logs.md" 참고).

## Edge Log 표

| from | to | weight | directness | state | artifact | user_understanding | user_decision | impact |
| ---- | -- | ------ | ---------- | ----- | -------- | ------------------- | -------------- | ------ |

## 항목 읽는 법

- **from / to** — 누가 누구에게 영향을 줬는지 (방향성)
- **weight** — 이 경로의 강도. `강함` | `보조` | `차단` 세 값 중 하나입니다 — `Agent Graph.md`의 "이번 작업의 강한 경로/보조 경로/차단된 경로" 섹션 중 어디서 나온 항목인지를 그대로 옮긴 값입니다. (0~1 사이의 소수점 확신도는 쓰지 않습니다 — 모델이 근거 없이 지어낸 숫자는 이 하네스가 막으려는 "확인 안 된 것을 확인됐다고 말하기"와 같은 실패이기 때문입니다. 실제 데이터가 쌓여 더 세밀한 구분이 필요해지면 그때 확장합니다.)
- **directness** — 직접 영향(direct, 다른 에이전트의 결과를 바로 이어받음)인지, 중간 기억을 거친 영향(indirect, vault 문서를 다시 읽어서 이어받음)인지
- **state** — 어떤 회의/단계에서 일어난 일인지
- **artifact** — 근거가 된 노트나 파일 경로 (프로젝트별 문서는 `10_Projects/{project}/...` 경로 포함)
- **user_understanding** — 그 시점에 사용자가 이해하고 있었는지
- **user_decision** — 사용자가 실제로 내린 선택
- **impact** — 이 영향이 이후 작업 범위에 준 변화
