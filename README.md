# Senpai Harness

Senpai Harness는 비개발자가 AI의 작업 속도를 놓치지 않도록, 옆에서 질문하고 설명하고 결정 과정을 기록해주는 Obsidian 기반 Claude Code 플러그인입니다.

"자율주행"은 AI가 혼자 알아서 코딩한다는 뜻이 아닙니다. AI가 자동으로 올바른 회의를 열고, 숨은 결정을 사용자가 이해할 수 있는 선택지로 드러내고, **사용자가 승인한 범위 안에서만** 코드를 씁니다. 승인 없는 변경은 Write/Edit뿐 아니라 Bash를 통한 우회까지 훅(hook) 레벨에서 차단됩니다.

> **현재 상태**: 개발 중입니다. 공개 배포(GitHub 공개 저장소, marketplace 등록) 전이며, 검증이 끝나기 전까지는 로컬 설치로만 사용합니다.

## 핵심 동작

- **회의 시스템**: 새 기능/새 프로젝트 요청을 바로 구현하지 않고 Discovery·Scope·Build Readiness·Review·Checkout 회의로 라우팅
- **Obsidian Brain**: Current State, Decision Record, Phase Plan, Completion Evidence, Session Memory를 vault에 마크다운으로 저장
- **Minimality Ladder**: 구현 전 더 작은 대안이 있는지 먼저 확인
- **Evidence Loop**: 증거 없이 "완료"라고 말하지 않음
- **안전 경계(G0~G4)**: opt-in 게이트, mutating 도구 기본 거부, 결정론적 승인 캡처, 경로 정규화, fail-closed — 자세한 내용은 [`docs/SAFETY_ENFORCEMENT_POLICY.md`](docs/SAFETY_ENFORCEMENT_POLICY.md) 참고

## 설치

<!-- DRAFT: WP-C2 스크립트 실동작 확인 후 최종 확정 예정 -->

이 저장소 자체가 marketplace이자 유일한 plugin입니다(`.claude-plugin/marketplace.json`의 `source: "./"`).

### 지금 (공개 전): 로컬 설치

저장소가 아직 비공개이므로, 현재는 이 저장소를 받아 둔 컴퓨터에서 로컬 경로로만 설치할 수 있습니다:

```text
/plugin marketplace add <이 저장소의 로컬 경로>
/plugin install senpai-harness@senpai-harness
```

### 공개 후 설치 방법 (초안)

#### 권장: GitHub 기본 브랜치가 `release`인 경우

저장소의 기본 브랜치(Default branch)를 `release`로 설정한 후 짧은 명령으로 설치:

```text
/plugin marketplace add calmtiger86/senpai-harness
/plugin install senpai-harness@senpai-harness
```

이 방법은 입력할 주소가 가장 짧아 비개발자가 입력 실패할 확률이 낮습니다.

#### 차선: 기본 브랜치를 못 바꾸는 경우

브랜치를 명시해서 설치:

```text
/plugin marketplace add https://github.com/calmtiger86/senpai-harness.git#release
/plugin install senpai-harness@senpai-harness
```

### 배포 준비

현재 이 저장소는 비공개 상태입니다. 공개 전환 전에 `release` 브랜치에 로컬 전용 파일(내부 설계·감사 기록, 테스트 등)이 섞여 있지 않은지 확인하는 절차를 거칩니다. 자세한 내용은 [`docs/11_DEPLOYMENT_STRATEGY.md`](docs/11_DEPLOYMENT_STRATEGY.md)의 "release 브랜치 운영 절차" 참고.

### 설치 후 초기화

```text
/senpai-harness:init
```

`vault/`, `CLAUDE.md`, `AGENTS.md`, `senpai.config.yaml`이 생성됩니다(`senpai.config.yaml`이 하네스의 안전 경계가 켜지는 opt-in 마커입니다 — 이 파일이 없는 프로젝트에서는 어떤 검사도 실행되지 않고 Claude Code 기본 동작 그대로입니다).

문제가 있으면 `node scripts/doctor.js`로 진단할 수 있습니다.

## 구조

```text
.claude-plugin/plugin.json   # 플러그인 메타데이터
.claude-plugin/marketplace.json
agents/                      # 런타임 역할 + 정의된 서브에이전트
skills/                      # guided-auto-drive 등 절차 스킬
commands/                    # /senpai-harness:init
hooks/hooks.json             # PreToolUse/UserPromptSubmit 등 훅 등록
scripts/                     # 안전 경계 코어(state-store, approval-gate, scope-check 등)
vault-template/              # Obsidian vault 템플릿(10폴더)
project-template/            # 대상 프로젝트에 복사되는 CLAUDE.md/AGENTS.md/senpai.config.yaml
tests/unit/                  # 안전 경계 유닛 테스트
docs/                        # 설계 문서 + 검증 기록
```

## 문서

- [`docs/00_CONCEPT.md`](docs/00_CONCEPT.md) ~ [`docs/11_DEPLOYMENT_STRATEGY.md`](docs/11_DEPLOYMENT_STRATEGY.md): 설계 명세
- [`docs/SAFETY_ENFORCEMENT_POLICY.md`](docs/SAFETY_ENFORCEMENT_POLICY.md): 안전 경계 정책과 감사 이력
- [`docs/HARNESS_ENGINEERING.md`](docs/HARNESS_ENGINEERING.md): 라이브 검증 기록

## Phase 2 (계획, MVP 필수 아님)

MCP 서버로 Vault 검색, Session Memory 조회, Edge Log 분석 등을 선택적으로 확장할 수 있습니다. MVP는 MCP 없이 완전히 동작합니다.

## 라이선스

[MIT](LICENSE) — 공개 배포 시점부터 적용됩니다.
