# Changelog

아직 공개 배포 전이며, 버전은 로컬 개발 이력을 추적하는 용도입니다.

## [0.2.0] - Unreleased

<!-- DRAFT: WP-C2 스크립트 실동작 확인 후 최종 확정 예정. 아직 배포되지 않았으며, 이 버전 번호 상향(.claude-plugin/plugin.json, marketplace.json)은 커밋·푸시 전이므로 되돌릴 수 있다. -->

### Added (진행 중 — docs/P7_BIG_ITEMS_IMPLEMENTATION_PLAN.md 웨이브)
- **신규 커맨드 4개** (`/senpai-harness:status` / `:recall` / `:save` / `:help`): 프로젝트 단계 확인, 지난 세션 불러오기, 세션 도중 Obsidian 기억 즉시 저장, 비개발자용 사용법 안내
- **Parallel Council Router 결정 코어** (WP-A1, `scripts/select-parallel-council.js`): 감지된 의도 + 위험/상태 신호를 5개 Council 모드(safety/debug/discovery/small/fast_single_agent)로 보내는 결정론적 순수 함수. 모델 자기 판단이 아니라 감사 가능한 규칙 기반이며, 위험 키워드(인증·결제·개인정보·배포·삭제·외부 비용)는 의도 분류와 무관하게 항상 `safety_council`로 강제. docs/09 §11에 "의도적 미구현"으로 기록돼 있던 항목의 실제 구현 — handler 배선(WP-A3)과 라이브 실측(WP-A5)은 아직 남음
- **Model Tier Router** (WP-B1, `scripts/route-model-tier.js`): 추상 모델 티어/에이전트 이름 → 구체 모델 식별자 변환의 단일 소스 + `docs/07_MODEL_ROUTING_SPEC.md` 갱신
- **참조용 에이전트의 Council 위원 승격** (WP-A2, `agents/*.md`): skeptic·unknown-detector 등 참조용 에이전트들에 Council 출력 계약(입력/출력/읽기 전용) 명시
- **배포 매니페스트** (WP-C1, `scripts/dev/release-manifest.json` + `tests/unit/release-manifest.test.js`): release 브랜치에 실리는 파일의 allowlist와 그 정합성 기계 검증(모든 `docs/*.md`의 include/exclude 분류, 배포 파일의 제외 문서 참조 금지)
- **release 브랜치 배포 전략 초안** (WP-C4): 배포 가능한 파일만 `release` 브랜치로 복사하는 절차 문서화(README, docs/11, docs/03). 빌드 스크립트(`scripts/dev/build-release.js`)는 WP-C2에서 별도 작성 예정 — 아직 존재하지 않음

### Fixed
- 회의 선택 dispatch 배선 누락 수정 (P6 라이브 세션 실측, `docs/P6_MEETING_DISPATCH_LIVE_VERIFICATION.md`)
- meeting-system 스킬이 unknown-map/decision-card/minimality-ladder를 직접 처리하지 않고 실제로 위임하도록 수정

### Tests
- `scope-hash.js` / `shell-tokenize.js` 유닛 테스트 신설
- `route-model-tier.js` 유닛 테스트 (frontmatter 전수 대조 포함)

## [0.1.0] - 초기 구현 완료 (미배포)

### Added
- G0~G4 안전 경계(opt-in 게이트, mutating 도구 기본 거부, 결정론적 승인 캡처, 경로 정규화, fail-closed)
- Obsidian vault 템플릿 + 회의 시스템 + Minimality Ladder + Evidence Loop
- `/senpai-harness:init` — 대상 프로젝트에 vault/CLAUDE.md/AGENTS.md/senpai.config.yaml 배치
- 자기참조 마켓플레이스 구성(`.claude-plugin/marketplace.json`, `source: "./"`) — 실제 설치까지 라이브 검증 완료
- 유닛 테스트 13개 파일, 안전 경계에 대한 적대적 케이스 포함
- 두 차례의 독립 감사(critic + security-reviewer, 이후 Fable 5 이중 독립 감사) 반영
- **G2 승인 모델을 T0~T3 등급제로 재설계**: T1(승인된 일반 파일)은 `[senpai-go:<project>]` 승인 자체로 `allow`, T2(민감 파일)는 `deny`+`[senpai-touch:<project>:<file>]` 개별 재확인. `permissions.defaultMode: acceptEdits`가 옛 `permissionDecision:"ask"`를 무력화하던 실측 결함에 대응. 유닛 테스트뿐 아니라 실제 라이브 세션(`acceptEdits` 고정)으로 전 구간 재현 확인(`tests/smoke/real-session.md`)
- **빌드 중 판단 규칙 — 선배의 4단 판정**(`agents/builder-runtime.md`): 승인된 파일 범위 **안**에서 실제로 만드는 동안 어떤 판단을 사용자에게 물어야 하고 어떤 판단을 AI가 알아서 해도 되는지 가르는 프롬프트 지침. 코드 강제 메커니즘 아님
- `/senpai-harness:doctor` — 설치 상태를 점검해 비개발자가 읽을 수 있는 리포트를 보여주는 커맨드 (+ `doctor.js`가 대상 프로젝트를 오진단하던 결함 수정)
- `/senpai-harness:reset` + `[senpai-stop]` — 프로젝트 관리 중단. 커맨드는 안내만 하고 파일을 직접 지우지 않으며, 사용자가 `[senpai-stop]`을 직접 입력했을 때만 신뢰된 훅(`scripts/reset.js`)이 `senpai.config.yaml` 하나만 제거한다(vault/CLAUDE.md/AGENTS.md는 보존 — `/senpai-harness:init` 재실행으로 언제든 복귀 가능)
- **error-to-playbook 스킬** — 오류 해결 직후 개별 오류 기록(ERR-000N.md)을 만들고, 같은 오류가 3번째 반복되면 해결 순서를 Playbook(PB-000N.md)으로 승격 (PRD 성공 기준 "반복 오류는 Error Record와 Playbook 후보로 정리됩니다" 구현)
- 브레인스토밍 의도 분류 추가 + Design Meeting을 실제로 도달 가능하게 배선
- **Git 위생 알림**(`scripts/git-hygiene.js`, `Stop` 훅): 커밋이 쌓이는데도 (1) GitHub 같은 원격 저장소가 연결되지 않았거나 (2) Session Memory가 5커밋 넘게 갱신 안 된 상태를 감지해 알려준다. 순수 관찰용 — `git commit`을 AI가 대신 실행하게 하는 것이 아니라(그 명령은 G1 Bash 게이트에 아직 분류돼 있지 않아 항상 deny됨, 의도적으로 건드리지 않음), `git log`/`git remote`를 읽기만 해서 사람이 직접 커밋했든 AI가 승인된 범위 안에서 커밋했든 똑같이 작동한다. `.senpai/nudges.json`으로 중복 알림 방지(매 턴마다 도는 `Stop` 훅에서 같은 메시지가 반복되지 않도록)

### Fixed
- `scripts/init.js`가 `vault-template/`을 통째로 복사할 때 `10_Projects/_template/`(가짜 프로젝트 폴더)이 사용자의 실제 vault에 그대로 남고, 모든 대시보드/인덱스 문서의 `{date}` frontmatter 플레이스홀더가 치환 안 된 채로 노출되던 결함 수정. `_template/` 삭제 + frontmatter 블록 안의 `{date}`만 실제 날짜로 채움(본문 예시·`*-template.md` 재사용 템플릿은 그대로 유지)

### Known gaps
- `source: "./"` 자기참조 마켓플레이스 구조상 `docs/`(내부 감사 기록 전체, 취약점 서술 포함)와 `tests/`가 플러그인 루트와 물리적으로 분리되지 않아, 설치 시 사용자 캐시에 그대로 복사된다. 플러그인 로딩 자체(`agents/`/`skills/`/`commands/`/`hooks/`만 스캔)에는 영향 없고 secret도 없어 기능·보안 결함은 아니지만, 공개 배포 전에는 제외 여부를 결정해야 한다(`plugins/senpai-harness/` 분리 구조였다면 자동으로 해결됐을 문제 — 지금은 의도적으로 선택하지 않은 트레이드오프)
