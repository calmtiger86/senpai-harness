# 05. Obsidian Vault Specification

## Obsidian의 역할

Obsidian은 Senpai Harness의 작업 두뇌입니다.

역할:

- 프로젝트 기억 저장소
- 결정 기록소
- 오류 해결 노트
- 완료 증거판
- 반복 작업 플레이북
- 에이전트 영향 그래프
- 다음 세션 인수인계 문서

## Vault 구조

```text
vault/
├── 00_Dashboard/
│   ├── Home.md
│   ├── Today.md
│   ├── Continue From Last Session.md
│   ├── Decisions Needed.md
│   ├── Errors Radar.md
│   └── Completion Evidence.md
│
├── 10_Projects/
│   └── {project-name}/
│       ├── Project Home.md
│       ├── Project Brief.md
│       ├── Unknown Map.md
│       ├── PRD.md
│       ├── Current State.md
│       ├── Phase Plan.md
│       ├── Task Log.md
│       ├── Verification.md
│       ├── Session Memory.md
│       └── Project Wiki.md
│
├── 20_Decisions/
│   ├── Decision Index.md
│   └── ADR-0001-example.md
│
├── 30_Errors/
│   ├── Error Index.md
│   └── ERR-0001-example.md
│
├── 40_Playbooks/
│   ├── Playbook Index.md
│   └── PB-0001-example.md
│
├── 50_Concepts/
│   └── Concept Index.md
│
├── 60_Agent_Graph/
│   ├── Agent Graph.md
│   ├── Edge Logs.md
│   ├── Connectivity Matrix.md
│   └── Rewire History.md
│
├── 70_Sources/
│   ├── raw/
│   └── clipped/
│
├── 80_Sessions/
│   ├── Session Index.md
│   └── YYYY-MM-DD/
│
└── 90_System/
    ├── Schema.md
    ├── Autonomy Contract.md
    ├── Meeting Rules.md
    ├── Unknown Detector.md
    ├── Build Gates.md
    ├── Minimality Ladder.md
    ├── Evidence Rules.md
    ├── Model Routing Rules.md
    ├── Parallel Council Rules.md
    ├── Agent Capability Matrix.md
    ├── Safety Rules.md
    └── Glossary.md
```

## 주요 노트 명세

### `Project Home.md`

역할:

프로젝트의 한눈에 보기 페이지입니다.

포함:

- 한 줄 설명
- 현재 단계
- 현재 MVP 범위
- 중요한 결정
- 최근 오류
- 완료 증거 상태
- 다음 추천

### `Unknown Map.md`

역할:

사용자가 모르는 숨은 결정을 정리합니다.

Template:

```md
---
type: unknown_map
project: {project}
status: active
updated: {date}
---

# Unknown Map

## 사용자가 말한 것

## 아직 모르는 것

### 제품 방향

### 사용자 흐름

### 데이터 저장

### 로그인/인증

### 개인정보/보안

### 배포/운영

### 검증 기준

## 이번 회의에서 결정할 것

1.
2.
3.
```

### `Decision Record`

파일명:

```text
ADR-0001-short-title.md
```

Template:

```md
---
type: decision
project: {project}
status: accepted
created: {date}
impact: {low|medium|high}
---

# ADR-0001 {title}

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

### `Phase Plan.md`

Template:

```md
---
type: phase_plan
project: {project}
phase: {phase}
status: active
---

# Phase Plan

## 목표

## 이번에 할 것

## 이번에 하지 않을 것

## 작업 체크리스트

- [ ]

## 완료 증거

- [ ]

## 승인 상태

- [ ] 사용자가 범위를 이해함
- [ ] 사용자가 진행을 승인함
```

### `Completion Evidence.md`

Template:

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

### `Error Record`

파일명:

```text
ERR-0001-short-title.md
```

Template:

```md
---
type: error
project: {project}
status: open
created: {date}
recurrence_count: 1
---

# ERR-0001 {title}

## 증상

## 오류 메시지

## 원인 후보

## 확인 순서

## 실제 원인

## 해결 방법

## 검증 결과

## 다음에 먼저 확인할 것

## 관련 오류
```

### `Playbook`

파일명:

```text
PB-0001-short-title.md
```

Template:

```md
---
type: playbook
status: active
created: {date}
used_count: 0
---

# PB-0001 {title}

## 언제 쓰나

## 먼저 확인할 것

## 해결 순서

1.
2.
3.

## 주의할 점

## 관련 오류 기록
```

### `Agent Graph.md`

역할:

어떤 에이전트가 누구에게 영향을 줬는지 사람이 읽을 수 있게 정리합니다.

포함:

- 이번 작업의 강한 경로
- 보조 경로
- 차단된 경로
- 사용자 결정이 영향을 준 지점
- 다음 작업의 라우팅 변경

## Frontmatter 규칙

모든 주요 노트는 최소한 아래 frontmatter를 가집니다.

```yaml
type: note_type
project: project_name
status: active|done|deferred|open|closed
created: YYYY-MM-DD
updated: YYYY-MM-DD
```

## 자동 업데이트 규칙

하네스는 의미 있는 작업 후 아래 파일을 갱신해야 합니다.

- `Current State.md`
- `Session Memory.md`
- `Task Log.md`
- `Decision Index.md`
- `Error Index.md`
- `Completion Evidence.md`
- `Agent Graph.md`
- `Edge Logs.md`
