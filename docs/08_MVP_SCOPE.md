# 08. MVP Scope

## MVP 목표

Senpai Harness MVP는 “완전한 자동 개발 시스템”이 아닙니다.

MVP의 목표는 비개발자가 Claude Code CLI에서 명령어를 외우지 않아도, 하네스가 자동으로 회의를 열고, 숨은 결정을 드러내고, 사용자 승인 후 작은 작업을 진행하고, 완료 증거와 작업 기억을 Obsidian에 남기는 기본 흐름을 구현하는 것입니다.


## 배포 범위

### MVP 배포 형태

MVP는 Claude Code Plugin으로 배포 가능한 구조를 목표로 한다.

MVP에 포함한다:

- `.claude-plugin/plugin.json`
- 공개 배포 전 변환 가능한 plugin marketplace 구조
- install / doctor script
- plugin README 초안
- 사용자 설치 안내 초안

MVP에서 제외한다:

- 실제 MCP 서버 구현
- 원격 서버 운영
- 외부 데이터베이스
- Obsidian plugin
- 웹 대시보드

### Phase 2 확장 범위

MCP는 Phase 2에서 선택 확장으로 설계한다.

Phase 2 MCP 후보 기능:

- Obsidian Vault 검색
- Session Memory 질의
- Error Record / Playbook 검색
- Agent Graph / Edge Log 조회
- Project State 조회
- 장기 기억 기반 recall

MVP에서는 MCP 파일과 폴더를 만들 필요는 없지만, 기술 명세와 README에는 Phase 2 확장 계획을 남긴다.

## MVP 1차 포함 범위

### 1. 프로젝트 문서와 기본 설정

이 절은 **이 저장소(senpai_harness_project) 자체의** 루트 파일만 다룬다. `CLAUDE.md`/`AGENTS.md`/`senpai.config.yaml`는 여기 속하지 않는다 — §9 참고(2026-07 재분류, 아래 "정정" 참고).

- `README.md` — **미구현**: 배포 패키징(Phase 7) 몫으로 아직 없음. §"MVP 완료 정의" 참고.
- `.claude-plugin/plugin.json` — 실존.
- `.claude/settings.json` — 실존.

**정정 (하네스 엔지니어링 딥리서치 + 사용자 확인, 2026-07)**: 원래 이 절에 `CLAUDE.md`·`AGENTS.md`·`senpai.config.yaml`가 이 저장소 자신의 루트 파일인 것처럼 함께 있었다. 이 저장소는 Senpai Harness를 **만드는** 프로젝트이지 Senpai Harness가 **설치되어 동작하는** 프로젝트가 아니므로, 이 저장소 자체는 고유 CLAUDE.md/AGENTS.md 없이 전역 Claude Code 설정을 그대로 따르는 게 맞다(현재 이 저장소 루트에 CLAUDE.md가 없는 것은 결함이 아니라 정상 상태). 세 파일은 Senpai Harness가 **대상(최종 사용자) 프로젝트**에 심어 넣는 산출물이라 §9로 옮겼다.

### 2. Obsidian Vault Template

- `00_Dashboard`
- `10_Projects`
- `20_Decisions`
- `30_Errors`
- `40_Playbooks`
- `50_Concepts`
- `60_Agent_Graph`
- `70_Sources`
- `80_Sessions`
- `90_System`

### 3. Templates

- project-brief
- unknown-map
- decision-card
- decision-record
- phase-plan
- minimality-check
- completion-evidence
- error-record
- playbook
- session-checkin
- session-checkout
- nondev-summary

### 4. Agents

- Senpai Orchestrator
- Meeting Selector
- Unknown Detector
- Product Strategist
- Minimality Guardian
- Project Explorer
- Builder — **2026-07 확장: "빌드 중 판단 규칙 — 선배의 4단 판정"**(`agents/builder-runtime.md`). 원래 7대 축 어디에도 속하지 않던 새 축이다: Unknown Map(§5의 hidden-decision 발굴)이 프로젝트 시작 시 한 번 도는 체크리스트라면, 이건 승인된 `allowed_files` **범위 안에서** 실제로 만드는 동안 계속 나오는 판단(그림자를 넣을지, 데이터를 어디에 저장할지 등)을 (a)멈추고 묻기 (b)알리고 진행 (c)조용히 알아서 하기로 가르는 프롬프트 지침이다. 코드 강제 메커니즘이 아니며 T0~T3(파일 접근 승인)를 대체하지 않는다.
- Debugger
- Evidence Reviewer
- Memory Librarian
- Nondev Explainer
- Skeptic
- Risk Guardian

### 5. Skills

- guided-auto-drive
- meeting-system
- unknown-map
- decision-card
- minimality-ladder
- guided-plan
- evidence-loop
- obsidian-brain-update
- error-to-playbook — **구현 완료 (2026-07)**. `docs/01_PRD.md` 성공 기준 "반복 오류는 Error Record와 Playbook 후보로 정리됩니다"가 그때까지 실제로 구현된 적 없다는 걸 재점검 중 발견해 만들었다. 개별 `ERR-000N.md` 생성/갱신 + `recurrence_count` 3회 이상 시 `PB-000N.md` 승격을 담당(`obsidian-brain-update`의 `Error Index.md` 테이블 관리와는 스코프 분리, 상세는 `skills/error-to-playbook/SKILL.md` 참고).
- ddtf-edge-log — **부분 구현**: `Edge Logs.md`는 `obsidian-brain-update` 스킬이 매 작업마다 실제로 행을 추가하는 살아있는 누적 로그다(별도 `score-edge.js` 스크립트 없이, Decision Index/Error Index와 같은 방식으로 스킬이 직접 `Write`). `weight` 값 근거는 `vault-template/60_Agent_Graph/Edge Logs.md` 참고. `Connectivity Matrix.md`/`Rewire History.md`는 여전히 스키마만 존재 — 여러 회차의 Edge Log를 집계/비교해야 채울 수 있어서 아직 소비처가 없다.
- parallel-council-routing — **정정 (2026-07, 배포 전 최종 재점검): "의도적 지연"이라는 표현을 더 이상 쓰지 않는다.** 배포가 임박한 지금 시점부터는 초안/보류 상태를 최종 상태로 인정하지 않기로 했다 — 실제 라우팅 로직(불확실성/위험도 평가 → Council mode 선택 → 병렬 읽기전용 스폰)을 만들지, 아니면 이 항목 자체를 스펙에서 제거할지 둘 중 하나로 결정한다(진행 상황은 §11·§12 논의, `docs/09_ACCEPTANCE_CRITERIA.md` 섹션 11 참고). decision-card의 순차 4관점은 그 자체로 유용하지만 이 항목의 대체 구현으로 간주하지 않는다(병렬이 아니라 순차이므로 설계 의도가 다름).
- nondev-progress-report — **정정 (2026-07-17, 배포 전 최종 결정): 별도 스킬로 분리하지 않기로 확정, `agents/nondev-explainer.md`에 흡수됨.** "비개발자 말로 진행 보고"는 `agents/nondev-explainer.md`의 역할(비개발자 언어 번역, 몰라도 되는 것/알아야 하는 것/결정해야 하는 것/추천/이유 출력 형식)과 `evidence-loop`의 "비개발자용 결과 설명" 단계, `guided-auto-drive`의 `explain_nondev` 인라인 라우팅으로 이미 실사용이 흡수돼 있어, 별도 스킬을 새로 만들지 않기로 확정했다.

### 6. Commands

명령어는 보조 기능입니다(몰라도 자연어 대화로 다 됩니다).

**정정 (2026-07, 배포 전 최종 재점검): 7개 전부 구현 완료.** 아래 각 항목의 파일명(백틱)이 실제 존재하는 `commands/<이름>.md`다. 실제 호출은 원래 계획된 이름(`/senpai-status` 등, 접두어 없음)이 아니라 Claude Code 플러그인 커맨드 네임스페이스 규칙에 따라 `/senpai-harness:<이름>`이다(라이브 세션으로 확인됨).

- `init` — 실제 호출 `/senpai-harness:init`. 이 프로젝트에 설치.
- `doctor` — 실제 호출 `/senpai-harness:doctor`. `node scripts/doctor.js` 실행 결과를 그대로 보여줌.
- `reset` — 실제 호출 `/senpai-harness:reset`. 관리 중단 방법 안내(`[senpai-stop]` 문구 유도).
- `status` — 실제 호출 `/senpai-harness:status`(2026-07 신설). `.senpai/state.json` + `Current State.md`를 비개발자 언어로 요약.
- `recall` — 실제 호출 `/senpai-harness:recall`(2026-07 신설). 최근 세션 기록 + 미해결 결정/오류를 불러옴.
- `save` — 실제 호출 `/senpai-harness:save`(2026-07 신설). `obsidian-brain-update` 스킬을 호출해 세션을 끝내지 않고 중간 저장.
- `help` — 실제 호출 `/senpai-harness:help`(2026-07 신설). 사용법 + 승인 문구 + 커맨드 목록 안내.

### 7. Hooks

MVP에서는 hook 파일을 생성하고 기본 동작을 구현합니다.

- SessionStart
- UserPromptSubmit
- PreToolUse
- PostToolUse
- TaskCompleted
- Stop
- SessionEnd

### 8. Scripts

**정정 (2026-07, 배포 전 최종 재점검)**: 아래 "대체 구현됨" 표시는 스크립트 파일이 없다는 뜻이 아니라, **같은 기능이 스크립트가 아닌 다른 형태(주로 markdown 스킬의 `Write` 도구 직접 호출)로 실제로 동작 중**이라는 뜻이다. "미구현"이라는 옛 표현은 "아직 아무 기능도 없다"로 오독되기 쉬워, 실제로 대체 구현이 끝난 항목과 진짜 미구현 항목을 표에서 분리한다.

**대체 구현됨 (기능 완료, 스크립트 형태만 다름 — 재작업 불필요)**

- install.js / uninstall.js → **`scripts/init.js`(+ `commands/init.md`, `/senpai-harness:init`)로 대체 구현**. `tests/unit/init.test.js`로 라이브 검증됨.
- detect-project.js / detect-project-state.js → **`skills/obsidian-brain-update/SKILL.md`의 "프로젝트 & Vault 경로 확인" 절차로 대체 구현**(스크립트 대신 스킬이 Read/Glob으로 직접 판단).
- run-minimality-ladder.js → **`skills/minimality-ladder/SKILL.md`로 대체 구현**(7단계 사다리를 스킬이 직접 실행하고 `templates/minimality-check.md` 기반 노트를 `Write`).
- update-obsidian.js → **`skills/obsidian-brain-update/SKILL.md`로 대체 구현**(M1/M2 수정 이후 `Write` 도구로 직접 갱신, 별도 스크립트 경유 없음).
- score-edge.js → **`skills/obsidian-brain-update/SKILL.md`로 대체 구현**(`Edge Logs.md`에 매 작업마다 행을 직접 추가 — 실제로 누적되는 것을 라이브로 확인함). 단, 이 로그를 집계하는 소비처는 별개 문제 — 아래 update-matrix.js 참고.
- detect-repeated-error.js / promote-playbook.js → **`skills/error-to-playbook/SKILL.md`로 대체 구현**(2026-07). Error Index/ERR 파일 대조로 반복 오류를 판단하고, 3회 이상이면 Playbook을 직접 `Write`. `docs/01_PRD.md` 성공 기준에 명시돼 있던 항목이 실제로 없었던 것을 재점검 중 발견해 만들었다.
- lint-vault.js → **`tests/unit/docs-consistency.test.js`로 대체 구현**(문서-현실 정합성 대조를 스크립트가 아니라 테스트 스위트가 상시 수행).
- classify-user-intent.js → **개명됨**: `scripts/classify-intent.js`로 이름이 바뀌어 실존.

**진짜 미구현 — 배포 전 결정 필요 (버킷 D, 별도 우선순위로 진행 중)**

- update-matrix.js — **미구현**: `Connectivity Matrix.md`/`Rewire History.md` 집계 로직 자체가 없음.

**정정 (2026-07, WP-B1)**: route-model-tier.js는 위 목록에서 "미구현"이었으나 이제 **구현됨** — `scripts/route-model-tier.js`가 `docs/07_MODEL_ROUTING_SPEC.md`의 `model_tiers`/`agent_model_map`을 데이터(단일 진실원)로 옮겼고, `tests/unit/route-model-tier.test.js`가 agents/*.md 17개 전수의 frontmatter `model:` 값을 이 매핑과 기계 대조한다. 단 "동적 승격"(escalate_to를 런타임에 판단해 티어를 올리는 로직)은 여전히 스크립트로 존재하지 않는다 — escalate 규칙은 데이터로만 옮겨졌고 실제 승격 판단은 에이전트 문서 지침으로 동작하며, long_context는 WP-B2 결론(07 문서 "long_context 티어 실현 가능성 조사")에 따라 별도 API 티어가 아니라 `sonnet` + 분할 읽기/누적 요약 전략으로 실현한다.

**정정 (2026-07, WP-B3)**: select-parallel-council.js도 이제 **구현됨** — `scripts/select-parallel-council.js`가 요청 의도(intent) + 위험/복잡도 신호(signals)에 따라 5가지 Council 모드(fast_single_agent/small_council/discovery_council/debug_council/safety_council)를 선택하고, 각 모드의 `escalation` 필드가 strong_reasoning(= opus) 승격 판단을 반환한다. 테스트 `tests/unit/select-parallel-council.test.js`로 25개 시나리오 전수 검증. long_context 라우팅도 WP-B2 결론에 따라 `sonnet` + 분할 읽기/누적 요약 전략으로 확정.

**실존**: doctor.js, select-meeting.js, protect-secrets.js, route-model-tier.js, select-parallel-council.js.

### 9. 사용자(대상) 프로젝트 스캐폴딩 템플릿

**정정 (하네스 엔지니어링 딥리서치 + 사용자 확인, 2026-07)**: 아래 세 파일은 이 저장소(senpai_harness_project) 자체의 루트 파일이 아니다. Anthropic·OpenAI의 harness 용어 정의(OpenAI "harness engineering" 원문: "A short AGENTS.md ... serves primarily as a map, with pointers to deeper sources of truth elsewhere" — 얇은 진입점이지 하네스 본체가 아님)와 사용자 확인에 따라, 이 세 파일은 **Senpai Harness가 최종 사용자(비개발자) 프로젝트에 설치/초기화할 때 그 프로젝트 루트에 심어 넣는 산출물**이다 — `vault-template/`가 `vault/`로 복사되는 것(§2)과 같은 방식. 이 저장소 안에서는 `project-template/`에 초안으로 존재한다.

- `project-template/CLAUDE.md` — **정식 문구 확정(2026-07)**: Claude Code용 얇은 진입점. Guided Auto-Drive 계약을 요약하고 `vault/`·`senpai.config.yaml`을 가리킨다. 실제 판단 로직은 담지 않는다(OpenAI 원문 경고: "A monolithic manual turns into a graveyard of stale rules"). 래칫 원칙(각 줄이 실제 필요에 추적 가능) 검토를 거쳤고, 대상 프로젝트로 그대로 배달되는 파일이라 이 저장소 내부용 `ponytail:` 코멘트는 제거했다(비개발자 최종 사용자가 볼 파일에 개발 메모가 남으면 안 됨). 18줄, 200줄 제한 내.
- `project-template/AGENTS.md` — **정식 문구 확정(2026-07)**: 내용 중복(그래서 드리프트 위험) 대신 `CLAUDE.md`를 가리키는 한 줄 포인터로 작성. "Senpai Harness가 Claude Code 전용 배포인데 MVP에 필요한가" 질문을 사용자에게 확인한 결과 **포함하기로 결정**(다른 AI 코딩 도구 호환을 위한 유지비용이 거의 없는 한 줄 포인터라는 점이 근거) — 같은 이유로 미결 상태를 나타내던 `ponytail:` 코멘트도 제거.
- `project-template/senpai.config.yaml` — **초안 생성됨**: `docs/03_TECHNICAL_SPEC.md` "설정 파일" 절의 스키마를 그대로 옮김.

**정정 (2026-07)**: 이 세 파일을 실제로 대상 프로젝트 루트에 복사해 넣는 메커니즘이 `scripts/init.js`(+ `commands/init.md`, `/senpai-harness:init`)로 구현 완료됐다 — `docs/SAFETY_ENFORCEMENT_POLICY.md` G0의 init 닭-달걀 문제 정정에 따라 모델의 Write 도구가 아니라 단일 Bash 호출 안에서 직접 `fs`로 쓴다(`senpai.config.yaml`은 반드시 마지막). 기존 `vault/`는 보존, 기존 `CLAUDE.md`/`AGENTS.md`는 백업 후 덮어씀, 이미 초기화된 프로젝트에서 재실행하면 아무것도 건드리지 않는다 — 이 네 가지 모두 `tests/unit/init.test.js`로 확인. 남은 것은 실제 설치 상태에서 슬래시 커맨드 발화 자체의 라이브 스모크뿐(§8 `install.js`라는 이름 자체는 채택하지 않음 — `init.js`로 대체).

## MVP에서 제외할 것

- 웹 대시보드
- Obsidian plugin
- 클라우드 동기화
- 팀 협업 기능
- 완전한 실제 멀티모델 API 호출
- 외부 벡터 데이터베이스
- 자동 배포
- 결제/인증 연동
- 외부 SaaS 연동
- 원격 서버 운영

## 구현 순서

### Phase 0. 문서와 폴더 생성

- 저장소 구조 생성
- docs 생성
- README 작성
- config 작성

### Phase 1. Obsidian Vault Template

- vault-template 생성
- System notes 생성
- dashboard notes 생성
- templates 생성

### Phase 2. Agents / Skills / Commands

- agents markdown 생성
- skills SKILL.md 생성
- commands markdown 생성

### Phase 3. Scripts 기본 구현

- install
- doctor
- detect-project
- classify-user-intent
- select-meeting
- update-obsidian

### Phase 4. Hooks 기본 구현

- SessionStart 자동 체크인
- UserPromptSubmit 의도 감지
- PreToolUse 위험 차단
- PostToolUse 변경 기록
- TaskCompleted Evidence 체크
- Stop/SessionEnd 체크아웃

### Phase 5. Edge Log / Model Routing 초안

- edge log schema
- basic score-edge
- parallel council selector
- route-model-tier

### Phase 6. Smoke Test

- 설치 확인
- vault 생성 확인
- doctor 통과
- 자연어 intent 분류 확인
- decision card 생성 확인
- evidence board 업데이트 확인

## MVP 완료 정의

MVP는 다음이 될 때 완료입니다.

**정정 (docs-consistency 검증기 도입, 회고 감사)**: 이 목록은 원래 초안 그대로 남아 있었고, **미구현**인 `scripts/install.js`·`update-obsidian.js`(§8 참고)와 개명된 `classify-user-intent`를 완료 기준으로 요구하고 있었다. 실제 구현(P0~P4.5, 라이브 검증됨)을 기준으로 다시 쓴다.

- `tests/unit/*.test.js` 전부 통과 (라이브 검증됨) — **정정**: `package.json`이 아직 없고 외부 의존성도 전혀 없어(Node 내장 모듈만 사용) `npm install` 단계 자체가 필요 없다. `node tests/unit/<파일>.test.js`로 바로 실행된다.
- 각 스킬이 필요할 때 `vault-template/`에서 그때그때 vault 문서를 복사해 생성 (**미구현**인 `scripts/install.js` 대신 이 방식으로 동작 — M5)
- `node scripts/doctor.js` 실행 시 상태 리포트 출력 (실존, 검증됨)
- 샘플 사용자 요청을 `node scripts/classify-intent.js`가 분류 (실존, 검증됨 — 원 이름 `classify-user-intent`에서 개명)
- `select-meeting.js`가 적절한 회의를 선택 (실존, 검증됨)
- `obsidian-brain-update` 스킬이 `Write` 도구로 샘플 노트를 생성/수정 (`update-obsidian.js` 스크립트가 아니라 이 방식으로 동작 — M1/M2)
- PreToolUse(`scripts/scope-check.js`, mock 아닌 실제 구현)가 위험 작업을 차단 (라이브 검증됨, 실제 모델의 자발적 우회 시도까지 차단한 이력 있음 — P4.5)
- Completion Evidence 템플릿이 생성됨 (`templates/completion-evidence.md`, `vault-template/00_Dashboard/Completion Evidence.md` 둘 다 실존)
- README에 사용법이 있음 — **미구현**: `README.md`가 저장소 루트에 아직 없다(§1 참고. `package.json`은 §1 목록엔 없지만 이 역시 아직 없다). `CLAUDE.md`·`AGENTS.md`·`senpai.config.yaml`는 이 저장소의 §1 대상이 아니라 §9 "사용자(대상) 프로젝트 스캐폴딩 템플릿" 소관이다 — `project-template/`에 초안이 있다. 원 계획(`precious-forging-wind.md` Phase 7 "Plugin Packaging")에서도 "plugin README 작성"은 P0~P4.5(기능 코어)가 아니라 배포 패키징 단계 몫으로 뒤에 있었다 — 방치가 아니라 순서상 아직 안 왔을 뿐이나, 이 항목을 "완료"로 착각하게 두면 안 되므로 여기 명시한다.


### Phase 7. Plugin Packaging

- 공개 배포용 marketplace 구조로 정리
- `.claude-plugin/marketplace.json` 생성
- `plugins/senpai-harness/.claude-plugin/plugin.json` 검증
- plugin README 작성
- 설치 명령 문서화
- Phase 2 MCP 확장 계획 문서화
