# 09. Acceptance Criteria

## 전체 완료 기준

Senpai Harness MVP는 비개발자가 명령어를 외우지 않아도 다음 기본 흐름을 수행할 수 있어야 합니다.

1. 세션 시작 시 자동 체크인
2. 자연어 요청 의도 감지
3. 새 기능 요청 시 바로 구현 금지
4. 숨은 결정과 선택지 제시
5. 사용자 승인 후 계획 생성
6. Minimality Ladder 실행
7. 승인된 범위만 구현
8. 완료 증거 확인
9. Obsidian에 기억 저장

## 기능별 완료 기준

### 1. 설치 — **정정 (2026-07 재점검): `scripts/install.js`는 존재하지 않지만, `scripts/init.js`가 vault 전체를 한 번에 복사한다**

원래 이 섹션은 별도 설치 스크립트를 전제했으나 그런 파일은 없다. 실제 메커니즘은 `scripts/init.js#copyVaultTemplate()`이 `/senpai-harness:init` 실행 시 `vault-template/` **전체를 한 번에** `vault/`로 복사하는 것이다(이전 버전의 이 문서는 "각 스킬이 필요할 때 lazy하게 만든다"고 적었는데, 그건 사실이 아니었다 — `fs.cpSync(VAULT_TEMPLATE_DIR, vaultDir, { recursive: true })`로 처음부터 통째 복사였다. `10_Projects/{project}/`처럼 아직 존재하지 않는 개별 프로젝트 폴더만 스킬이 그때그때 만든다).

**이전에 "남은 갭"으로 남겨뒀던 것, 지금 해결함**: 통째 복사이다 보니 (a) `10_Projects/_template/`(플레이스홀더로 채워진 가짜 프로젝트 폴더)가 사용자의 실제 vault에 진짜 프로젝트들과 나란히 남고, (b) 모든 대시보드/인덱스 문서의 frontmatter에 있는 `{date}`가 치환 안 된 채로 노출되는 결함이 실제로 있었다(라이브로 재현 확인, 2026-07). `copyVaultTemplate()`에 `removeProjectsTemplateFolder()` + `fillDatePlaceholders()`를 추가해 수정(`tests/unit/init.test.js`에 회귀 테스트 포함).

- [x] 첫 실행 시 `vault-template/` 전체가 `vault/`로 복사된다(위 정정 참고) — `10_Projects/_template/`는 복사 직후 제거, frontmatter의 `{date}`는 실제 날짜로 채움.
- [x] 기존 파일이 있을 경우 덮어쓰기 전 백업한다 — `scope-check.js`의 vault 쓰기 허용 분기가 덮어쓰기 시 `.senpai/backups/`에 자동 백업한다(P4 라이브 확인).
- [x] secret 파일을 건드리지 않는다 — `scripts/protect-secrets.js`.
- [x] 실패 시 복구 가능한 메시지를 출력한다 — `node scripts/doctor.js`가 이 역할을 담당(아래 2번).

### 2. Doctor — **정정 (2026-07 체크박스 재점검): `.claude/agents`/`.claude/skills` 항목은 옛 레이아웃 가정, 실제로는 확인 대상 아님**

`agents`/`skills`는 플러그인 루트에 있지 `.claude/` 아래가 아니다(03_TECHNICAL_SPEC.md 정정 참고) — `scripts/doctor.js`가 이 경로를 확인하지 않는 건 결함이 아니라 정확한 것이다.

- [x] `node scripts/doctor.js`가 실행된다 — `tests/unit/doctor.test.js` 통과.
- [x] Obsidian Vault(대상 프로젝트의 `vault/` 존재) 확인 — `checkVault`. **정정(2026-07 라이브 검증)**: 이전에는 `checkPluginJson`/`checkHooksJson`이 대상 프로젝트의 `process.cwd()` 기준으로 `.claude-plugin/plugin.json`/`hooks/hooks.json`을 찾아, 실제 사용자 프로젝트에서는 항상 거짓 실패(✗)를 보고했다 — 대상 프로젝트는 이 파일들을 자기 폴더에 가질 수 없기 때문(플러그인 설치 위치에만 존재). `PLUGIN_ROOT`(`__dirname` 기준)로 수정.
- [ ] ~~`.claude/agents` 존재 여부 확인~~ — 해당 없음(레이아웃 정정, 위 참고).
- [ ] ~~`.claude/skills` 존재 여부 확인~~ — 해당 없음(레이아웃 정정, 위 참고).
- [x] hooks 존재 여부 확인 — `checkHooksJson`(`hooks/hooks.json`).
- [x] config 존재 여부 확인 — `checkManagedMarkerReachability`(`senpai.config.yaml` 위치), `.claude-plugin/plugin.json`(`checkPluginJson`), `.senpai/state.json`(`checkSenpaiState`).
- [x] 비개발자가 이해할 수 있는 리포트를 출력한다 — 각 체크가 한글 설명 메시지와 함께 pass/fail을 보고(`runCheck`).

### 3. 자동 체크인 — **정정 (2026-07 체크박스 재점검): 실제로는 라이브 검증 완료됨**

`docs/P4_LIVE_VERIFICATION.md:11`(Scenario B)에서 실제 세션으로 확인됨: "Session Memory 읽기 / Current State 요약 / 다음 작업 추천 — ✅ 3개 모두 정확히 수행. `.senpai/state.json` 부재 → 승인 만료 상태를 올바르게 인지하고 Builder로 바로 넘어가지 않음".

- [x] 세션 시작 시 Current State를 읽는다.
- [x] 최근 Session Memory를 읽는다.
- [x] 미완료 Decisions를 찾는다 — Unknown Map의 "아직 모르는 것" 섹션을 통해(`skills/unknown-map/SKILL.md` 6단계 참고, `state.json.unresolved_decisions`는 writer가 없어 Unknown Map 자체가 실질 소스).
- [x] 미해결 Errors를 찾는다 — Error Index 검색(`skills/meeting-system/SKILL.md`).
- [x] 오늘 이어갈 수 있는 작업을 카드로 보여준다.

### 4. 의도 감지 — **정정 (2026-07 체크박스 재점검): 실제로는 구현·테스트 완료됨**

`scripts/classify-intent.js`에 7개 카테고리 전부 구현돼 있고 `tests/unit/classify-intent.test.js`가 통과한다.

- [x] “어제 하던 거 이어서 해줘” → continue_work
- [x] “새 앱 만들고 싶어” → start_project
- [x] “로그인 기능 붙여줘” → add_feature
- [x] “에러가 나” → debug
- [x] “다 된 거야?” → verify
- [x] “오늘 여기까지” → finish_session
- [x] “이게 무슨 뜻이야?” → explain_nondev

### 5. 회의 선택 — **정정 (2026-07 P6/P14 라이브 검증): 위임 배선 결함을 실측·수정, 7개 회의 모두 개별 확인 완료**

`docs/P6_MEETING_DISPATCH_LIVE_VERIFICATION.md`에서 확인됨 — 이 섹션이 다른 섹션과 달리 체크박스가 비어 있던 이유가 실제로 있었다: `hooks/scripts/handler.js`가 `docs/06_HOOKS_SPEC.md` 원설계(의도 분류 → 회의 선택 → 활성화)의 dispatch 분기 자체를 구현하지 않고 있었다. 이미 완성돼 유닛 테스트도 통과하던 `scripts/classify-intent.js`/`scripts/select-meeting.js`를 실제로 아무도 호출하지 않아서, 라이브 세션 5턴 내내 `Task`/`Skill` 도구 호출이 0번이었다(transcript 직접 파싱으로 확인). `hooks/scripts/handler.js`에 이 dispatch 분기를 추가해 수정 완료 — 수정 후 재검증에서 동일한 메시지가 `guided-auto-drive` → `unknown-map` 스킬로 정확히 캐스케이드되고 `vault/10_Projects/{project}/Unknown Map.md`가 실제로 생성됨을 확인했다.

- [x] 새 프로젝트 요청은 Orientation 또는 Discovery Meeting으로 간다. — P6 후속 재검증(`p7b-ladder-recheck`)에서 채팅 응답에 실제로 `## Discovery Meeting — 로그인 기능` 헤더가 붙었고, Orientation 고유 산출물(Project Brief.md, Current State.md, Project Home.md)과 Discovery 고유 산출물(Unknown Map.md) 4개가 한 턴에 함께 생성됨을 확인 — 두 회의가 배타적으로 나뉘기보다 신규 프로젝트+즉시 기능요청이 겹치는 상황에서 함께 처리되는 것으로 보인다(설계 위반은 아님, `meeting-system/SKILL.md`도 두 회의를 순차 추천 관계로만 규정).
- [x] 새 기능 요청은 Discovery 또는 Scope Meeting으로 간다. — 위와 같은 재검증에서 add_feature 의도(로그인 기능 요청)가 정확히 Discovery Meeting으로 캐스케이드됨을 확인(`Skill: senpai-harness:meeting-system` 호출 + `select-meeting.js "add_feature"` 실행 로그로 확인).
- [x] 구현 직전에는 Build Readiness Meeting으로 간다. — **정정 (2026-07 P14 라이브 검증, 2026-07-17 재검증으로 수정 확인)**: 훅의 hook-nudge 경로로는 구조적으로 도달 불가능함은 그대로다(`understanding_state`가 어떤 코드도 쓰지 않는 필드라 `buildApproved`는 구조적으로 항상 `false` — 근거는 위와 동일). 스킬 경로 도달은 실측으로 확인됐다: Build Gate 콘텐츠(체크리스트 표, `[senpai-go:...]` 안내)가 실제로 나타났고 `Phase Plan.md`가 실제로 vault에 생성됐으며, 승인 전 제품 코드 Write/Edit은 0건이었다(안전 불변식 유지). P14 최초 실측에서는 설계된 순서(계획 선(先) 작성 → 승인 요청)가 아니라 역순(승인 시도 실패 → 그제서야 계획 작성)으로 재현됐었으나, 이 순서 역전을 고치는 수정(`skills/guided-plan/SKILL.md`, `skills/guided-auto-drive/SKILL.md`, `skills/meeting-system/SKILL.md`, `vault-template/90_System/Build Gates.md`) 이후 **2026-07-17 재검증에서 설계된 순서대로 재현됨을 확인**했다 — `.senpai/event_logs.jsonl` 타임스탬프 대조로 `Phase Plan.md` 저장(07:51:31) → 사용자 승인 기록(07:52:39) → 제품 코드 Edit(07:53:10) 순서가 엄격히 지켜졌고, `guided-auto-drive`/`guided-plan` Skill 호출도 이번엔 관측됐다. 자세한 근거는 `docs/P14_MEETING_LIVE_VERIFICATION.md` "재검증 (2026-07-17)" 절 참고.
- [x] 완료 요청은 Review Meeting으로 간다. — **정정 (2026-07 P14 라이브 검증, 2026-07-17 재검증으로 수정 확인)**: verify 의도가 정확히 Review Meeting 넛지로 이어지고, `evidence-reviewer` 서브에이전트가 실제 파일을 근거로 "구현 완료, 검증 전"이라는 정확한 판정을 내림을 확인. P14 최초 실측에서는 최상위 응답이 이 판정을 사용자에게 전달할 때 "검증 전" 한정어를 누락하고 "검증 결과: 구현 완료 ✓"로 표기한 사례가 있었으나, 이를 고치는 수정(`agents/evidence-reviewer.md`의 "권고" 필드가 "판단" 필드를 토씨 하나 안 바꾸고 반복하도록, `skills/evidence-loop/SKILL.md`가 서브에이전트 판정을 그대로 전달하라고 명시하도록) 이후 **2026-07-17 재검증에서 두 경로 모두 정상 확인**했다: (a) 최상위가 직접 판정한 라이브 응답이 "**구현 완료, 검증 전**" 표현을 정확히 그대로 노출했고, (b) 수정된 `evidence-reviewer` 서브에이전트를 직접 호출한 결과 "권고" 필드가 더 이상 표현을 축약하지 않고 "판단" 필드와 동일한 전체 문구를 반복함을 확인했다. 다만 "서브에이전트 위임 → 최상위가 그 판단을 정확히 릴레이"하는 정확히 같은 종단간 시퀀스가 이번 재검증의 단일 라이브 런에서 자연 발생하지는 않았다(위임 여부는 모델의 비결정적 선택). 자세한 근거는 `docs/P14_MEETING_LIVE_VERIFICATION.md` "재검증 (2026-07-17)" 절 참고.
- [x] 종료 요청은 Checkout Meeting으로 간다. — **정정 (2026-07 P14 라이브 검증)**: `docs/P14_MEETING_LIVE_VERIFICATION.md` 6단계에서 finish_session 의도가 정확히 Checkout Meeting 넛지로 이어지고, `Session Memory.md`/`Current State.md`가 실제로 생성되며 내용도 이 세션에서 실제로 일어난 일만 정확히 기록함을 확인(완전 확인, 지어낸 항목 없음).

### 6. 직접 구현 차단 — **정정 (2026-07 P6 라이브 검증)**

- [x] 사용자 요청에서 바로 Builder로 가지 않는다. — P3(`docs/P3_WALKING_SKELETON_VERIFICATION.md`)에서 미승인 상태의 제품 코드 쓰기가 전부 deny로 확인됐고, P6 재검증에서도 `guided-auto-drive`/`unknown-map` 스킬로 먼저 이동하는 것을 확인.
- [x] 신규 기능은 Unknown Detector와 Decision Card를 거친다. — 근본 원인(`meeting-system/SKILL.md`가 위임 대신 직접 처리하도록 적혀 있어 `unknown-map`/`decision-card` 스킬이 실행 기회를 못 받던 것)을 찾아 수정. 재검증에서 `Skill: senpai-harness:unknown-map`, `Skill: senpai-harness:decision-card` 둘 다 실제 도구 호출로 확인, 채팅 응답도 decision-card의 "council-of-one" 4관점 형식이 정확히 나타남(`docs/P6_MEETING_DISPATCH_LIVE_VERIFICATION.md` "P6 후속 3" 참고).
- [x] 사용자 승인 전 제품 코드 수정을 차단한다. — P3에서 코드 레벨(`scope-check.js` G1~G4)로 결정론적으로 확인됨, 이번 수정과 무관하게 계속 유효.
- [ ] 계획 밖 변경은 Scope Meeting으로 돌린다. — P6 원본 세션에서 결제 기능(계획 밖 요청)에 실질적으로 멈추고 A/B 대안을 제시하는 것은 확인됐으나, "Scope Meeting"이라는 이름이 명시적으로 쓰이지는 않았다 — 형식은 부족, 실질은 확인.

### 7. Minimality Ladder — **정정 (2026-07 P6/P7 라이브 검증): 취지는 재현됨, 전용 스킬 호출로는 미확인**

P6 원본 세션(수정 전)에서는 사용자가 로그인 기능을 명시적으로 요청한 상황(`skills/minimality-ladder/SKILL.md` 자신의 "로그인 기능 예시"와 사실상 동일한 시나리오)에서도 사다리 추론 없이 로그인이 조용히 MVP에 포함되는 것을 확인했다. 수정(handler.js dispatch + classify-intent.js 조사 처리 보완) 후 재검증(`p7b-ladder-recheck`)에서는 정확히 같은 시나리오(10명, 로컬 전용, 로그인 요청)에 대해 "비밀번호 로그인이 정말 필요한가"를 되묻고, "이름 선택"이라는 더 작은 대안을 1순위로 추천하고, "나중에 필요해지면 그때 추가"로 마무리하는 응답을 확인했다 — `skills/minimality-ladder/SKILL.md` 자신의 예시와 사실상 동일한 결론이다. 다만 이 턴의 transcript에서 `minimality-ladder` 스킬 자체의 별도 도구 호출은 관측되지 않았다 — `meeting-system`/Discovery Meeting 흐름 자체가 이 취지를 흡수해서 낸 결과인지, 별도 스킬이 조용히 실행된 것인지는 구분하지 못했다.

- [x] 구현 전 최소 구현 사다리를 실행한다. — 결과물 기준으로 확인(위 참고). 전용 스킬 호출로는 미확인.
- [x] 더 작은 대안이 있으면 사용자에게 설명한다. — "이름 선택" 대안을 표로 제시하고 추천 이유까지 설명함을 확인.
- [ ] 기존 코드/기능으로 가능한지 확인한다. — 미확인(이번 시나리오엔 재사용할 기존 코드가 없었음 — 새 프로젝트).
- [ ] 새 의존성 추가 전 승인 요구한다. — 미확인(이번 재검증에서 의존성 설치가 필요한 단계까지 가지 않음).

### 8. Evidence Loop — **정정 (2026-07 P6 라이브 검증)**

- [ ] 파일 변경 후 Verification Needed를 표시한다. — 미확인(이번 재검증 시나리오에서 제품 코드 변경 자체가 없었음).
- [x] Completion Evidence Board를 업데이트한다. — P4(`docs/P4_LIVE_VERIFICATION.md` Scenario C/D)에서 확인됨, 이번 수정과 무관한 경로라 계속 유효.
- [x] 증거가 부족하면 "완료"라고 말하지 않는다. — P4 Scenario C("부분 완료"로 정확히 답변) + P6 원본 세션("다 됐어?"에 "아직 안 만들었다"고 정직하게 답변) 두 번 확인.
- [ ] 부족한 증거와 다음 확인 작업을 제안한다. — P4에서 "부족한 증거 표시"까지는 확인됐으나 "다음 확인 작업 제안"까지 명시적으로 확인된 근거는 약함 — 추가 확인 필요.

### 9. Obsidian 업데이트 — **정정 (2026-07 체크박스 재점검): M1/M2 수정 이후 실제로는 검증 완료됨**

`docs/P4_5_SECURITY_FIX_AND_STUB_AUDIT.md`(M1/M2 수정, 커밋 `0d8f56f` 기준 Fable 5 재검증 APPROVE)에서 확인됨 — 차단된 `node -e` 지시 대신 Write 도구 기반 `vault/` 쓰기로 통일한 뒤 재검증.

- [x] Session Memory를 업데이트한다.
- [x] Current State를 업데이트한다.
- [x] Decision Record를 생성할 수 있다.
- [x] Error Record를 생성할 수 있다.
- [x] Completion Evidence를 업데이트할 수 있다.
- [ ] Agent Graph 또는 Edge Log를 업데이트할 수 있다 — **부분**. Edge Log 원본(`Edge Logs.md`)은 매 작업 축적되지만(라이브 확인), 집계 소비처(Connectivity Matrix 등)는 축 ⑥(DDTF Edge Log) 자체가 원래 계획부터 지연 대상이라 의도적으로 미구현 — `vault-template/60_Agent_Graph/Connectivity Matrix.md`, `docs/08_MVP_SCOPE.md` 참고.

### 10. Error-to-Playbook — **정정 (2026-07 구현)**: `docs/01_PRD.md` 성공 기준에 명시돼 있는데도 미구현으로 남아 있던 항목. `skills/error-to-playbook/SKILL.md`로 구현.

- [x] 오류 기록을 생성한다 — 개별 `ERR-000N.md`(`vault-template/30_Errors/ERR-template.md` 구조).
- [x] 유사 오류를 탐지한다 — Error Index + 기존 ERR 파일 대조(1단계).
- [x] 반복 오류 횟수를 증가시킨다 — frontmatter `recurrence_count` 증가(2단계).
- [x] 반복 3회 이상이면 Playbook 후보를 제안한다 — `PB-000N.md` 생성 + `Playbook Index.md` 등록(4단계), 사용자에게 쉬운 말로 안내까지 포함.

### 11. Parallel Council Router — **재정정 (2026-07 WP-A5 라이브 검증): 정적 구현(WP-A1~A3)에 이어 실제 병렬 스폰을 라이브 세션으로 실측 완료**

P6 시점의 직전 정정은 "의도적 보류(Phase 2+), 미구현이 정상"이었으나, 2026-07 WP-A1~A3에서 보류를 해제하고 실제로 구현했다: `scripts/select-parallel-council.js`(순수 함수 라우터, `tests/unit/select-parallel-council.test.js`로 검증) + `skills/parallel-council/SKILL.md`(최상위 루프의 병렬 스폰 절차) + `hooks/scripts/handler.js`의 UserPromptSubmit Council 넛지 배선(`tests/unit/handler.test.js`의 WP-A3 케이스들). 구현이 `docs/07_MODEL_ROUTING_SPEC.md`의 원 매트릭스와 다른 부분(Builder/Nondev Explainer 제외 등)은 같은 문서의 "구현된 라우터와 위 매트릭스의 의도적 차이" 정정 각주에 기록돼 있다.

WP-A5에서 이 구현이 코드 존재만이 아니라 **실제 라이브 세션에서 정말 병렬로 작동하는지**를 스크래치 워크스페이스(`--session-id` 고정 + `--resume`, 2턴)로 실측했다 — `docs/P8_PARALLEL_COUNCIL_LIVE_VERIFICATION.md` 참고. 모델 자기 보고가 아니라 세션 transcript와 서브에이전트별 개별 실행 로그(`subagents/agent-*.jsonl`)의 실제 타임스탬프를 직접 파싱해 확인했다: safety_council(위험 키워드 "결제")과 discovery_council(신규 프로젝트) 두 모드 모두에서 명단과 정확히 일치하는 4명이 호출됐고, 서브에이전트 실행 구간이 실제로 겹쳤다(discovery_council은 4개 tool_use가 완전히 같은 `message.id` 안에서 배치된 이상적 사례, safety_council은 1+3 메시지 배치였지만 실행 구간은 4명 전원 겹침 확인). 부수적으로 실제 결함 하나를 찾았다 — `UserPromptSubmit` 훅이 비동기 위원 완료 콜백(`<task-notification>`)과 실제 사용자 메시지를 구분하지 못해 한 턴 안에서도 여러 번 재발동되는 것을 확인했다(실제 사용자 발화는 3건인데 훅 발동은 10회) — 이번 두 턴에서는 모델이 반응하지 않아 무해했으나 구조적 보장은 아니며, 이번 작업 범위(문서만 수정) 밖의 후속 검토 항목으로 `P8` 문서에 정직하게 남겨뒀다.

- [x] 요청의 불확실성, 위험도, 복잡도를 평가한다. — 의도 라벨(`scripts/classify-intent.js`) + 위험 키워드 6범주 + 오류 반복 횟수(`recurrence_count`)라는 검사 가능한 신호로 평가(`scripts/select-parallel-council.js`). **라이브 확인**: "결제 기능 넣어주세요"(add_feature+위험키워드), "새 앱 만들고 싶어요"(start_project) 두 실제 메시지가 각각 올바른 신호로 평가됨(`docs/P8_PARALLEL_COUNCIL_LIVE_VERIFICATION.md`).
- [x] 적절한 Council mode를 선택한다. — 5개 모드(fast_single_agent/small_council/discovery_council/safety_council/debug_council) 결정 테이블, 위험 신호가 1순위로 모든 조건을 앞선다. **라이브 확인**: 두 실제 메시지가 각각 `safety_council`/`discovery_council`로 정확히 라우팅됨(훅 넛지 텍스트로 직접 확인).
- [x] 병렬 분석은 기본적으로 읽기 전용이다. — 위원은 전원 자문 역할이며, 어떤 모드의 `agents`에도 `builder`/`builder-runtime`이 포함되지 않음을 코드 불변식 + 테스트로 강제. **라이브 확인**: 8개 위원 서브에이전트(두 턴 합산) 전원의 실행 로그에서 `Write`/`Edit` 도구 호출 0건.
- [x] 코드 쓰기는 Single Writer 원칙을 따른다. — Council은 자문만 하고, 쓰기는 기존 승인 경로(`docs/SAFETY_ENFORCEMENT_POLICY.md`)로만 일어난다. **라이브 확인**: 두 턴 전체에서 Write 2건 모두 `vault/.../Unknown Map.md`(Obsidian 기억 축, `scope-check.js`가 "not gated by build approval"로 명시적 허용)였고 제품 코드 Write/Edit·PreToolUse deny는 0건.
- [x] 사용자에게는 모델명이 아니라 역할로 설명한다. — `skills/parallel-council/SKILL.md` 4단계 종합 형식이 역할명(기획/기술/위험/최소 구현 관점 등)만 노출. **라이브 확인**: 두 턴의 실제 채팅 응답 모두 "기획/기술/위험/최소 구현 관점"으로만 종합됐고 모델명/티어 노출 0건.
- **병렬성 자체의 실측(신규, R1 해소)**: safety_council·discovery_council 두 모드 모두에서 서브에이전트 실행 로그의 실제 타임스탬프가 겹치는 구간을 확인(각각 33초·58초 전원 동시 실행) — 메시지 배치뿐 아니라 실제 실행 동시성까지 확인됨(`docs/P8_PARALLEL_COUNCIL_LIVE_VERIFICATION.md` 발견 1·2).

**정정: 이 결함은 2026-07-16에 수정 완료.** 위 문단이 "이번 작업 범위 밖의 후속 검토 항목"으로 남겨뒀던 `UserPromptSubmit` 합성 콜백 재발동 결함(`docs/P8_PARALLEL_COUNCIL_LIVE_VERIFICATION.md` 발견 3)을 `hooks/scripts/handler.js`에 `looksLikeSyntheticCallback(prompt)` 가드로 수정했다 — G0 게이트 직후, 승인 캡처 분기 이전에서 `<task-notification>` 여는 태그(속성이 붙은 `<task-notification agentId="...">` 형태 포함, trimStart 후 `/^<task-notification[\s>]/`)로 시작하는 prompt를 조기에 `{}`로 반환해, 위원 완료 콜백이 승인 캡처/터치/중단/회의·위원회 dispatch 어느 분기에도 흘러들지 않는다. `tests/unit/handler.test.js`에 회귀 테스트 4건 추가, 기존 21개 unit 테스트 파일 전체 회귀 없음 확인. **재정정(독립 검수, 같은 날)**: 최초 수정본은 `startsWith('<task-notification>')`이라 속성 붙은 태그를 놓쳤고, 신규 테스트 2건의 콜백 본문이 `classifyIntent()`상 `unknown`이라 가드 없이도 통과하는(판별력 0) 테스트였다 — 가드를 위 정규식으로 교체하고 테스트를 판별 쌍(같은 본문이 일반 메시지로는 safety_council 넛지, 콜백 포장 시에만 `{}`)으로 강화했다. 상세는 `docs/P8_PARALLEL_COUNCIL_LIVE_VERIFICATION.md` 발견 3의 재정정 문단 참고.

### 12. Model Routing — **정정 (2026-07 P6/WP-B3 재확인): 정적 배정 + 동적 승격 공식 확정**

Fable 5 자문에서 지적되고 직접 코드로 재확인됨 — `agents/*.md` 17개 전체가 frontmatter에 실제 Claude Code 모델 이름(`opus`/`sonnet`/`haiku`)을 명시하고 있고(`grep -rn "^model:" agents/*.md`로 직접 확인), 이는 `docs/07_MODEL_ROUTING_SPEC.md`의 agent_model_map과 일치한다. WP-B3 재점검에서는 동적 승격 메커니즘이 실제로 구현돼 있음을 확인했다.

- [x] 에이전트별 기본 모델 티어를 정의한다. — 17개 에이전트 frontmatter 전수 확인.
- [x] 위험/복잡도에 따라 strong_reasoning으로 승격할 수 있다. — **구현 확정(WP-B3)**: `scripts/select-parallel-council.js`의 `escalation` 필드가 안전 관점 판단에 따라 `strong_reasoning` 등급으로 승격한다. 구체적으로 (1) `riskKeywordsDetected === true`이면 `safety_council`로 routing 후 escalation='strong_reasoning' 반환(line 95); (2) 오류 반복 2회 이상이면 `debug_council` + escalation='strong_reasoning'(line 104); (3) 신규 프로젝트/미결정 기능이면 `discovery_council` + escalation='strong_reasoning'(line 117). Debugger의 "같은 오류 2회 반복" 승격 조건(docs/07_MODEL_ROUTING_SPEC.md line 116)과 debug_council 트리거 조건(select-parallel-council.js line 99)이 정확히 일치함을 확인.
- [x] 큰 맥락이 필요하면 long_context로 라우팅한다. — **구현 확정(WP-B3, WP-B2 결론 반영)**: `long_context`는 별도 API 티어가 아니라 (Anthropic API 배포 기준) Sonnet 5의 기본 1M 컨텍스트 윈도우를 활용하면서, 분할 읽기(여러 회에 걸쳐 파일 읽기) + 누적 요약(Obsidian Vault에 지난 세션들의 요약 누적 저장) 전략으로 실현한다. `scripts/route-model-tier.js` line 30에서 `long_context: 'sonnet'`으로 정의되고, Project Explorer 에이전트의 설정(`agents/project-explorer.md`)에서 fallback: 'coding' → sonnet으로 실제 라우팅되므로, sonnet 모델의 1M 기본 컨텍스트가 사용된다(docs/07_MODEL_ROUTING_SPEC.md line 79 "확정: (ii)" 참고, 공식 문서 근거: code.claude.com/docs/en/model-config의 "Extended context" 절).
- [x] 단순 설명/문서 정리는 fast로 라우팅한다. — `meeting-selector`/`memory-librarian`/`nondev-explainer`가 `haiku`로 배정돼 있음을 확인.


### 13. Plugin Distribution Readiness

**정정 (P5 라이브 검증, 2026-07)**: 두 번째 항목("marketplace 구조로 이동 가능한 파일 구조")은 원래 별도 이동(`plugins/senpai-harness/`로 재구성)을 전제했으나, 실제로는 이동 없이 `.claude-plugin/marketplace.json`에 `source: "./"` 자기참조 항목 하나만 추가해 충족했다 — `claude plugin validate --strict` + 실제 `marketplace add`/`install --scope user`/`uninstall`/`marketplace remove` 설치 사이클로 검증 완료(`tests/smoke/real-session.md` 참고). 네 번째 항목("비공개/공개 저장소 역할 구분")도 구조 분리가 필요 없어졌다 — 같은 저장소가 지금은 비공개(원격 없음), 검증 완료 후 그대로 공개하면 배포 저장소가 된다(`docs/11_DEPLOYMENT_STRATEGY.md`).

**정정 (P9 release 브랜치 실측, 2026-07, WP-C5)**: 위 P5 검증은 이 개발 저장소 자체(내부 문서 전부 포함)를 설치한 것이었다 — "필터링된 release 브랜치를 설치해도 내부 문서가 정말 빠지는가"는 별도로 실측이 필요했다. `scripts/dev/build-release.js`로 만든 release 워크트리를 실제로 `marketplace add`→`install --scope user`하고 설치된 캐시 디렉토리를 직접 `find`/`diff`로 뜯어본 결과, 내부 전용 문서(P0~P7, `HARNESS_ENGINEERING.md`, `Design process meeting materials/`, `tests/`, `scripts/dev/`)는 **0건** 포함됐고, 캐시 파일 목록(129개)이 release 트리와 정확히 일치했다. 설치된 캐시로 `/senpai-harness:init`→`/senpai-harness:doctor`도 스크래치 프로젝트에서 정상 동작을 확인했다. 단, **release 트리의 `README.md`가 제외된 파일(`docs/HARNESS_ENGINEERING.md`, `tests/unit/`)을 여전히 참조하는 죽은 링크/설명이 남아 있어 공개 전환 전 수정이 필요하다** — 상세 근거와 재현 절차는 `docs/P9_RELEASE_BRANCH_LIVE_VERIFICATION.md` 참고.

- [x] `.claude-plugin/plugin.json`이 존재한다.
- [x] marketplace 구조를 가진다(자기참조, 재구성 불필요 — 위 정정 참고).
- [x] README에 plugin 설치 흐름이 설명되어 있다 — P9가 발견한 죽은 참조 2건(`docs/HARNESS_ENGINEERING.md` 링크, `tests/unit/` 구조 다이어그램 줄)은 발견 직후 `main`의 README.md에서 제거해 수정 완료. **단, release 브랜치는 수정 전 `main@8da1c50` 기준 빌드(커밋 `6649807`)라 재빌드 전까지 죽은 참조가 그대로 남아 있다 — 공개 전환 전 `node scripts/dev/build-release.js` 재실행 필요(독립 검수에서 release 워크트리 grep으로 실측 확인).**
- [x] 비공개/공개 저장소는 별도 구조가 필요 없음을 확인 — 위 정정 참고.
- [x] MCP는 MVP 필수가 아니라 Phase 2 optional extension으로 문서화되어 있다.
- [x] **필터링된 release 브랜치를 실제로 설치해도 내부 문서가 배포 캐시에 포함되지 않는다** — P9 실측, 제외 대상 파일 0건 확인(`docs/P9_RELEASE_BRANCH_LIVE_VERIFICATION.md`).

### 14. Phase 2 MCP Readiness — **정정 (2026-07-17, P10 감사 N2): 4개 항목 모두 이전부터 실질 충족 상태였는데 체크박스만 미갱신돼 있었다. 항목별 실측 근거로 재확인 후 갱신.**

- [x] MCP가 담당할 기능 범위가 문서화되어 있다. — `docs/03_TECHNICAL_SPEC.md` §"2차: Optional MCP Server"(후보 기능 목록), `docs/08_MVP_SCOPE.md` §"Phase 2 확장 범위"(후보 6개), `docs/11_DEPLOYMENT_STRATEGY.md` §"2단계 확장", `docs/01_PRD.md` §"2단계 확장".
- [x] MVP 코드가 MCP 없이도 동작한다. — 런타임 전체(`scripts/`, `hooks/`, `.claude-plugin/`)에 "mcp" 문자열 grep 0건(MCP 의존 코드 자체가 존재하지 않음), `tests/unit/*.test.js` 21개 파일 전부 통과(P10 감사에서 직접 실행).
- [x] MCP가 없을 때도 Obsidian Vault template, agents, skills, hooks, doctor가 동작한다. — P9 실측(release 설치판에서 `/senpai-harness:init` → vault 10개 폴더 생성 + `/senpai-harness:doctor` 5개 체크 전부 OK), P6/P8 라이브 세션(hooks dispatch·skills 캐스케이드·agents 병렬 소집 전부 MCP 없이 동작).
- [x] 향후 MCP 서버가 추가될 위치와 책임이 기술 명세에 정의되어 있다. — `docs/03_TECHNICAL_SPEC.md`: 위치는 저장소 루트 `mcp/` 선택 확장(§"저장소 구조" 각주), 책임은 §"2차: Optional MCP Server"의 기능 목록, 실행 조건("플러그인과 독립적으로도 실행 가능해야")까지 명시.

## 금지 조건 — **정정 (2026-07 P6 라이브 검증)**: 이 표의 각 항목은 "그런 일이 실제로 일어나지 않았다"를 확인하는 항목이라, 체크박스는 위반 사례가 없었는지 재확인한 결과다.

MVP는 다음 행동을 하면 실패입니다.

- [x] 사용자 승인 없이 새 기능 구현 — P3에서 코드 레벨(G1~G4)로 확인, 위반 없음.
- [x] 검증 없이 완료 선언 — P4 Scenario C + P6 원본 세션("아직 안 만들었다"고 정직하게 답변) 두 번 확인, 위반 없음.
- [x] secret 값 출력 — `scripts/protect-secrets.js` + `tests/unit/protect-secrets.test.js`로 훅 레벨 차단 확인, 위반 없음.
- [x] 기존 파일을 무단 덮어쓰기 — P3/P4에서 `vault/` 쓰기 시 자동 백업(`.senpai/backups/`) 확인, 위반 없음.
- [ ] 계획 밖 대규모 변경 — P6 원본 세션에서 결제 기능(계획 밖) 요청에 실질적으로 멈췄으나 "Scope Meeting"이라는 형식적 절차로 명시되진 않음 — §6 항목4와 동일한 부분 확인 상태.
- [ ] 위험 작업을 경고 없이 실행 — P6 원본 세션에서 결제 기능 요청에 실질적으로 경고 + A/B 대안 제시함을 확인했으나, 형식적인 "Risk Card"나 `safety-minimality` 에이전트 위임은 관측되지 않음(최상위 모델의 일반 판단으로 대체됨) — 부분 확인.
- [x] 비개발자가 이해하기 어려운 로그만 출력 — `node scripts/doctor.js`가 한글 pass/fail 메시지로 보고함을 확인(섹션 2), 위반 없음.

## Smoke Test 시나리오

### Scenario A. 새 기능 요청

Input:

```text
로그인 기능 붙여줘.
```

Expected:

- 바로 구현하지 않음
- Discovery Meeting 생성
- 로그인에 숨은 결정 설명
- 선택지 제시

### Scenario B. 이어가기

Input:

```text
어제 하던 거 이어서 해줘.
```

Expected:

- Session Memory 읽기
- Current State 요약
- 다음 작업 추천

### Scenario C. 완료 확인

Input:

```text
다 된 거야?
```

Expected:

- Completion Evidence 확인
- 부족한 증거 표시
- 정확한 완료 상태 답변

### Scenario D. 종료 정리

Input:

```text
오늘 여기까지 정리하자.
```

Expected:

- Checkout Meeting 생성
- Session Memory 업데이트
- 다음 세션 시작점 저장
