# 10. Claude Code CLI Implementation Prompt

> **정정 (회고 감사)**: 이 프롬프트는 "넓은 스켈레톤(문서·stub·스키마)을 먼저 만들라"는 원래 지시이고, 그대로 실행되지 않았다. 실제 빌드는 `precious-forging-wind.md`의 walking-skeleton-first 계획으로 대체됐다 — P0(훅 발화 검증) → P1(안전 코어) → P2(vault/skills) → P3(엔드투엔드 1바퀴) → P4(확장) 순서로 진행했고, 아래 프롬프트가 나열하는 스크립트 대부분(`install.js`, `update-obsidian.js`, `score-edge.js` 등)은 의도적으로 만들지 않았거나 다른 방식(스킬이 `Write` 도구로 직접 처리)으로 대체됐다. 지금 실제로 무엇이 있는지는 `docs/08_MVP_SCOPE.md`를 참고할 것 — 아래 프롬프트를 현재 상태의 서술로 읽지 말 것.

아래 프롬프트를 Claude Code CLI의 첫 작업 지시로 사용하세요.

---

너는 `Senpai Harness`를 구현하는 Claude Code CLI다.

이 프로젝트는 최종 공개 전까지 비공개 GitHub 저장소에서 관리한다. 지금은 공개용 문서 작성이 아니라, 실제 하네스 구현을 위한 프로젝트 저장소를 만드는 단계다.

## 제품 정의

Senpai Harness는 비개발자가 AI의 작업 속도를 놓치지 않도록, 먼저 묻고, 쉽게 설명하고, 함께 결정하고, 승인된 범위만 만들고, 모든 결정과 실패를 Obsidian에 남기는 AI 선배 하네스다.

Senpai Harness의 자율주행은 AI가 혼자 마음대로 코딩하는 것이 아니다. 자율주행의 의미는 다음이다.

- 상황을 자동으로 읽는다.
- 필요한 회의를 자동으로 연다.
- 사용자가 모르는 숨은 결정을 드러낸다.
- 쉬운 말로 선택지를 설명한다.
- 사용자가 이해하고 승인한 범위 안에서만 구현한다.
- 완료 전 증거를 확인한다.
- 결정, 오류, 검증, 다음 작업을 Obsidian에 남긴다.


## 배포 전략

Senpai Harness는 1차로 Claude Code Plugin으로 배포한다.

MCP는 MVP 필수 구현 대상이 아니다. MCP는 Phase 2에서 Obsidian 검색, Session Memory 조회, Error / Playbook 검색, Agent Graph / Edge Log 조회를 위한 선택 확장으로 설계만 남긴다.

현재 구현 저장소는 비공개 GitHub 저장소로 관리한다. 완성 후 공개 배포용 저장소는 Claude Code plugin marketplace 구조로 정리한다.

1차 구현에서 해야 할 일:

- `.claude-plugin/plugin.json` 생성
- README에 plugin-first 배포 전략 작성
- docs에 Phase 2 MCP 확장 계획 작성
- 공개 배포 전 marketplace 구조로 전환 가능하도록 파일 구조를 유지

1차 구현에서 하지 말 것:

- 실제 MCP 서버 구현
- 원격 서버 구현
- 외부 DB 구현
- Obsidian plugin 구현

## 반드시 지킬 원칙

1. 바로 코딩하지 말고 먼저 저장소 구조를 만든다.
2. MVP 범위만 구현한다.
3. 문서와 템플릿을 먼저 만든다.
4. 그다음 agents, skills, commands를 만든다.
5. 그다음 scripts와 hooks를 구현한다.
6. 기존 파일을 덮어쓰기 전 백업하거나 확인한다.
7. secret 파일, 환경변수, 토큰, 키 파일을 읽거나 출력하지 않는다.
8. 사용자 승인 전 제품 코드 수정이 일어나지 않도록 설계한다.
9. 완료 증거 없이 완료라고 말하지 않는 Evidence Loop를 구현한다.
10. 병렬 에이전트는 기본적으로 읽기 전용 분석만 허용한다.
11. 실제 파일 쓰기는 Single Writer 원칙을 따른다.

## 먼저 읽을 문서

다음 문서를 순서대로 읽고 구현 계획을 세워라.

1. `docs/00_CONCEPT.md`
2. `docs/01_PRD.md`
3. `docs/02_PRODUCT_SPEC.md`
4. `docs/03_TECHNICAL_SPEC.md`
5. `docs/04_AGENT_SPEC.md`
6. `docs/05_OBSIDIAN_VAULT_SPEC.md`
7. `docs/06_HOOKS_SPEC.md`
8. `docs/07_MODEL_ROUTING_SPEC.md`
9. `docs/08_MVP_SCOPE.md`
10. `docs/09_ACCEPTANCE_CRITERIA.md`

## 1차 작업 목표

이번 첫 작업에서는 아래를 완료하라.

### A. 저장소 뼈대 생성

생성할 것:

```text
README.md
LICENSE
package.json
.claude-plugin/plugin.json
.claude/settings.json
# 공개 배포 전 marketplace 구조로 전환할 수 있도록 marketplace.json 초안도 docs 또는 examples에 작성

# project-template/senpai.config.yaml, project-template/CLAUDE.md, project-template/AGENTS.md
# -- 이 셋은 이 저장소 자체의 루트 파일이 아니다. Senpai Harness가 최종 사용자 프로젝트에
# 심어 넣는 산출물이라 project-template/ 아래 초안으로 둔다(2026-07 정정, docs/08 §9 참고).
```

### B. Claude 구조 생성

생성할 것:

```text
.claude/agents/*.md
.claude/skills/*/SKILL.md
.claude/commands/*.md
.claude/hooks/*.js
```

hook 파일은 첫 단계에서는 안전한 stub로 만들어도 된다. 단, 각 hook의 역할과 TODO를 주석으로 명확히 적어라.

### C. Obsidian Vault Template 생성

생성할 것:

```text
vault-template/00_Dashboard/
vault-template/10_Projects/
vault-template/20_Decisions/
vault-template/30_Errors/
vault-template/40_Playbooks/
vault-template/50_Concepts/
vault-template/60_Agent_Graph/
vault-template/70_Sources/
vault-template/80_Sessions/
vault-template/90_System/
```

각 폴더에는 기본 `.md` 파일을 생성하라.

특히 `90_System`에는 아래 파일이 반드시 있어야 한다.

```text
Schema.md
Autonomy Contract.md
Meeting Rules.md
Unknown Detector.md
Build Gates.md
Minimality Ladder.md
Evidence Rules.md
Model Routing Rules.md
Parallel Council Rules.md
Agent Capability Matrix.md
Safety Rules.md
Glossary.md
```

### D. 템플릿 생성

생성할 것:

```text
templates/project-brief.md
templates/unknown-map.md
templates/decision-card.md
templates/decision-record.md
templates/minimality-check.md
templates/completion-evidence.md
templates/error-record.md
templates/playbook.md
templates/session-checkin.md
templates/session-checkout.md
templates/nondev-summary.md
```

(`templates/phase-plan.md`는 원래 이 목록에 있었으나 `vault-template/10_Projects/_template/Phase Plan.md`와 중복 divergent 사본이 되어 P4.5에서 삭제, 단일 진실 소스로 통일했다.)

### E. scripts stub 생성

생성할 것:

```text
scripts/install.js
scripts/uninstall.js
scripts/doctor.js
scripts/detect-project.js
scripts/detect-project-state.js
scripts/classify-user-intent.js
scripts/select-meeting.js
scripts/run-minimality-ladder.js
scripts/update-obsidian.js
scripts/score-edge.js
scripts/update-matrix.js
scripts/detect-repeated-error.js
scripts/promote-playbook.js
scripts/select-parallel-council.js
scripts/route-model-tier.js
scripts/protect-secrets.js
scripts/lint-vault.js
```

첫 작업에서는 완전한 구현보다, 함수 구조와 안전한 기본 동작을 우선한다.

### F. data schema 생성

생성할 것:

```text
data-schema/event-log.schema.json
data-schema/edge-log.schema.json
data-schema/state-log.schema.json
data-schema/model-routing.schema.json
```

### G. smoke test 준비

생성할 것:

```text
tests/README.md
tests/fixtures/sample-project/
tests/smoke/README.md
```

## 구현 방식

1. 먼저 전체 파일 생성 계획을 제시하라.
2. 계획 승인 후 파일을 생성하라.
3. 생성 후 `tree` 또는 파일 목록을 보여줘라.
4. `node scripts/doctor.js`가 최소한 실행되도록 만들어라.
5. `node scripts/classify-user-intent.js "로그인 기능 붙여줘"`가 add_feature를 출력하도록 만들어라.
6. `node scripts/select-meeting.js add_feature`가 discovery_meeting 또는 scope_meeting을 출력하도록 만들어라.
7. 모든 출력은 비개발자가 이해할 수 있는 메시지를 포함해야 한다.

## 금지 사항

- MVP 범위를 넘어 웹 대시보드를 만들지 마라.
- 외부 API 연동을 하지 마라.
- 완전한 멀티모델 호출 구현을 하지 마라. 지금은 routing rule과 stub만 만든다.
- 복잡한 DB를 추가하지 마라.
- Obsidian 외부 SaaS 연동을 추가하지 마라.
- 사용자의 secret 파일을 읽지 마라.
- 기존 파일을 무단 덮어쓰지 마라.

## 완료 보고 형식

작업이 끝나면 아래 형식으로 보고하라.

```md
# Senpai Harness 1차 구현 결과

## 생성한 것

## 아직 stub인 것

## 실행 확인

## 다음 작업 제안

## 주의할 점
```

시작하라.
