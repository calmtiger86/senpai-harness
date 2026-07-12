---
type: system_reference
status: active
updated: "{date}"
---

# Meeting Rules

Senpai Harness는 명령어 대신 자연어 흐름 중심으로 동작합니다. 사용자가 무엇을 말하든, 하네스는 지금 상황에 맞는 회의를 자동으로 골라서 엽니다.

이 문서는 7가지 회의 모드가 각각 언제 열리고, 무엇을 만들어내는지 정리합니다.

## Orientation Meeting

**언제 여는지** — 처음 프로젝트를 시작하거나, 맥락이 불명확할 때

**무엇을 산출하는지** — 지금 프로젝트가 어떤 상태인지 파악한 "지금 상황 카드", 그리고 다음에 어떤 회의로 가야 하는지에 대한 추천. Project Brief와 Current State가 아직 없다면 이를 만드는 것부터 시작합니다.

## Discovery Meeting

**언제 여는지** — 사용자가 모르는 숨은 결정이 많을 때

**무엇을 산출하는지** — Unknown Detector가 만드는 [[Unknown Detector|Unknown Map]], 그리고 사용자가 선택할 수 있는 Decision Card. 여기서 나온 질문에 사용자가 답하면 Decision Record로 저장됩니다.

## Design Meeting

**언제 여는지** — 여러 설계 선택지를 비교해야 할 때

**무엇을 산출하는지** — 선택지별 장단점을 정리한 비교표와 Decision Card. 사용자가 하나를 고르면 그 결정은 `20_Decisions`에 Decision Record로 남습니다.

## Scope Meeting

**언제 여는지** — MVP에 넣을 것과 뺄 것을 정할 때

**무엇을 산출하는지** — Product Strategist가 만드는 MVP Scope, Feature Priority, Scope Recommendation. "이번에 만들 것"과 "이번에 만들지 않을 것"을 명확히 나눕니다.

## Build Readiness Meeting

**언제 여는지** — 실제 구현 전에 진행 가능 여부를 확인할 때

**무엇을 산출하는지** — 승인된 결정과 MVP Scope를 바탕으로 만든 Build Checklist, 그리고 "무엇을 확인하면 완료로 볼 것인가"를 정한 Verification Target. 이 회의를 통과해야 [[Build Gates|Build Gate]]를 넘어 Builder가 움직일 수 있습니다.

## Review Meeting

**언제 여는지** — 구현 결과를 검토하고 다음 방향을 정할 때

**무엇을 산출하는지** — Evidence Reviewer가 만드는 Verification Report와 Evidence Status. 여기서 완료 상태(부분 완료 / 구현 완료, 검증 전 / 검증 완료 등)가 정확한 말로 정리됩니다.

## Checkout Meeting

**언제 여는지** — 세션을 정리하고 다음 시작점을 저장할 때

**무엇을 산출하는지** — 오늘 완료한 일과 남은 일 요약, 다음 세션 시작점. Memory Librarian이 이 내용을 Session Memory와 Current State에 반영합니다.

## 회의 사이의 순서

회의는 보통 이 순서로 이어집니다.

```
Orientation → Discovery / Design → Scope → Build Readiness → (Guided Work) → Review → Checkout
```

다만 사용자의 상황에 따라 중간 단계로 바로 들어가거나, 다시 앞 단계로 돌아갈 수 있습니다. 중요한 것은 순서를 억지로 지키는 것이 아니라, [[Build Gates|Build Gate]]를 넘기 전에 필요한 회의를 건너뛰지 않는 것입니다.

---

관련: [[Autonomy Contract]] · [[Unknown Detector]] · [[Build Gates]]
