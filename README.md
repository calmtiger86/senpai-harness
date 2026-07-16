# Senpai Harness

Senpai Harness는 비개발자가 AI의 작업 속도를 놓치지 않도록, 옆에서 질문하고 설명하고 결정 과정을 기록해주는 Obsidian 기반 Claude Code 플러그인입니다.

"자율주행"은 AI가 혼자 알아서 코딩한다는 뜻이 아닙니다. AI가 자동으로 올바른 회의를 열고, 숨은 결정을 사용자가 이해할 수 있는 선택지로 드러내고, **사용자가 승인한 범위 안에서만** 코드를 씁니다. 승인 없는 변경은 Write/Edit뿐 아니라 Bash를 통한 우회까지 훅(hook) 레벨에서 차단됩니다.

> **현재 상태**: 초기 버전(0.2.0)입니다. 사용하며 이상한 점이 있으면 이슈로 알려주세요.

## 핵심 동작

- **회의 시스템**: 새 기능/새 프로젝트 요청을 바로 구현하지 않고 Discovery·Scope·Build Readiness·Review·Checkout 회의로 라우팅
- **Obsidian Brain**: Current State, Decision Record, Phase Plan, Completion Evidence, Session Memory를 vault에 마크다운으로 저장
- **Minimality Ladder**: 구현 전 더 작은 대안이 있는지 먼저 확인
- **Evidence Loop**: 증거 없이 "완료"라고 말하지 않음
- **안전 경계(G0~G4)**: opt-in 게이트, mutating 도구 기본 거부, 결정론적 승인 캡처, 경로 정규화, fail-closed — 자세한 내용은 [`docs/SAFETY_ENFORCEMENT_POLICY.md`](docs/SAFETY_ENFORCEMENT_POLICY.md) 참고

## 설치

이 저장소 자체가 marketplace이자 유일한 plugin입니다(`.claude-plugin/marketplace.json`의 `source: "./"`).

```text
/plugin marketplace add calmtiger86/senpai-harness
/plugin install senpai-harness@senpai-harness
```

이 저장소는 내부 개발 저장소(`senpai-harness-dev`)에서 배포용 파일만 골라 별도로 빌드해 배포합니다 — 자세한 내용은 [`docs/11_DEPLOYMENT_STRATEGY.md`](docs/11_DEPLOYMENT_STRATEGY.md) 참고.

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
docs/                        # 설계 문서 (00_CONCEPT ~ 11_DEPLOYMENT_STRATEGY, SAFETY_ENFORCEMENT_POLICY)
```

## 문서

- [`docs/00_CONCEPT.md`](docs/00_CONCEPT.md) ~ [`docs/11_DEPLOYMENT_STRATEGY.md`](docs/11_DEPLOYMENT_STRATEGY.md): 설계 명세
- [`docs/SAFETY_ENFORCEMENT_POLICY.md`](docs/SAFETY_ENFORCEMENT_POLICY.md): 안전 경계 정책과 감사 이력

## Phase 2 (계획, MVP 필수 아님)

MCP 서버로 Vault 검색, Session Memory 조회, Edge Log 분석 등을 선택적으로 확장할 수 있습니다. MVP는 MCP 없이 완전히 동작합니다.

## 라이선스

[MIT](LICENSE) — 공개 배포 시점부터 적용됩니다.
