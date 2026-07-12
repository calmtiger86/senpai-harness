---
description: 세션을 끝내지 않고, 지금까지의 진행 상황을 Obsidian 기억에 지금 바로 저장합니다
allowed-tools: Skill
---

1. Skill 도구로 `senpai-harness:obsidian-brain-update`를 호출합니다. 지금까지 이 대화에서 실제로 있었던 결정·진행 상황·완료/미완료 상태를 근거로, `vault/10_Projects/{project}/Current State.md`(+ 필요하면 Session Memory, Decision/Error 관련 파일)를 갱신하도록 지시합니다.
2. 이 명령은 세션을 끝내는 것(오늘 여기까지 정리하는 Checkout Meeting)과 다릅니다 — 대화는 계속하되 지금 시점 기록만 남기는 중간 저장입니다.
3. 아직 저장할 만한 실제 진행 상황이 하나도 없으면(예: 방금 세션을 시작해서 아무것도 안 한 경우), 억지로 파일을 만들지 말고 "지금은 저장할 새로운 진행 상황이 없습니다"라고 답합니다.
4. 저장이 끝나면 무엇을 어디에 저장했는지 한두 줄로 확인해줍니다(파일 경로 포함).
