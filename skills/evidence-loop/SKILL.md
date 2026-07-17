---
name: evidence-loop
description: Confirms real evidence before any completion claim -- never trust the model's own belief about what it just did. Invoke whenever the user asks "다 됐어?", "확인해줘", "완료됐어?", "검증해줘", "제대로 됐어?", "문제 없어?" or right after a file change, right before writing any completion sentence, or on a TaskCompleted event. Reads the project's Completion Evidence.md (instantiated from templates/completion-evidence.md) and Verification.md, re-checks real file state via Read/Bash (not memory of a prior tool result), asks the user to run the Phase Plan's verification_commands themselves and report the result (never auto-executes them -- a security review found no way to safely auto-run arbitrary build/test commands), cross-checks .senpai/event_logs.jsonl, then reports using only the five allowed completion phrases (부분 완료 / 구현 완료, 검증 전 / 로컬 기준 완료 / 빌드 기준 완료 / 검증 완료) and never the forbidden ones. If the verdict came from a delegated subagent (e.g. `senpai-harness:evidence-reviewer`), the top-level reply to the user MUST include that subagent's exact "판단:" phrase verbatim -- no paraphrasing, no dropping qualifiers like "검증 전", no swapping it for emoji/checkmarks or a self-authored summary line (see 5-1단계; a live run leaked exactly this way once, producing "검증 결과: 구현 완료 ✓"). Writes vault updates with the Write tool directly under vault/ (scope-check.js exempts and backs up vault writes automatically).
disable-model-invocation: false
---

# Evidence Loop

## 이 스킬의 역할

파일이 바뀌었다고 완료가 아닙니다. 완료 증거가 있어야 완료입니다 (`docs/00_CONCEPT.md` 여섯 번째 철학 "Verify Before Done"). 이 스킬은 "완료했습니다"라고 말하기 직전에 반드시 끼어들어서, 그 말이 실제 증거에 근거하는지 확인하는 역할만 합니다.

이 스킬이 존재하는 이유는 취향이 아니라 **실측**입니다. 실제 테스트에서 두 번 독립적으로 재현된 사실(상세는 `docs/SAFETY_ENFORCEMENT_POLICY.md` §P1 실증 검증): 안전장치(훅)가 파일 쓰기를 실제로 **거부**해서 파일이 전혀 생성되지 않았는데도, 모델의 최종 응답 텍스트는 "파일 생성 완료했습니다"였습니다. 승인 확인이 필요한 상황(`ask` 경로)에서 대화형 입력이 불가능해 안전하게 거부 처리됐을 때도 마찬가지 — 모델은 또 "파일을 생성했습니다"라고 잘못 보고했습니다.

결론: **모델 스스로 하는 "완료했다"는 말은 증거가 아닙니다.** 방금 전 자기 턴에서 뭐라고 말했든, 지금 이 순간 실제 파일/로그를 다시 열어보기 전에는 아무것도 확정하지 마세요.

## 언제 발동하는가

- 사용자가 "다 됐어?", "확인해줘", "완료됐어?", "검증해줘", "제대로 됐어?", "문제 없어?"라고 물을 때
- Write/Edit 등으로 파일을 바꾼 직후, 그 결과를 사용자에게 보고하기 직전 (사용자가 안 물어봐도 먼저 확인)
- `TaskCompleted` 이벤트 발생 시
- 스스로 "완료", "됐다", "성공", "문제없다" 같은 단어를 쓰려는 순간 (쓰기 전에 반드시 이 스킬부터)

이 스킬을 건너뛰고 완료를 선언했다면, 그건 정확히 P0/P1에서 두 번 재현된 실패를 세 번째로 반복하는 것입니다.

## 실행 절차

### 1단계 — 무엇을 확인해야 하는지부터 정리

`templates/completion-evidence.md`의 5개 체크리스트가 기준입니다.

```text
- [ ] 파일 생성/수정 확인
- [ ] 빌드 성공
- [ ] 테스트 통과
- [ ] 사용자 흐름 확인
- [ ] 비개발자용 결과 설명 완료
```

이번 작업에 해당하지 않는 항목(예: UI 없는 스크립트 작업이면 "사용자 흐름 확인")은 빼도 되지만, 뺀 이유를 나중에 사람에게 설명할 수 있어야 합니다. 짐작으로 "이건 필요 없겠지"라고 조용히 넘어가지 마세요.

`vault/10_Projects/{project}/Completion Evidence.md`가 이미 있으면 먼저 읽어서 지금까지 체크된 항목을 확인하세요. 없으면 이번이 이 프로젝트의 첫 검증이라는 뜻이니 템플릿에서 새로 시작합니다.

### 2단계 — 실제 증거를 직접 다시 확인 (기억에 의존 금지)

방금 전 자기 응답이나 이전 턴 요약을 증거로 쓰지 마세요. 지금 이 순간 다시 확인합니다.

- **파일 생성/수정**: `Read` 도구로 그 파일을 직접 열어 내용을 눈으로 봅니다. 또는 Bash로:
  ```bash
  test -f "src/auth/login.js" && echo EXISTS || echo MISSING
  cat "src/auth/login.js"
  ```
- **빌드 성공 / 테스트 통과**: **이 스킬은 빌드·테스트 명령을 Bash로 직접 실행하지 않습니다.** (보안 검토에서 확인된 내용: `npm`/`node` 같은 실행기는 그 자체로 임의 코드를 실행할 수 있어서, 어떤 프론트매터 승인 절차를 거치더라도 안전장치가 자동으로 실행해 주는 방식은 안전할 수 없습니다 — `scripts/scope-check.js`는 이런 명령을 Bash로 자동 실행하는 경로를 아예 두지 않습니다.) 대신, 이번 Phase Plan의 `verification_commands`에 적힌 명령을 확인해서 **사용자에게 직접 실행하고 결과를 알려달라고 요청**합니다. 지금 계획에 어떤 명령이 적혀 있는지는 `node scripts/state-store.js`로 확인합니다(이 스크립트는 읽기 전용이라 항상 실행 가능):
  ```bash
  node scripts/state-store.js
  ```
  출력 JSON의 `verification_targets` 배열에 있는 명령을 사용자에게 그대로 보여주고 실행을 요청합니다. 이 목록은 필터를 거치긴 하지만(Fable 5 감사 N1, P4.5) 그 필터가 명령 내용을 완전히 검증하는 것은 아닙니다 — 매번 아래처럼 "이해되지 않으면 실행하지 말라"는 경고를 반드시 같이 보여주세요. 예:
  ```text
  아래 명령을 터미널에서 직접 실행해서 결과를 알려주시겠어요?

  npm run build
  node tests/unit/foo.test.js

  (이 명령이 무엇을 하는지 잘 모르겠으면 실행하지 말고 먼저 알려주세요.)
  ```
  사용자가 알려준 실제 종료 코드/출력을 근거로 판단합니다. "빌드될 것 같다"·"테스트는 통과했을 것"이라는 추측은 증거가 아니고, 사용자가 결과를 알려주기 전까지는 이 항목을 확인된 것으로 치지 않습니다.
  `verification_targets`가 비어 있거나, 확인하려는 항목에 맞는 명령이 없다면, 이 항목은 확인할 방법이 없다는 뜻입니다 — 짐작으로 채우지 말고 4단계에서 "부족한 증거"로 명시합니다.
- **사용자 흐름 확인**: 실제로 그 기능을 써보거나(가능하면), 최소한 코드 경로를 따라가며 실제로 동작하는지 확인합니다.
- **비개발자용 결과 설명**: 지금 사용자에게 보여줄 결과 문장을 실제로 준비했는지 확인합니다(이 항목은 이 스킬의 6단계 보고 자체가 증거가 됩니다).

### 3단계 — `.senpai/event_logs.jsonl` 대조 (보조 증거, 결정적 증거 아님)

`scripts/event-log.js`가 훅이 발화할 때마다 `.senpai/event_logs.jsonl`에 한 줄씩 JSON을 남깁니다. 이 로그는 **"시도했다"만 증명하고 "성공했다/거부됐다"는 기록하지 않습니다** (handler.js는 `PreToolUse`가 허용/거부를 결정하기 *전에* 이미 이벤트를 기록합니다). 그래서 이 로그만 보고 완료를 판단하면 안 되고, 2단계의 직접 확인을 보강하는 용도로만 씁니다.

```bash
tail -n 50 .senpai/event_logs.jsonl | grep '"file_path":"src/auth/login.js"'
```

읽는 법:

- 같은 `file_path`+`tool_name`에 대해 `"hook_event_name":"PreToolUse"`와 `"hook_event_name":"PostToolUse"`가 **둘 다** 있으면 그 도구 호출이 실제로 끝까지 실행됐다는 신호입니다(거부된 호출은 일반적으로 `PostToolUse`까지 이어지지 않는 것으로 알려져 있습니다 — 이 로그 스키마 자체에는 허용/거부 필드가 없으므로 이는 정황 신호이지 단정적 사실이 아닙니다).
- `PreToolUse`만 있고 그 뒤로 이어지는 `PostToolUse`가 없으면, 그 쓰기가 훅에 의해 막혔을 가능성이 있다는 경고 신호입니다 — 이럴 때 2단계에서 파일이 없거나 옛날 내용 그대로였다면 원인이 설명됩니다.
- `tool_use_id`가 로그에 없으므로 완벽한 1:1 매칭은 안 됩니다. 최근 몇 줄(`tail`) 안에서 순서로 판단하세요.
- `file_path`는 호출 당시 그대로(절대 경로일 수도, 상대 경로일 수도) 기록됩니다. grep이 아무것도 안 잡히면 경로 형태 차이일 수 있으니 전체 경로로 한 번, 파일명만으로 한 번 더 시도하거나 `tail`로 최근 줄을 눈으로 훑어보세요.

### 4단계 — 부족한 증거 표시

1~3단계에서 확인 못 한 항목이 하나라도 있으면, 그 항목과 "다음에 뭘 확인해야 완료라고 부를 수 있는지"를 명확히 적습니다. 애매하게 넘어가지 않습니다.

### 5단계 — 완료 표현 고르기 (허용/금지)

| 허용 (상황에 맞는 것 하나만 사용) | 금지 (어떤 상황에서도 쓰지 않음) |
|---|---|
| 부분 완료 — 일부만 끝나고 나머지는 아직 | 증거 없이 "완료했습니다" |
| 구현 완료, 검증 전 — 코드는 다 썼지만 실행/확인 전 | 테스트 없이 "문제 없습니다" |
| 로컬 기준 완료 — 내 환경에서는 확인, 실서비스 환경은 아직 | 확인하지 않은 기능을 "작동합니다"라고 단정 |
| 빌드 기준 완료 — 빌드까지만 성공 | |
| 검증 완료 — 실제 동작 확인까지 끝 | |

(`docs/02_PRODUCT_SPEC.md` "6. 검증 흐름", `vault-template/90_System/Evidence Rules.md`와 동일)

#### 5-1단계 — 판정을 서브에이전트가 대신 냈다면: 표현을 토씨 하나 바꾸지 않고 전달 (필수, 예외 없음)

이 확인을 최상위 대화 루프가 직접 하지 않고 서브에이전트(`Agent`/`Task` 도구로 호출한 `senpai-harness:evidence-reviewer`, 또는 Council 위원으로 소집된 같은 에이전트)에게 위임했다면, 그 서브에이전트가 돌려준 "판단:" 문구를 사용자에게 그대로 전달하는 것은 선택이 아니라 **이 스킬의 필수 산출물**입니다. 판정은 정확했는데 전달 과정에서 뭉개지면, 이 스킬 전체가 존재하는 이유(증거 없는 완료 선언 방지)가 무력화됩니다.

**실측 사고 사례** (2026-07 라이브 검증 세션 발견 2, 안전 문제는 아니었지만 표현 규율 위반): `evidence-reviewer` 서브에이전트는 실제 파일을 근거로 정확히 `판단: 구현 완료, 검증 전`이라고 냈습니다. 하지만 이걸 넘겨받은 최상위 대화 루프는 사용자에게 `### 검증 결과: **구현 완료** ✓`라고 표시했습니다 — "검증 전"이 통째로 빠졌고, 이모지(✓)가 덧붙었고, "검증 결과: ..."라는 자체 요약 문구는 허용된 5개 표현 중 어느 것과도 정확히 일치하지 않습니다. (덧붙여 그 서브에이전트 자신의 "권고" 문장도 "'구현 완료'라고만 말할 것"이라며 이미 "검증 전"을 생략하고 있었고, 최상위 모델은 정확한 "판단" 필드 대신 이 축약된 "권고" 문장을 따라간 것으로 보입니다 — 두 지점 모두에서 규율이 샜습니다.)

**강제 규칙 (예외 없음)**:

1. 서브에이전트 출력에 "판단:" 필드가 있으면, 거기 적힌 5개 허용 표현(부분 완료 / 구현 완료, 검증 전 / 로컬 기준 완료 / 빌드 기준 완료 / 검증 완료) 중 하나를 **단어 하나도 바꾸지 않고 그대로** 사용자에게 보여줄 최종 응답에 포함시킵니다.
2. "권고" 필드나 다른 요약 문장이 판단 문구를 축약했더라도, 최상위 응답은 반드시 "판단" 필드 원문을 따릅니다. 권고 문장을 따라가다 "검증 전", "로컬 기준" 같은 한정어를 빠뜨리지 않습니다.
3. 허용된 5개 표현을 이모지·기호(✓, ✅, 🎉 등)로 대체하거나, "검증 결과: 구현 완료 ✓"처럼 자체 요약 문구로 바꿔치기하지 않습니다. 표현 앞뒤로 설명을 덧붙이는 것은 괜찮지만, 표현 그 자체는 원문 그대로 남겨야 합니다.
4. **금지 예시(실측, 그대로 반복 금지)**: `### 검증 결과: **구현 완료** ✓`
5. **올바른 예시**: `**구현 완료, 검증 전** 상태입니다.` — 5개 표현 중 하나가 토씨 하나 안 바뀌고 그대로 노출됨.

### 6단계 — `vault/10_Projects/{project}/Completion Evidence.md` 갱신

**중요: `Write` 도구는 파일 전체를 덮어씁니다. 이어붙이기가 아닙니다.** 그래서 반드시 "읽기 → 기존 내용에 이번 결과를 합친 전체 내용 만들기 → 쓰기" 순서를 지킵니다. 기존 체크 표시나 과거 기록을 지우고 새로 쓰면, 그 자체가 증거를 없애는 것이 됩니다.

`vault/` 밑의 파일은 `Write` 도구로 직접 씁니다. `scope-check.js`가 `vault/` 경로를 build 승인과 무관하게 항상 허용하면서, 덮어쓰기 전 자동 백업(`.senpai/backups/`)과 시크릿 경로 차단을 그 자리에서 같이 처리합니다(`skills/meeting-system/SKILL.md` "5단계" 참고) — 이 스킬이 따로 백업이나 시크릿 검사를 챙길 필요가 없습니다.

1. 기존 파일이 있으면 `Read`로 먼저 읽습니다. 없으면 `templates/completion-evidence.md`를 기준으로 새로 채웁니다.
2. 이번 검증 결과를 합친 전체 마크다운을 만듭니다. "이번 작업" 섹션에서 검증 대상 계획을 `[[10_Projects/{project}/Phase Plan]]`으로 링크합니다.
3. `Write` 도구로 그대로 저장합니다.

```
Write 도구:
  file_path: vault/10_Projects/<project-name>/Completion Evidence.md
  content: <읽은 기존 내용 + 이번 검증 결과를 합친 전체 마크다운>
```

파일이 실제로 갱신됐는지는 `Read`로 다시 열어 눈으로 확인하세요 — 여기서도 모델의 짐작이 아니라 실제 파일 내용을 봅니다.

### 7단계 — `vault/10_Projects/{project}/Verification.md` 표에 한 줄 추가

`Verification.md`는 "기존 줄은 지우지 않습니다"가 원칙입니다. 6단계와 같은 읽기→합치기→`Write` 순서로, 표 마지막에 이번 확인 결과를 새 줄로 **추가만** 합니다.

```text
| 테스트 항목 | 기대 결과 | 실제 결과 | 상태 |
| --- | --- | --- | --- |
| 로그인 폼 제출 | 성공 시 대시보드로 이동 | 실제로 이동 확인 (수동 클릭 테스트) | 검증 완료 |
```

### 8단계 — `vault/00_Dashboard/Completion Evidence.md`는 매번 다시 쓰지 않는다

이 대시보드 파일은 프로젝트별 표를 담는 곳이 아니라, "상세 증거는 프로젝트별 파일에서 확인하세요"라고 안내만 하는 고정 페이지입니다(`20_Decisions/Decision Index.md`·`30_Errors/Error Index.md`와 달리 이 파일 자체가 인덱스 역할을 하지 않습니다). 매 검증마다 이 파일 내용을 바꾸지 마세요. `updated` frontmatter 날짜만 갱신이 필요하면 6단계와 같은 절차(읽기→`Write`)로 바꿉니다.

## 실전 예시 — "로그인 기능 다 됐어?"

입력:

```text
로그인 기능 다 됐어?
```

절차:

1. `vault/10_Projects/카페알바시프트/Completion Evidence.md` 읽기 → 지난 기록 없음(첫 검증)
2. 실제 확인
   - `Read`로 `src/auth/login.js` 열어봄 → 실제로 존재하고 로그인 로직이 들어있음 (파일 생성/수정 확인 O)
   - `npm run build` 실행 → 성공 (빌드 성공 O)
   - 로그인 관련 테스트 파일이 아직 없음 → 테스트 통과 항목 확인 불가 (X)
   - 실제로 로그인 버튼을 눌러보는 수동 확인은 아직 안 함 (사용자 흐름 확인 X)
3. `.senpai/event_logs.jsonl`에서 `src/auth/login.js`에 대한 `PreToolUse`/`PostToolUse` Write 쌍 확인 → 둘 다 있음(실제로 쓰기가 끝까지 실행됐다는 보조 신호)
4. 부족한 증거: 테스트 통과, 사용자 흐름 확인
5. 완료 표현: 위 표 기준으로 **"구현 완료, 검증 전"**을 고름 (검증 완료는 아직 못 씀)
6. `vault/10_Projects/카페알바시프트/Completion Evidence.md`를 6단계 절차로 갱신(체크박스 2개 체크, 부족한 증거 2개 명시)
7. `Verification.md`에 한 줄 추가

사용자에게 보여줄 답변 예시:

```text
확인해봤습니다.

로그인 기능 검증 결과:
- [완료] src/auth/login.js 파일 생성 확인 (직접 열어서 확인)
- [완료] 빌드 성공
- [미확인] 실제 로그인 테스트는 아직 안 돌려봄
- [미확인] 로그인 버튼을 실제로 눌러보는 확인은 아직 안 함

결론: 구현 완료, 검증 전 입니다.
실제로 로그인이 되는지 지금 같이 테스트해볼까요?
```

## 지켜야 할 것

- 방금 전 자기 응답이나 세션 요약을 증거로 쓰지 않습니다. 매번 `Read`/`Bash`로 다시 확인합니다 — 이게 P0/P1에서 두 번 재현된 실패를 막는 유일한 방법입니다.
- `.senpai/event_logs.jsonl`은 "시도했다"의 기록이지 "성공/거부"의 기록이 아닙니다. 결정적 증거로 쓰지 말고 2단계 직접 확인을 보강하는 용도로만 씁니다.
- 금지 표현("완료했습니다", "문제 없습니다", "작동합니다") 중 하나라도 쓰려는 순간, 그 근거가 된 확인이 몇 단계였는지 스스로에게 되물어보세요. 답을 못 하면 그 표현을 쓰면 안 됩니다.
- 판정을 서브에이전트(`evidence-reviewer` 등)에게 위임했다면, 그 서브에이전트의 "판단:" 문구를 토씨 하나 바꾸지 않고 사용자 응답에 그대로 포함시킵니다(5-1단계). "권고" 필드의 축약이나 최상위 모델 자신의 요약을 따라가지 않습니다. 이모지·기호(✓ 등)로 대체하거나 "검증 결과: 구현 완료 ✓" 같은 자체 문구로 바꿔치기하지 않습니다 — 이건 취향이 아니라 실측(2026-07 라이브 검증 세션 발견 2)으로 확인된 실패 패턴입니다.
- vault 파일은 `Write` 도구로 `vault/...` 경로에 직접 씁니다(백업/시크릿 차단은 `scope-check.js`가 자동으로 처리). `Write`는 전체 덮어쓰기입니다. 기존 내용을 먼저 읽고 합친 전체 내용을 넘기세요. 그렇지 않으면 과거 검증 기록이나 Verification.md의 이전 줄이 사라집니다.
- **빌드/테스트 명령을 스스로 Bash로 실행하지 않습니다.** `verification_commands`에 있든 없든 마찬가지입니다 — 이런 명령은 항상 사용자에게 직접 실행을 요청하고 결과를 전달받는 방식으로만 확인합니다. 직접 실행을 시도하면 안전장치가 거부하며, 거부됐다고 다른 방법으로 우회하지 않습니다.
- vault나 `.senpai/` 폴더 자체가 없어서 확인이 안 될 때는 짐작으로 "설치가 안 됐나보다"라고 넘기지 말고 `node scripts/doctor.js`를 실행해 실제 상태를 사람이 읽을 수 있는 리포트로 확인하세요.
- 이 스킬은 증거를 확인하고 보고하는 것으로 끝납니다. 부족한 증거를 스스로 지어내거나, 확인 없이 체크박스를 미리 체크하지 않습니다.
