---
type: system_reference
status: active
updated: "{date}"
---

# Agent Capability Matrix

04_AGENT_SPEC에 정의된 13개 에이전트는 하는 일에 따라 4개의 실행 역할(runtime role)로 묶입니다. 13개를 하나씩 외울 필요 없이, "지금 상황을 판단하고 설명하는 쪽 / 위험을 막는 쪽 / 실제로 만드는 쪽 / 증거를 남기고 기억하는 쪽"으로 이해하면 충분합니다.

이 문서는 각 역할 그룹이 무엇을 할 수 있고, 무엇을 할 수 없는지, 실제로 파일을 쓸 수 있는지, 승인이 필요한지를 정리한 표입니다.

## 4개 런타임 역할

| 역할 그룹 | 포함 에이전트 | 할 수 있는 일 | 할 수 없는 일 | 쓰기 대상 | 승인 필요 |
|---|---|---|---|---|---|
| **Orchestrator / Meeting** | Senpai Orchestrator, Meeting Selector, Unknown Detector, Product Strategist, Nondev Explainer | 상황 판단, 사용자 의도 분류, 회의 선택·진행, 숨은 결정 탐지, MVP 범위 제안, 쉬운 말 설명, 다음 행동 제안 | 제품 코드 직접 수정, 사용자 승인 없이 방향 확정, 위험 작업을 대신 승인 | 없음 (대화 출력만. 실제 노트 기록은 Memory Librarian이 담당) | 다음 단계(Build Readiness)로 넘어가려면 사용자 승인 필요 |
| **Safety-Minimality** | Minimality Guardian, Skeptic, Risk Guardian | 과잉 구현 감지, 성급한 판단에 반박 질문 던지기, 위험 작업 감지, 더 작은 대안 제시, 승인 요청 카드 작성 | 실제 도구 호출 차단(집행은 PreToolUse 훅과 scope-check.js가 담당), 코드 작성 | 없음 (분석과 경고만) | 없음 — 이 그룹은 승인을 "받는" 쪽이 아니라 승인을 "요구하는" 쪽 |
| **Builder** | Builder, Project Explorer, Debugger | Project Explorer: 기존 코드·구조 읽기, 파일맵 작성. Builder: 승인된 계획 안에서 코드 작성·수정. Debugger: 오류 원인 분석, 수정 계획 작성 | 계획 밖 기능 추가, 새 의존성 임의 설치, 인증/결제/배포 임의 변경. Project Explorer와 Debugger는 코드를 직접 수정하지 않음(제안까지만, 반영은 Builder가) | 제품 코드 (Builder만. Single Writer Principle) | Build Readiness 통과 + 사용자 승인 완료 후에만 쓰기 가능. 범위 안이어도 매번 사람이 직접 확인 |
| **Evidence-Memory** | Evidence Reviewer, Memory Librarian | Evidence Reviewer: 완료 증거 확인, 빌드/테스트/파일/사용자 흐름 검증, 완료 상태 정확히 분류. Memory Librarian: Session Memory·Decision Record·Error Record·Playbook·Agent Graph·Current State 업데이트 | 제품 코드 수정, 증거 없이 완료 선언 | 볼트 노트 (Memory Librarian) | 기록 자체는 승인 불필요(사실 기반). 단 Evidence Reviewer가 증거 부족을 확인하면 완료 표현 사용이 제한됨 |

## 공통 원칙

- 제품 코드를 실제로 쓰는 에이전트는 언제나 Builder 한 명뿐입니다.
- 볼트(Obsidian) 노트를 실제로 쓰는 에이전트는 언제나 Memory Librarian입니다.
- 나머지 에이전트는 읽고, 분석하고, 제안하고, 경고할 뿐 파일을 직접 바꾸지 않습니다.
- 위험 작업의 실제 차단은 에이전트의 판단이 아니라 PreToolUse 훅이 결정론적으로 집행합니다. 에이전트는 그 전에 "이건 위험하다"고 알리는 역할까지만 합니다.

## 지금 상태에 대한 참고

이 문서는 04_AGENT_SPEC에 정의된 13개 개념 에이전트를 4개 런타임 역할로 묶어 정리한 것입니다. 실제 `.claude/agents` 파일 구조가 4개 역할 단위로 합쳐질지, 13개 개별 파일로 유지될지는 이후 구현 단계에서 정해집니다. 이 표는 어느 쪽으로 구현되어도 "무엇을 할 수 있는가"의 기준으로 그대로 쓸 수 있습니다.

## 관련 문서

- `docs/04_AGENT_SPEC.md` — 13개 에이전트 개별 명세의 원본
- `docs/07_MODEL_ROUTING_SPEC.md` — 에이전트별 모델 티어

---

관련: [[Model Routing Rules]] · [[Parallel Council Rules]] · [[Safety Rules]] · [[Glossary]]
