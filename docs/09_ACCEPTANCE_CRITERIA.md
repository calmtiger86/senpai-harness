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

### 5. 회의 선택 — **정정 (2026-07 P6 라이브 검증): 위임 배선 결함을 실측·수정, 개별 회의별 확인은 진행 중**

`docs/P6_MEETING_DISPATCH_LIVE_VERIFICATION.md`에서 확인됨 — 이 섹션이 다른 섹션과 달리 체크박스가 비어 있던 이유가 실제로 있었다: `hooks/scripts/handler.js`가 `docs/06_HOOKS_SPEC.md` 원설계(의도 분류 → 회의 선택 → 활성화)의 dispatch 분기 자체를 구현하지 않고 있었다. 이미 완성돼 유닛 테스트도 통과하던 `scripts/classify-intent.js`/`scripts/select-meeting.js`를 실제로 아무도 호출하지 않아서, 라이브 세션 5턴 내내 `Task`/`Skill` 도구 호출이 0번이었다(transcript 직접 파싱으로 확인). `hooks/scripts/handler.js`에 이 dispatch 분기를 추가해 수정 완료 — 수정 후 재검증에서 동일한 메시지가 `guided-auto-drive` → `unknown-map` 스킬로 정확히 캐스케이드되고 `vault/10_Projects/{project}/Unknown Map.md`가 실제로 생성됨을 확인했다.

- [x] 새 프로젝트 요청은 Orientation 또는 Discovery Meeting으로 간다. — P6 후속 재검증(`p7b-ladder-recheck`)에서 채팅 응답에 실제로 `## Discovery Meeting — 로그인 기능` 헤더가 붙었고, Orientation 고유 산출물(Project Brief.md, Current State.md, Project Home.md)과 Discovery 고유 산출물(Unknown Map.md) 4개가 한 턴에 함께 생성됨을 확인 — 두 회의가 배타적으로 나뉘기보다 신규 프로젝트+즉시 기능요청이 겹치는 상황에서 함께 처리되는 것으로 보인다(설계 위반은 아님, `meeting-system/SKILL.md`도 두 회의를 순차 추천 관계로만 규정).
- [x] 새 기능 요청은 Discovery 또는 Scope Meeting으로 간다. — 위와 같은 재검증에서 add_feature 의도(로그인 기능 요청)가 정확히 Discovery Meeting으로 캐스케이드됨을 확인(`Skill: senpai-harness:meeting-system` 호출 + `select-meeting.js "add_feature"` 실행 로그로 확인).
- [ ] 구현 직전에는 Build Readiness Meeting으로 간다. — 미확인. 참고: `understanding_state` 필드에 쓰는 코드가 없어(`scripts/state-store.js` STATE_FIELDS 주석) `selectMeeting()`의 `buildApproved`는 그 필드가 채워지기 전까지 구조적으로 항상 `false`다 — 이번 수정이 만든 제약이 아니라 기존 설계의 알려진 한계.
- [ ] 완료 요청은 Review Meeting으로 간다. — 미확인(다음 세션 과제).
- [ ] 종료 요청은 Checkout Meeting으로 간다. — 미확인(다음 세션 과제).

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

### 11. Parallel Council Router — **재정정 (2026-07 WP-A1~A3): Phase 2+ 보류를 해제하고 실제 구현됨**

P6 시점의 직전 정정은 "의도적 보류(Phase 2+), 미구현이 정상"이었으나, 2026-07 WP-A1~A3에서 보류를 해제하고 실제로 구현했다: `scripts/select-parallel-council.js`(순수 함수 라우터, `tests/unit/select-parallel-council.test.js`로 검증) + `skills/parallel-council/SKILL.md`(최상위 루프의 병렬 스폰 절차) + `hooks/scripts/handler.js`의 UserPromptSubmit Council 넛지 배선(`tests/unit/handler.test.js`의 WP-A3 케이스들). 구현이 `docs/07_MODEL_ROUTING_SPEC.md`의 원 매트릭스와 다른 부분(Builder/Nondev Explainer 제외 등)은 같은 문서의 "구현된 라우터와 위 매트릭스의 의도적 차이" 정정 각주에 기록돼 있다.

- [x] 요청의 불확실성, 위험도, 복잡도를 평가한다. — 의도 라벨(`scripts/classify-intent.js`) + 위험 키워드 6범주 + 오류 반복 횟수(`recurrence_count`)라는 검사 가능한 신호로 평가(`scripts/select-parallel-council.js`).
- [x] 적절한 Council mode를 선택한다. — 5개 모드(fast_single_agent/small_council/discovery_council/safety_council/debug_council) 결정 테이블, 위험 신호가 1순위로 모든 조건을 앞선다.
- [x] 병렬 분석은 기본적으로 읽기 전용이다. — 위원은 전원 자문 역할이며, 어떤 모드의 `agents`에도 `builder`/`builder-runtime`이 포함되지 않음을 코드 불변식 + 테스트로 강제.
- [x] 코드 쓰기는 Single Writer 원칙을 따른다. — Council은 자문만 하고, 쓰기는 기존 승인 경로(`docs/SAFETY_ENFORCEMENT_POLICY.md`)로만 일어난다.
- [x] 사용자에게는 모델명이 아니라 역할로 설명한다. — `skills/parallel-council/SKILL.md` 4단계 종합 형식이 역할명(기획/기술/위험/최소 구현 관점 등)만 노출.

### 12. Model Routing — **정정 (2026-07 P6/WP-B3 재확인): 정적 배정 + 동적 승격 공식 확정**

Fable 5 자문에서 지적되고 직접 코드로 재확인됨 — `agents/*.md` 17개 전체가 frontmatter에 실제 Claude Code 모델 이름(`opus`/`sonnet`/`haiku`)을 명시하고 있고(`grep -rn "^model:" agents/*.md`로 직접 확인), 이는 `docs/07_MODEL_ROUTING_SPEC.md`의 agent_model_map과 일치한다. WP-B3 재점검에서는 동적 승격 메커니즘이 실제로 구현돼 있음을 확인했다.

- [x] 에이전트별 기본 모델 티어를 정의한다. — 17개 에이전트 frontmatter 전수 확인.
- [x] 위험/복잡도에 따라 strong_reasoning으로 승격할 수 있다. — **구현 확정(WP-B3)**: `scripts/select-parallel-council.js`의 `escalation` 필드가 안전 관점 판단에 따라 `strong_reasoning` 등급으로 승격한다. 구체적으로 (1) `riskKeywordsDetected === true`이면 `safety_council`로 routing 후 escalation='strong_reasoning' 반환(line 95); (2) 오류 반복 2회 이상이면 `debug_council` + escalation='strong_reasoning'(line 104); (3) 신규 프로젝트/미결정 기능이면 `discovery_council` + escalation='strong_reasoning'(line 117). Debugger의 "같은 오류 2회 반복" 승격 조건(docs/07_MODEL_ROUTING_SPEC.md line 116)과 debug_council 트리거 조건(select-parallel-council.js line 99)이 정확히 일치함을 확인.
- [x] 큰 맥락이 필요하면 long_context로 라우팅한다. — **구현 확정(WP-B3, WP-B2 결론 반영)**: `long_context`는 별도 API 티어가 아니라 (Anthropic API 배포 기준) Sonnet 5의 기본 1M 컨텍스트 윈도우를 활용하면서, 분할 읽기(여러 회에 걸쳐 파일 읽기) + 누적 요약(Obsidian Vault에 지난 세션들의 요약 누적 저장) 전략으로 실현한다. `scripts/route-model-tier.js` line 30에서 `long_context: 'sonnet'`으로 정의되고, Project Explorer 에이전트의 설정(`agents/project-explorer.md`)에서 fallback: 'coding' → sonnet으로 실제 라우팅되므로, sonnet 모델의 1M 기본 컨텍스트가 사용된다(docs/07_MODEL_ROUTING_SPEC.md line 79 "확정: (ii)" 참고, 공식 문서 근거: code.claude.com/docs/en/model-config의 "Extended context" 절).
- [x] 단순 설명/문서 정리는 fast로 라우팅한다. — `meeting-selector`/`memory-librarian`/`nondev-explainer`가 `haiku`로 배정돼 있음을 확인.


### 13. Plugin Distribution Readiness

**정정 (P5 라이브 검증, 2026-07)**: 두 번째 항목("marketplace 구조로 이동 가능한 파일 구조")은 원래 별도 이동(`plugins/senpai-harness/`로 재구성)을 전제했으나, 실제로는 이동 없이 `.claude-plugin/marketplace.json`에 `source: "./"` 자기참조 항목 하나만 추가해 충족했다 — `claude plugin validate --strict` + 실제 `marketplace add`/`install --scope user`/`uninstall`/`marketplace remove` 설치 사이클로 검증 완료(`tests/smoke/real-session.md` 참고). 네 번째 항목("비공개/공개 저장소 역할 구분")도 구조 분리가 필요 없어졌다 — 같은 저장소가 지금은 비공개(원격 없음), 검증 완료 후 그대로 공개하면 배포 저장소가 된다(`docs/11_DEPLOYMENT_STRATEGY.md`).

- [x] `.claude-plugin/plugin.json`이 존재한다.
- [x] marketplace 구조를 가진다(자기참조, 재구성 불필요 — 위 정정 참고).
- [x] README에 plugin 설치 흐름이 설명되어 있다.
- [x] 비공개/공개 저장소는 별도 구조가 필요 없음을 확인 — 위 정정 참고.
- [x] MCP는 MVP 필수가 아니라 Phase 2 optional extension으로 문서화되어 있다.

### 14. Phase 2 MCP Readiness

- [ ] MCP가 담당할 기능 범위가 문서화되어 있다.
- [ ] MVP 코드가 MCP 없이도 동작한다.
- [ ] MCP가 없을 때도 Obsidian Vault template, agents, skills, hooks, doctor가 동작한다.
- [ ] 향후 MCP 서버가 추가될 위치와 책임이 기술 명세에 정의되어 있다.

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
