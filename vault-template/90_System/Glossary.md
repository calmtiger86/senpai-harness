---
type: system_reference
status: active
updated: "{date}"
---

# Glossary

이 하네스 곳곳에서 반복해서 쓰이는 용어를 한 곳에 모았습니다. 다른 문서에서 낯선 단어를 만나면 이 페이지로 돌아와 뜻을 확인하세요.

## 회의 (Meetings)

- **Orientation Meeting** — 처음 프로젝트를 시작하거나 맥락이 불명확할 때 여는 회의
- **Discovery Meeting** — 사용자가 모르는 숨은 결정이 많을 때 여는 회의
- **Design Meeting** — 여러 설계 선택지를 비교해야 할 때 여는 회의
- **Scope Meeting** — MVP에 넣을 것과 뺄 것을 정하거나, 계획 밖 변경이 감지됐을 때 여는 회의
- **Build Readiness Meeting** — 실제 구현 전에 진행 가능 여부를 확인하는 회의
- **Review Meeting** — 구현 결과를 검토하고 다음 방향을 정하는 회의
- **Checkout Meeting** — 세션을 정리하고 다음 시작점을 저장하는 회의

## 결정과 기록 (Decisions & Records)

- **Decision Card** — 새 기능 요청 속에 숨어있는 결정을 사용자가 고를 수 있는 선택지로 정리한 카드
- **Decision Record (ADR)** — 사용자가 고른 결정과 그 이유를 남기는 기록 (`20_Decisions/ADR-XXXX-제목.md`)
- **Unknown Map** — 사용자가 아직 모르는 숨은 결정을 범주별로 정리한 지도
- **Phase Plan** — 승인된 범위 안에서 만들 것과 만들지 않을 것, 체크리스트를 담은 실행 계획
- **Error Record** — 오류의 증상, 원인 후보, 해결 방법을 남기는 기록 (`30_Errors/ERR-XXXX-제목.md`)
- **Playbook** — 같은 오류가 3회 이상 반복될 때 만들어지는, 다음에 바로 쓸 수 있는 해결 절차서

## 검증 (Evidence)

- **Evidence Loop** — 완료라고 말하기 전에 실제 증거(빌드, 테스트, 파일 상태)를 확인하는 절차
- **Completion Evidence Board** — 어떤 작업이 진짜로 끝났고, 어떤 작업이 증거가 부족한지 보여주는 노트
- **Verification Needed** — 파일이 바뀐 뒤 아직 확인 절차를 거치지 않았다는 표시

## 안전과 최소화 (Safety & Minimality)

- **Minimality Ladder** — 과잉 구현을 막기 위해 순서대로 확인하는 7단계 질문 (지금 필요한가 → 이해했는가 → 이미 해결책이 있는가 → 플랫폼 기본 기능으로 되는가 → 이미 설치된 도구로 되는가 → 더 작은 버전으로 먼저 검증할 수 있는가 → 그때만 최소 구현)
- **Single Writer Principle** — 실제 제품 파일을 수정하는 에이전트는 한 번에 하나(Builder)만 허용한다는 원칙
- **Fail-closed** — 지금 상태를 확신할 수 없을 때는 진행이 아니라 무조건 막는 쪽을 선택하는 안전 원칙
- **Scope Drift** — 계획에 없던 변경이 조용히 끼어들어 작업 범위가 커지는 현상

## 시스템 개념 (System Concepts)

- **Guided Auto-Drive** — AI가 혼자 알아서 코딩하는 것이 아니라, 자동으로 올바른 회의를 열고 승인된 범위 안에서만 실행하는 Senpai Harness의 자율주행 방식
- **Parallel Council Router** — 사용자 요청을 여러 관점의 에이전트에게 나누어 분석시키고, 그 결과를 회의 카드로 종합하는 라우터
- **Auto Model Routing** — 작업 성격에 맞는 AI 모델 등급(tier)을 자동으로 고르는 기능
- **Edge Log (DDTF-inspired)** — 어떤 에이전트의 판단이 다른 어떤 결과로 이어졌는지 기록하는 로그
- **Agent Graph** — 어떤 에이전트가 누구에게 영향을 줬는지 사람이 읽을 수 있게 정리한 그래프
- **Understanding State** — 사용자가 지금 얼마나 이해했는지 추적하는 상태값 (unknown → explained → user_confirmed → decision_confirmed 등)
- **Obsidian Brain** — 결정, 오류, 검증, 세션 기억을 모두 저장하는 이 Obsidian Vault 자체를 가리키는 말

## 관련 문서

- `docs/00_CONCEPT.md`, `docs/02_PRODUCT_SPEC.md`, `docs/04_AGENT_SPEC.md`, `docs/07_MODEL_ROUTING_SPEC.md` — 위 용어들의 원본 출처

---

관련: [[Autonomy Contract]] · [[Meeting Rules]] · [[Evidence Rules]] · [[Safety Rules]]
