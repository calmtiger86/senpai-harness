---
type: system_reference
status: active
updated: "{date}"
---

# Parallel Council Rules

요청이 얼마나 불명확하고 위험한지에 따라, 몇 명의 에이전트가 동시에 검토할지를 자동으로 정하는 규칙입니다(Parallel Council Router). 이 문서는 07_MODEL_ROUTING_SPEC의 병렬 라우팅 매트릭스를 그대로 정리합니다.

여러 에이전트가 동시에 의견을 낼 수는 있지만, 실제 제품 파일을 고치는 것은 언제나 Builder 한 명뿐입니다(Single Writer Principle). 병렬 실행은 사용자의 의사결정을 대체하지 않습니다 — 병렬 에이전트는 먼저 회의 준비 자료를 만들고, 사용자가 이해하고 승인한 뒤에만 구현 단계로 넘어갑니다.

## 5가지 회의 모드

| 모드 | 예시 요청 | 참여 에이전트 | 사용자 승인 |
|---|---|---|---|
| **low_uncertainty_low_risk** (fast_single_agent) | 버튼 문구 바꿔줘 | Builder, Evidence Reviewer | 선택 사항 |
| **medium_uncertainty** (small_council) | 설정 화면 추가해줘 | Minimality Guardian, Project Explorer, Builder, Evidence Reviewer | 만들기 전 필수 |
| **high_uncertainty** (discovery_council) | 새 앱 만들고 싶어 | Unknown Detector, Product Strategist, Risk Guardian, Minimality Guardian, Nondev Explainer | 필수 |
| **high_risk** (safety_council) | 로그인, 결제, 개인정보, 배포 | Risk Guardian, Skeptic, Product Strategist, Evidence Reviewer | 무조건 필수 |
| **repeated_failure** (debug_council) | 같은 에러가 또 발생 | Debugger, Memory Librarian, Project Explorer, Skeptic, Builder, Evidence Reviewer | 범위가 바뀔 때만 필수 |

## 병렬 실행 정책

기본값은 다음과 같습니다.

- 기본 모드: 읽기 전용 병렬 실행(read_only_parallel)
- Single Writer 원칙 적용
- 병렬 코드 쓰기는 허용하지 않음

승인 전에도 허용되는 것:

- 숨은 결정 탐지
- 선택지 비교
- 위험 검토
- 기존 코드 탐색
- 기억(Obsidian) 회수
- 최소 구현 검토
- UX 검토

승인 전에는 금지되는 것:

- 제품 코드 변경
- 의존성 설치
- 스키마 변경
- 인증 변경
- 결제 변경
- 배포 변경
- 파괴적 파일 작업

## Scope Drift가 감지되면 멈춘다

다음이 발생하면 실행을 멈추고 Scope Meeting을 엽니다.

- 새 기능 제안
- 새 라이브러리 제안
- 새 서버 제안
- 인증/결제/배포 범위 확장
- 계획보다 큰 파일 수정
- 새로운 데이터 저장 방식 도입

## 실제 동작 (소집 로직은 구현되어 있습니다)

Parallel Council Router는 이제 실제로 동작합니다. 어떤 모드로 소집할지와 위원 명단은 순수 함수 `scripts/select-parallel-council.js`(감사·재현 가능한 단일 진실 소스)가 결정하고, 실제 병렬 소집은 `parallel-council` 스킬이 guided-auto-drive의 "2.5 Council 소집" 단계(회의 직후, 숨은 결정 드러내기 직전)에서 최상위 대화 루프가 Task 도구로 위원들을 한 메시지 안에서 병렬 스폰하는 방식으로 실행합니다. `discovery_council`·`safety_council`·`debug_council`일 때만 실제로 스폰하고, `small_council`·`fast_single_agent`이면 스폰하지 않고 그대로 통과합니다.

### 정정 — 스폰 시점 위원 명단은 위 표와 다릅니다

위 "5가지 회의 모드" 표는 `07_MODEL_ROUTING_SPEC`의 초기 병렬 라우팅 매트릭스를 그대로 옮긴 것이라, 실제로 병렬 스폰하는 명단과 두 가지가 다릅니다(권위 있는 명단은 언제나 `scripts/select-parallel-council.js`입니다).

- **Builder와 Evidence Reviewer는 Council 위원으로 스폰하지 않습니다.** 실제 제품 파일을 고치는 일(Builder)은 Single Writer 승인 경로로만, 완료 증거 검토(Evidence Reviewer)는 별도의 Evidence 단계로만 진행됩니다. Council 소집은 전부 읽기 전용 자문이므로 이 둘이 낄 자리가 없습니다.
- **`discovery_council`은 Nondev Explainer를 위원으로 스폰하지 않습니다.** "여러 관점으로 먼저 확인하겠습니다"의 쉬운 말 종합 자체를 최상위 대화 루프가 Nondev Explainer 역할로 대신 수행합니다.

## 관련 문서

- `docs/07_MODEL_ROUTING_SPEC.md` — 병렬 라우팅 매트릭스의 원본
- `docs/04_AGENT_SPEC.md` — 병렬 실행 정책

---

관련: [[Model Routing Rules]] · [[Agent Capability Matrix]] · [[Glossary]]
