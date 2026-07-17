---
name: guided-auto-drive
description: Senpai Harness의 최상위 운영 모드. 세션 시작, "이어서 해줘", 새 프로젝트 아이디어, "기능 붙여줘", 에러 신고, "다 된 거야?", "오늘 여기까지" 등 거의 모든 사용자 메시지에서 기본으로 켜지는 진입점 스킬입니다. 요청 수집 → 회의 → Decision Card → 승인 → Minimality Ladder → Guided Work → Evidence → Obsidian 저장 루프를 실행하고, 각 단계를 직접 처리하지 않고 알맞은 하위 스킬로 위임합니다. 어떤 스킬을 써야 할지 애매하면 이 스킬을 가장 먼저 호출하세요.
disable-model-invocation: false
---

# Guided Auto-Drive

## 이 스킬의 역할

이 스킬은 Senpai Harness의 "자율주행"을 실행하는 최상위 스킬입니다. 거의 모든 사용자 메시지가 여기를 거쳐 갑니다.

이 스킬 스스로는 회의 내용을 채우거나, Unknown Map을 조사하거나, 코드를 작성하지 않습니다. 이 스킬의 일은 **지금이 루프의 몇 번째 단계인지 판단하고, 그 단계를 실제로 처리할 스킬로 넘기고, 사용자가 승인하지 않은 단계를 건너뛰지 못하게 막는 것**입니다. 세부 작업은 항상 아래에 이름을 밝힌 하위 스킬(`meeting-system`, `parallel-council`, `unknown-map`, `decision-card`, `minimality-ladder`, `guided-plan`, `evidence-loop`, `obsidian-brain-update`)에 위임하세요.

## 자율주행의 재정의 (docs/00_CONCEPT.md, 대화 내보내기 4.1)

이 하네스가 막으려는 잘못된 자율주행:

```text
사용자가 말함 → AI가 의도 추론 → AI가 알아서 결정 → AI가 구현 → 사용자는 결과만 봄
```

이 하네스가 실제로 하는 올바른 자율주행:

```text
사용자가 말함
→ AI가 의도 추론
→ AI가 회의 안건 생성
→ AI가 모르는 부분을 드러냄
→ AI가 선택지를 쉬운 말로 설명
→ 사용자가 결정
→ AI가 결정 기록
→ AI가 승인 범위 안에서만 구현
→ AI가 검증 결과를 쉬운 말로 보고
→ AI가 Obsidian에 기억 저장
```

"자동"은 "AI가 회의를 여는 것까지 자동"이라는 뜻이지, "AI가 결정까지 자동으로 하는 것"이 아닙니다. 이 구분을 절대 흐리지 마세요.

## 전체 루프와 위임표

요청마다 아래 8단계를 순서대로 통과시키세요. `.senpai/state.json`에 실제로 지속되는 것은 승인 관련 필드(`approved_scope`/`allowed_files`/`verification_targets`/`scope_hash`/`session_id`/`pending_phase_plan_path`)뿐입니다 — "몇 번째 단계까지 왔는지", "이해 상태가 어디까지 왔는지"는 이 파일이 아니라 `vault/10_Projects/{project}/`의 실제 문서(Unknown Map.md, Decision Index.md, Current State.md, Phase Plan.md)와 지금 대화 맥락으로 판단하세요. 매번 처음부터 다시 하지 말고, 이 문서들을 다시 읽어 현재 위치부터 이어가세요.

| # | 단계 | 이 스킬이 직접 하는 일 | 위임 대상 |
|---|------|----------------------|-----------|
| 1 | 요청 수집 | 자연어 의도 분류, 이벤트 기록 | (직접 처리 — 아래 1) |
| 2 | 회의 | 어떤 회의를 열지 결정 | **meeting-system** |
| 2.5 | Council 소집 | 소집 모드 확인(넛지 또는 의도로) | **parallel-council** (소집 조건이면 위원 병렬 스폰·종합, 아니면 그대로 통과) |
| 3 | 숨은 결정 드러내기 | — | **unknown-map** |
| 4 | Decision Card | — | **decision-card** |
| 5 | 승인 | 사용자의 A/B/C/D 답을 상태에 기록 | (직접 처리 — 아래 5) |
| 6 | Minimality Ladder | — | **minimality-ladder** |
| 7 | Guided Work | — | **guided-plan** (계획 승인 후 실제 코드 작업은 훅이 실시간으로 범위를 강제) |
| 8 | Evidence | — | **evidence-loop** |
| 9 | Obsidian 저장 | — | **obsidian-brain-update** |

(2.5단계는 회의 직후에만 끼는 중간 단계라 소수점으로 두었습니다 — 컨셉 문서의 "Guided Work → Evidence → Obsidian 저장"은 위 7·8·9단계에 해당합니다.)

### 1. 요청 수집 (의도 분류)

사용자 메시지를 `scripts/classify-intent.js`의 `classifyIntent()`로 분류하세요. 이 파일은 `require.main` CLI 블록을 가진 스크립트라 아래처럼 바로 실행하면 분류 결과를 그대로 출력합니다.

```bash
node scripts/classify-intent.js "로그인 기능 붙여줘"
```

(`node -e "require(...)..."` 형태의 임의 실행은 `scripts/scope-check.js`(G1)가 항상 차단하므로 절대 쓰지 않습니다 — 위 CLI 형태만 씁니다.)

7개 라벨: `continue_work | start_project | add_feature | debug | verify | finish_session | explain_nondev` (규칙에 안 맞으면 `unknown`, 절대 추측해서 라벨을 지어내지 않습니다).

이 CLI 호출은 `hooks/scripts/handler.js`가 모든 훅 호출마다 자동으로 `.senpai/event_logs.jsonl`에 기록하므로(secret 경로는 자동 redact), 별도로 `appendEvent()`를 호출할 필요가 없습니다 — `scripts/event-log.js`는 Bash CLI 진입점이 없어 애초에 직접 호출할 수도 없습니다.

### 2. 회의 (meeting-system 스킬로 위임)

의도가 정해지면 **`meeting-system` 스킬을 호출**하세요. 그 스킬이 `scripts/select-meeting.js`의 `selectMeeting(intent, stateHints)`를 실제로 실행하고, 7개 회의 모드(Orientation / Discovery / Design / Scope / Build Readiness / Review / Checkout) 중 하나를 열고 사용자에게 보여줄 회의 인트로를 만듭니다.

이 스킬이 넘겨줘야 할 `stateHints`:

- `buildApproved`: `scripts/state-store.js`의 `readState()` 결과 중 `approved_scope === true`인지
- `hasUnresolvedDecisions`: 현재 프로젝트의 Unknown Map/Decision Index에 열린 항목이 있는지

`selectMeeting`이 `null`을 반환하는 의도(`debug`, `continue_work`, `explain_nondev`, `unknown`)는 회의를 강제로 열지 마세요. 대신:

- `debug` → 곧바로 "오류 해결 흐름"으로 (Debugger 역할, docs/02_PRODUCT_SPEC.md "5. 오류 해결 흐름")
- `continue_work` → Current State/Session Memory를 읽고 재개 (회의 없이 이어가기)
- `explain_nondev` → 회의 대신 그 자리에서 쉬운 말로 설명 (Nondev Explainer 역할)
- `unknown` → 사용자에게 되묻기. 짐작으로 진행 금지

### 2.5 Council 소집 (parallel-council 스킬로 위임)

회의를 연 직후, 숨은 결정을 드러내기 **직전**에 **`parallel-council` 스킬을 호출**하세요. 그 스킬은 `scripts/select-parallel-council.js`(단일 진실 소스)가 정한 소집 모드에 따라, 소집 조건일 때만 여러 역할의 위원 에이전트를 한 메시지 안에서 병렬로 불러 서로 다른 관점의 검토 카드를 모으고, "여러 관점으로 먼저 확인하겠습니다" 형식으로 종합한 뒤 다음 단계로 넘깁니다.

- `discovery_council`(새 프로젝트/브레인스토밍/미해결 결정이 남은 기능 추가), `safety_council`(인증·결제·개인정보·배포·데이터 삭제·외부 비용 신호), `debug_council`(같은 오류 3회 이상 반복)일 때만 실제로 병렬 스폰합니다.
- `small_council`/`fast_single_agent`이면 아무 위원도 부르지 않고 곧바로 다음 단계로 통과합니다.

이 스킬은 소집 여부·위원 명단을 임의로 정하지 않고 `scripts/select-parallel-council.js`의 결정을 따르며, 위원 소집은 전부 읽기 전용 자문입니다(어떤 제품 파일도 쓰지 않습니다). 종합 결과는 이어지는 3·4단계(`unknown-map`/`decision-card`)로, `debug_council`이면 오류 해결 흐름으로 넘깁니다.

### 3. 숨은 결정 드러내기 (unknown-map 스킬로 위임)

기능 추가/새 프로젝트처럼 숨은 결정이 있을 수 있는 요청이면 **`unknown-map` 스킬을 호출**하세요. 그 스킬은 `templates/unknown-map.md`를 바탕으로 `vault/10_Projects/{project}/Unknown Map.md`를 채우고, 04_AGENT_SPEC.md의 Unknown Detector 확인 범주(제품 방향/사용자 흐름/데이터 저장/로그인·인증/결제/개인정보/플랫폼 제한/배포/유지보수/검증 기준)를 각각 점검합니다.

### 4. Decision Card (decision-card 스킬로 위임)

숨은 결정이 드러나면 **`decision-card` 스킬을 호출**하세요. 그 스킬은 `templates/decision-card.md` 형식으로 카드(요청 / 왜 결정이 필요한가 / 선택지 A·B·C·D / 추천 / 추천 이유 / 확인 질문)를 만들어 보여줍니다. 선택지 D는 항상 "더 쉽게 설명해달라고 하기"로 열어 두세요.

### 5. 승인 (이 스킬이 직접 처리)

Decision Card에 대한 사용자의 답이 오면, 이 단계는 위임하지 않고 **이 스킬이 직접** 상태를 기록합니다:

1. 사용자가 정말 A/B/C/D 중 하나를 선택했는지 확인 (침묵이나 애매한 답은 결정으로 치지 않음)
2. `decision-card` 스킬에 되돌아가 확정된 결정을 ADR(`vault-template/20_Decisions/ADR-template.md` 형식)로 남기고 `Decision Index.md`를 갱신하도록 요청, `Unknown Map.md`에서 해당 항목 제거

(`understanding_state`/`unresolved_decisions`는 state.json에 쓸 방법이 없는 필드입니다 — "이해가 끝났는지", "결정이 몇 개 남았는지"는 방금 갱신한 `Unknown Map.md`/`Decision Index.md`를 다시 읽어 판단하세요.)

실제 파일 쓰기 권한(`approved_scope`, `allowed_files`, `scope_hash`)은 이 시점에 열지 않습니다. 그건 Build Readiness 승인(7단계, guided-plan)에서 사용자가 `[senpai-go:{project}]`를 정확한 프로젝트 이름과 함께 보낼 때만 `scripts/senpai-approve.js`가 인프로세스로 별도로 엽니다.

### 6. Minimality Ladder (minimality-ladder 스킬로 위임)

결정이 끝났다고 바로 구현하지 않습니다. **`minimality-ladder` 스킬을 호출**하세요. 04_AGENT_SPEC.md의 7단 사다리(지금 필요한가 → 사용자가 목적을 이해했는가 → 기존 코드/노트에 해결책이 있는가 → 플랫폼 기본 기능인가 → 이미 설치된 도구인가 → 더 작은 버전으로 먼저 검증 가능한가 → 그때만 최소 구현)를 `templates/minimality-check.md`에 채우도록 맡깁니다. 보안/개인정보/데이터 손실 방지/접근성/인증 경계/결제 안전성/사용자가 명시적으로 승인한 핵심 요구사항은 사다리로 깎지 않도록 그 스킬에 상기시키세요.

### 7. Guided Work (guided-plan 스킬로 위임)

**`guided-plan` 스킬을 호출**하세요. 이 스킬이 Build Readiness Meeting을 열고, `vault-template/10_Projects/_template/Phase Plan.md`로 이번에 할 것/하지 않을 것/체크리스트/완료 증거/승인 상태를 채우고, "이 범위로 진행할까요?" 최종 확인을 받습니다.

**순서를 반드시 이대로 지키세요 — 실측된 실패 패턴입니다.** 라이브 세션에서 최상위 대화 루프가 `guided-plan` 스킬을 실제로 호출하지 않고, Build Readiness 콘텐츠(체크리스트 표, `[senpai-go:...]` 안내)를 곧바로 채팅으로 즉흥 생성한 뒤 사용자가 그 승인 문구를 보냈다가 "Phase Plan을 아직 작성/저장하지 않았습니다"로 실패하고 나서야 `Phase Plan.md`를 실제로 작성한 역전이 관측된 적이 있습니다. 이 순서 뒤집힘이 다시 재현되지 않도록, 승인 문구를 사용자에게 보여주기 전에 아래 체크리스트를 스스로 통과했는지 확인하세요:

- [ ] Skill 도구로 `guided-plan`을 **실제로 호출했다** ("Build Readiness Meeting을 엽니다"라고 프로즈로만 서술하고 넘어가지 않았다)
- [ ] `Write` 도구로 `vault/10_Projects/{project}/Phase Plan.md`를 **실제로 저장했다** (아직 파일이 존재하지 않는데 승인 문구부터 먼저 보여주지 않는다)
- [ ] 그 다음에만 Build Gate 요약과 `[senpai-go:{project}]` 문구를 사용자에게 보여준다

구현 전 게이트(before_build)를 항상 이 조건으로 확인하세요 (docs/02_PRODUCT_SPEC.md) — state.json 필드가 아니라 당신이 대화와 vault 문서로 직접 판단하는 체크리스트입니다:

```yaml
before_build:
  require:
    - mvp_scope_exists: true
    - unresolved_decisions: 0        # Unknown Map.md/Decision Index.md를 다시 읽어 확인
    - understanding_state in [user_confirmed, decision_confirmed]  # 대화 맥락으로 판단
    - verification_target_exists: true
```

사용자가 Build Readiness 단계(guided-plan)에서 최종 범위를 확인한 뒤 채팅에 `[senpai-go:{project}]`를 정확한 프로젝트 이름과 함께 그대로 보내면, `hooks/scripts/handler.js`가 이 문구를 감지해 `scripts/senpai-approve.js`의 `recordApproval()`을 인프로세스로 호출합니다 — 이 함수만이 `approved_scope: true`, `allowed_files`/`sensitive_files`(Phase Plan frontmatter에서 파생), `scope_hash`를 실제로 기록합니다(모델이 직접 호출하는 게 아닙니다). 그 이후부터는 실제 코드 작성(Write/Edit)이 `scripts/scope-check.js`가 물려 있는 `PreToolUse` 훅에 의해 실시간으로 강제됩니다 — 승인된 `allowed_files` 밖의 파일이나 secret 경로(`scripts/protect-secrets.js`)는 자동으로 막히고, `sensitive_files`(또는 코드에 내장된 최소 바닥선)로 표시된 파일은 계획 승인 후에도 실제로 쓸 때 막히면서 `[senpai-touch:{project}:{file}]` 문구를 요구합니다(그 외 일반 파일은 재확인 없이 자동 진행). 이 스킬은 그 실행 자체를 다시 감독할 필요는 없지만, 계획 밖 파일을 건드리려는 낌새가 보이면 즉시 멈추고 Scope Meeting으로 되돌리세요.

### 8. Evidence (evidence-loop 스킬로 위임)

파일이 바뀌었다고 완료가 아닙니다. **`evidence-loop` 스킬을 호출**하세요. `templates/completion-evidence.md`의 체크리스트(파일 생성/수정 확인, 빌드 성공, 테스트 통과, 사용자 흐름 확인, 비개발자용 결과 설명 완료)를 실제로 검증하게 하세요.

허용되는 완료 표현만 쓰세요: 부분 완료 / 구현 완료, 검증 전 / 로컬 기준 완료 / 빌드 기준 완료 / 검증 완료. 다음은 절대 쓰지 마세요: 증거 없이 "완료했습니다", 테스트 없이 "문제 없습니다", 확인 안 한 기능을 "작동합니다"라고 단정.

### 9. Obsidian 저장 (obsidian-brain-update 스킬로 위임)

마지막으로 **`obsidian-brain-update` 스킬을 호출**하세요. `Write` 도구로 `vault/` 아래에 직접 (`scope-check.js`가 덮어쓰기 전 자동 백업, secret 경로 거부를 처리) 다음을 갱신합니다: `Session Memory.md`, `Current State.md`, 필요하면 `Decision Record`/`Error Record`/`Completion Evidence.md`/`Agent Graph` 또는 `Edge Logs.md`.

## 사용자 이해 상태 추적

루프를 진행하는 내내 사용자의 이해 상태를 아래 어휘로 판단하세요 (state.json에 쓰지 않는 어휘, 매 턴 대화 맥락으로 판단):

```yaml
understanding_state:
  unknown: 설명 전
  explained: AI가 설명했지만 확인 전
  user_confirmed: 사용자가 이해를 확인함
  decision_confirmed: 사용자가 선택지를 결정함
  confused: 사용자가 다시 설명 요청
  overloaded: 정보가 많아 범위를 줄여야 함
```

`confused`나 `overloaded`로 판단되면 다음 단계로 넘어가지 말고, 그 자리에서 설명을 줄이거나(Nondev Explainer 톤) 범위를 더 작게 쪼개세요.

## 세션 시작/재개 (continue_work, SessionStart)

세션이 막 시작됐거나 사용자가 "이어서", "어제 하던 거", "어디까지 했지"라고 말하면 회의를 새로 열지 말고 먼저 이렇게 하세요:

1. `vault/10_Projects/{project}/Current State.md` 읽기
2. `vault/10_Projects/{project}/Session Memory.md` 최근 항목 읽기
3. `vault/20_Decisions/Decision Index.md`, `vault/30_Errors/Error Index.md`에서 미해결 항목 확인
4. `templates/session-checkin.md` 형식으로 "오늘 이어갈 수 있는 작업" 카드 표시 (지난 세션 요약 / 현재 단계 / 남은 결정 / 추천)

문제가 있어 보이면 (Vault가 없거나, 훅/스킬 설치가 의심될 때) `node scripts/doctor.js`를 실행하세요 — 이 스크립트는 실제 CLI로 동작하며 비개발자가 읽을 수 있는 리포트를 콘솔에 출력합니다.

## 세션 종료 (finish_session, Stop/SessionEnd)

"오늘 여기까지", "정리하고 끝내자" 같은 신호면 Checkout Meeting으로 가서(`meeting-system` 위임) `templates/session-checkout.md` 형식(완료한 일 / 아직 남은 일 / 다음 세션 시작점)을 채우고, 반드시 **9단계(obsidian-brain-update)** 로 마무리하세요. 저장 없이 세션을 끝내지 않습니다.

## 이 스킬이 절대 하지 않는 것

- 사용자 승인 없이 add_feature 의도를 바로 Builder로 넘기지 않습니다.
- Decision Card 없이 숨은 결정을 임의로 골라잡지 않습니다.
- 미해결 결정이 남아있거나(`Unknown Map.md`/`Decision Index.md`로 판단, `unresolved_decisions` state.json 필드가 아님) 사용자 이해가 `user_confirmed`/`decision_confirmed` 수준이 아닌데(대화 맥락으로 판단, `understanding_state` state.json 필드가 아님) 7단계(Guided Work)로 넘어가지 않습니다.
- secret 파일을 읽거나 출력하지 않습니다 (`scripts/protect-secrets.js`가 이미 막지만, 이 스킬도 시도하지 않습니다).
- 증거 없이 "완료"라고 말하지 않습니다.
- Obsidian 저장 없이 세션을 종료하지 않습니다.

## 예시 흐름 (도구가 실제로 어떻게 엮이는지)

입력: "로그인 기능 붙여줘."

```text
1. node scripts/classify-intent.js "로그인 기능 붙여줘" → "add_feature"
   (이 CLI 호출은 hooks/scripts/handler.js가 자동으로 이벤트 기록 — 별도 호출 불필요)

2. Unknown Map.md/Decision Index.md에 남은 항목이 있는지 확인 (state.json이 아니라 파일로 판단)
   meeting-system 호출 → selectMeeting('add_feature', { hasUnresolvedDecisions: true })
     → 'discovery_meeting'

3. unknown-map 호출
   → Unknown Map.md: 로그인/인증 카테고리에 "이메일인가 소셜인가?",
     "비밀번호 재설정 필요한가?", "사용자 정보 저장 위치?", "첫 MVP에 꼭 필요한가?" 채움

4. decision-card 호출 → 선택지 A(로그인 없이 MVP) / B(이메일) / C(소셜) / D(설명 더 듣기) 제시

5. 사용자가 "A" 선택
   → decision-card가 ADR-000X-no-login-mvp.md 작성, Decision Index.md 갱신, Unknown Map.md에서 항목 제거
   → (state.json 기록 없음, 이 문서들 자체가 "결정 끝남"의 근거)

6. minimality-ladder 호출 → "로그인 없이 로컬 저장으로 시작" 자체가 이미 최소안임을 확인

7. guided-plan 호출 → Build Readiness Meeting, Phase Plan 작성(allowed_files/sensitive_files/
   verification_commands frontmatter 포함), "이 범위로 진행할까요?" 확인 후 사용자가 채팅에
   [senpai-go:social-login-app]을 정확히 보내면 → hooks/scripts/handler.js가 감지 →
   scripts/senpai-approve.js의 recordApproval()이 인프로세스로
   approved_scope/allowed_files/sensitive_files/scope_hash를 state.json에 기록
   → 이후 Write/Edit은 PreToolUse 훅(scope-check.js)이 allowed_files 안에서만 허용
   (sensitive_files는 재확인, 나머지는 자동 진행)

8. evidence-loop 호출 → 빌드 성공/파일 생성 확인 후 "구현 완료, 검증 전"으로 보고

9. obsidian-brain-update 호출 → Session Memory.md, Current State.md 갱신
```

이 예시처럼, 이 스킬 자신은 "지금 몇 단계인지"와 "다음에 어느 스킬을 불러야 하는지"만 판단합니다. 실제 내용(질문 문구, ADR 본문, 체크리스트 항목)은 항상 위임받은 스킬이 채웁니다. 상태 변화는 전부 신뢰된 인프로세스 모듈(훅 핸들러, senpai-approve.js)이 대신 하는 일이지, 이 스킬이 `writeState()`/`appendEvent()`를 직접 호출하는 게 아닙니다.
