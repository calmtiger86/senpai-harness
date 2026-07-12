---
type: system_reference
status: active
updated: "{date}"
---

# Model Routing Rules

비개발자는 어떤 작업에 어떤 AI 모델이 필요한지 알 필요가 없습니다. Senpai Harness는 작업 성격에 맞는 모델 등급(tier)을 내부적으로 자동 선택하고, 사용자에게는 모델 이름 대신 역할로 설명합니다. 이 문서는 07_MODEL_ROUTING_SPEC에 정의된 모델 등급과 에이전트별 기본 등급을 그대로 정리한 참고표입니다.

## 모델 티어 5가지

모델 이름은 특정 서비스에 종속되지 않도록 역할 중심으로 추상화되어 있습니다.

| 티어 | 언제 쓰는지 |
|---|---|
| **fast** | 쉬운 설명, 문서 정리, 체크리스트 업데이트, Obsidian 링크 정리 |
| **coding** | 코드 수정, 테스트 작성, 리팩터링, 코드 진단 |
| **strong_reasoning** | 숨은 결정 탐지, 제품 방향 판단, 보안/개인정보 위험 판단, 복잡한 오류 원인 분석, 완료 증거 검토 |
| **long_context** | 큰 코드베이스 읽기, 여러 세션 기록 요약, Obsidian Vault 맥락 회수 |
| **cheap_background** | 로그 정리, 중복 노트 후보 찾기, 태그 정리 |

## 에이전트별 기본 모델 티어

| 에이전트 | 기본 티어 | 승격 조건 | 실현 방식 |
|---|---|---|---|
| Meeting Selector | fast | 새 프로젝트이거나 범위가 클 때 → strong_reasoning | haiku / (haiku → opus) |
| Unknown Detector | strong_reasoning | — | opus |
| Product Strategist | strong_reasoning | — | opus |
| Minimality Guardian | strong_reasoning | — | opus |
| Project Explorer | long_context | 필요 시 coding으로 대체(fallback) | sonnet (1M 기본 컨텍스트) / 분할 읽기 전략 |
| Builder | coding | — | sonnet |
| Debugger | coding | 같은 오류가 2회 이상 반복되면 → strong_reasoning | sonnet / debug_council 소집 시 (→ opus) |
| Evidence Reviewer | strong_reasoning | — | opus |
| Memory Librarian | fast | 과거 세션 5개 이상 회수가 필요하면 → long_context | haiku / (haiku → sonnet) |
| Nondev Explainer | fast | — | haiku |
| Skeptic | strong_reasoning | — | opus |
| Risk Guardian | strong_reasoning | — | opus |

## 라우팅 판단 기준

어떤 티어를 고를지는 다음 6가지를 함께 봅니다.

- **불확실성** — 요구사항이 얼마나 불명확한가
- **위험** — 보안, 데이터, 비용, 배포 위험이 있는가
- **복잡도** — 여러 파일, 여러 기능, 여러 시스템이 연결되는가
- **되돌리기 쉬움** — 되돌리기 쉬운 작업인가
- **사용자 이해도** — 사용자가 결과를 이해하고 있는가
- **증거 요구 수준** — 완료 증거가 얼마나 필요한가

## 사용자에게 보여주는 방식

사용자에게는 절대 모델 이름을 노출하지 않고, 아래처럼 역할 중심으로만 설명합니다.

```md
# 여러 관점으로 먼저 확인하겠습니다

1. 기획 관점: 이 기능이 지금 필요한지 확인
2. 기술 관점: 기존 코드로 가능한지 확인
3. 위험 관점: 보안이나 데이터 문제가 있는지 확인
4. 최소 구현 관점: 더 작은 버전이 가능한지 확인

결과를 모아서 선택지로 정리하겠습니다.
```

## 관련 문서

- `docs/07_MODEL_ROUTING_SPEC.md` — 모델 티어와 에이전트별 매핑의 원본

---

관련: [[Parallel Council Rules]] · [[Agent Capability Matrix]] · [[Glossary]]
