# Safety Enforcement Policy (G1~G4)

> P1의 필수 산출물. 코딩 전에 정책을 먼저 못박아, executor가 "Write만 막으면 되겠지"로 축소하는 것을 방지한다.
> 근거: `docs/P0_HOOK_VERIFICATION.md`(실증), `.claude/plans`의 승인된 실현 계획(critic REVISE → 어드바이저 최종 승인).

## 배경: 왜 이 정책이 필요한가

P0에서 실증한 사실 두 가지가 이 정책의 전제다.

1. **PreToolUse는 Write/Edit뿐 아니라 Bash 도구 호출에도 발화하고, 명령어 전문(`tool_input.command`)을 볼 수 있다.** 즉 `cat >`, `echo >`, `sed -i` 같은 Bash 경유 쓰기를 막을 기술적 수단이 이미 있다 — 안 막으면 그냥 안 만든 것이다.
2. **모델의 자기 보고는 신뢰할 수 없다.** P0의 `ask` 테스트에서 실제로는 쓰기가 거부됐는데 모델은 "완료했습니다"라고 답했다. 따라서 "승인됐다/완료됐다"는 판단은 절대 모델의 말이 아니라 `state.json`이라는 외부 진실源(state-store)에 근거해야 한다.

## G0 — opt-in 게이트 (P5 라이브 설치 검증 후 추가, 2026-07 — 보안 검토로 한 차례 재수정됨)

> `docs/HARNESS_ENGINEERING.md` §C-1에서 실측한 결함에 대한 대응: user scope로 설치하면 이 훅은 사용자의 **모든** 프로젝트에서 발화한다. G0 없이는 Senpai Harness를 쓰기로 한 적 없는 무관한 프로젝트에서도 G4(fail-closed)가 걸려 모든 쓰기가 막힌다 — 별도 클린룸 테스트 프로젝트에서 실제로 재현·확인된 회귀다.

- 현재 저장소 루트에 `senpai.config.yaml`이 **없으면**, 이 프로젝트는 Senpai Harness에 opt-in하지 않은 것으로 간주하고 **완전한 passthrough**로 처리한다 — `hookSpecificOutput` 자체를 아예 반환하지 않는다(`{}`). Secret 차단(아래 참고)도 예외 없이 건너뛴다. "일부만 관리"하는 애매한 상태보다 "전혀 관여 안 함"이 사용자에게 더 명확하다는 판단.
- **정정(보안 검토, 2026-07, CRITICAL)**: 최초 구현은 여기서 `{decision: 'allow'}`를 반환했었다. 이건 틀렸다 — Claude Code의 PreToolUse 프로토콜에서 `allow`는 "의견 없음"이 아니라 **네이티브 승인 창을 건너뛰는 명시적 자동 승인**이다(이 저장소 자신의 `docs/P0_HOOK_VERIFICATION.md`가 이미 실증: 훅 결정이 `acceptEdits`보다 우선한다). 즉 예전 구현은 무관한 프로젝트에서 `rm -rf`·`.env` 덮어쓰기까지 **아무 확인 없이 자동 실행**시켰다 — 하네스를 아예 안 깐 것보다 위험한 상태였다. 지금은 `scripts/approval-gate.js#handlePreToolUse`가 `{}`(진짜 무의견)를 반환해, Claude Code 자신의 평소 권한 처리(네이티브 프롬프트 등)가 하네스가 없는 것과 똑같이 적용된다. 이 게이트는 이제 `scripts/scope-check.js#checkToolCall` 내부가 아니라 **`approval-gate.js`에만** 있다 — `checkToolCall`은 `allow`/`deny`/`ask` 세 값만 다루는 순수 G1~G4 판정 함수라 "무의견"을 표현할 수 없기 때문이다.
- 마커는 `.senpai/` 디렉터리의 존재가 아니라 **`senpai.config.yaml` 파일 하나**로 정의한다. `.senpai/`는 훅이 첫 이벤트를 로그로 남기는 순간(`event-log.js`) 의도와 무관하게 자동 생성되므로, 그걸 마커로 쓰면 설치 직후 아무 의도 없이도 프로젝트가 "관리됨"으로 전환돼버린다. `senpai.config.yaml`은 사람이 `project-template/`에서 직접 복사하거나(현재), 향후 `/senpai-harness:init`이 쓰기 전에는 결코 저절로 생기지 않는다. 로깅(`event-log.js`)도 같은 게이트를 통과해야만 실행되도록 `hooks/scripts/handler.js`에서 함께 막았다 — 안 그러면 "여기선 관여 안 함"이 차단 여부에만 적용되고 로그는 계속 쌓이는 반쪽짜리 약속이 된다.
- **`/senpai-harness:init`의 닭-달걀 문제, 정정(critic 검토, MAJOR)**: 최초 설명("마커를 심고 나면 이후 모든 쓰기가 G1~G4 보호를 받는다")은 init이 모델의 Write 도구로 여러 파일을 순서대로 쓴다고 가정하면 **틀린 결론**이다 — `senpai.config.yaml`을 먼저 쓰면 그 즉시 이후 쓰기(`CLAUDE.md`, `AGENTS.md`, `vault-template/*`)가 미승인 상태로 전부 deny된다("보호받는다"가 아니라 "그 순간부터 죽는다"). 해결책은 둘 중 하나이고, **직접 구현(a)을 기본으로 채택한다**: (a) init을 `doctor.js`/`select-meeting.js`처럼 **Bash로 실행하는 단일 node 스크립트**(`scripts/init.js`)로 만들어 그 스크립트 내부에서 직접 `fs.writeFileSync`로 모든 파일을 쓴다 — 모델의 Write 도구를 거치지 않으므로 PreToolUse가 개별 파일마다 발화하지 않고, 유일한 관문인 `node scripts/init.js` Bash 호출 자체는 마커가 아직 없는 시점에 G0 passthrough를 그대로 통과한다. (b) 그래도 모델의 Write 도구를 꼭 써야 한다면, `senpai.config.yaml`을 **반드시 마지막에** 써서 그 전까지의 모든 쓰기가 G0 passthrough 상태에서 끝나게 해야 한다 — 마커부터 먼저 쓰는 순서는 부서진 설계다.
- **cwd 불일치의 위험, 정정(critic 검토, MAJOR)**: `isSenpaiManagedProject`는 `process.cwd()`만 보고 상위 디렉터리를 탐색하지 않는다. 프로젝트의 하위 폴더에서 Claude Code를 실행하면(마커는 상위에 있는데 cwd는 하위) 마커를 못 찾아 "관리 대상 아님"으로 오판 — **이전엔 이 경우 state.json도 못 찾아 전부 deny(시끄럽지만 안전)였는데, 지금은 전부 passthrough(조용히 보호가 꺼짐)로 바뀐 것**이다. 근본 수정(상위 탐색을 G0과 `state-store.js`의 `getStatePaths()` 양쪽에 동시에 통일)은 이번 변경 범위를 넘는 더 큰 작업이라 보류하고, 대신 최소 조치로 `scripts/doctor.js`에 "상위 폴더에 마커가 있는데 지금 위치엔 없음"을 감지해 알리는 진단 항목을 추가했다(`checkManagedMarkerReachability`). **저장소 루트에서 실행해야 한다는 게 이제 단순 불편이 아니라 조용한 보호 해제로 이어지는 전제 조건**임을 여기 명시해둔다. (**추가 완화, 2026-07**: 이 walk 로직을 `scripts/scope-check.js#findAncestorManagedMarker`로 뽑아내 `doctor.js`와 `/senpai-harness:init`(`scripts/init.js`) 양쪽에서 공유한다 -- G0 판정 자체(`isSenpaiManagedProject`)는 여전히 cwd-only로 남겨두되(범위를 넘는 근본 수정은 그대로 보류), init만큼은 하위 폴더에서 실행됐을 때 상위 폴더의 기존 관리 대상을 감지해 **거부**한다. 이 완화가 없으면 정확히 이 cwd 불일치 때문에 하위 폴더에서 init을 돌리면 기존 프로젝트 안에 중첩된 두 번째 `senpai.config.yaml` + `vault/`가 조용히 생겨버렸다 -- 제3자 감사가 실제로 재현한 사례.)

### G0 재검증 — `{}`가 진짜 passthrough인지 실행으로 확인 (2026-07)

critic/security-reviewer의 코드 리뷰는 "코드가 `{}`를 반환한다"까지만 확인했지, Claude Code가 그 `{}`를 실제로 어떻게 처리하는지는 아무도 직접 실행해서 본 적이 없었다 — 원래 CRITICAL 버그(`allow`)도 "문서/코드 리뷰상 안전해 보였지만 실행해보니 전체 자동승인이었다"는 식으로 발견된 것이었으므로, 같은 함정(리뷰로는 못 잡는 실행 시점 오해)에 다시 빠질 위험이 있었다. 그래서 실제 설치 후 `--debug hooks` 로 Claude Code 엔진 자체의 내부 로그를 직접 확인했다.

- **1차 시도(안 됨)**: `--permission-mode acceptEdits`로 헤드리스 Write를 시도해 "파일이 생성되면 실패, 안 되면 성공"으로 판별하려 했으나, **플러그인을 아예 설치하지 않은 대조군에서도** 헤드리스 기본(`default`) 권한 모드가 확인 없이 Write와 `rm -f`를 그대로 실행했다 — 즉 이 CLI 버전의 헤드리스(`-p`) 모드는 애초에 훅 유무와 무관하게 확인 없이 통과시킨다. 파일 생성 여부만으로는 "무의견 통과"와 "무조건 허용"을 구분할 수 없었다(둘 다 파일이 생김).
- **2차 시도(성공)**: `-d hooks --debug-file`로 Claude Code 자신의 내부 디버그 로그를 직접 열어 두 상황을 대조했다.
  - **미관리 프로젝트**(마커 없음)에서 Write 시도 → 로그: `"Hook PreToolUse:Write (PreToolUse) success:\n{}"` — 그리고 바로 이어서 `permissionDecisionMs=2`로 Claude Code 엔진이 **자체 판단**으로 즉시 진행. **"Hook ... returned permissionDecision: ..." 로그 줄 자체가 존재하지 않았다** — 즉 엔진이 우리 훅으로부터 어떤 결정도 수신하지 못한 것으로 기록됨. 플러그인을 아예 안 깐 대조군과 로그·결과 모두 동일.
  - **관리 대상 프로젝트**(마커 있음, 미승인)에서 같은 Write 시도 → 로그: `"Hook PreToolUse:Write (PreToolUse) success:\n{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"deny\",...}}"`, 곧이어 `Hook PreToolUse (node ".../handler.js") returned permissionDecision: deny (reason: ...)`라는 **명시적 로그 줄**이 찍혔고 실제로 파일이 생성되지 않았다(G4 fail-closed 정상 동작).
  - 두 경우의 로그 형태가 엔진 내부 수준에서 명확히 다르다 — `{}`는 "이 훅으로부터 결정 없음"으로 처리되어 아무 로그도 안 남기고, 명시적 `permissionDecision`은 반드시 "returned permissionDecision: X" 로그를 남기고 실제로 적용된다. 이는 `{}` ≠ `allow`라는 것을 코드 읽기가 아니라 **엔진의 실제 실행 로그**로 확인한 것이다.
- **결론**: G0의 `{}` passthrough는 문서·코드 리뷰뿐 아니라 Claude Code 엔진의 실행 로그 수준에서도 "무의견"으로 확인됐다. 이 CRITICAL 수정은 이제 라이브로 재검증 완료 상태다.

### G0 제3자 독립 감사 (Fable 5, 2026-07) — critic/security-reviewer와 별개인 세 번째 시각

앞선 critic + security-reviewer(둘 다 이 세션의 다른 모델)와 라이브 재검증을 모두 마친 뒤, 사용자 요청으로 **Fable 5 모델을 명시적으로 지정**해 보안 감사역 1명 + 설계 어드바이저역 1명을 병렬로 다시 소환했다 — 앞선 리뷰 내용을 전혀 모르는 상태에서 코드와 문서만 보고 각자 독립적으로 판단하게 한 뒤, 서로의 결과를 교차 확인시켰다. 두 감사 모두 REVISE 판정을 내렸고, 이전 두 차례 검토(critic+security-reviewer 최초 라운드, 그리고 라이브 재검증)가 놓친 실제 결함을 새로 찾아냈다.

**MEDIUM/CONFIRMED — UserPromptSubmit 승인 캡처 경로가 G0에 안 걸려 있었다.** `hooks/scripts/handler.js`의 `[SENPAI-APPROVE]` 트리거 분기는, 두 줄 위의 로깅 호출(원래 CRITICAL 수정 때 G0로 막았던 바로 그 자리)과 달리 `isSenpaiManagedProject` 게이트가 아예 없었다. 미관리 프로젝트에서도 `[SENPAI-APPROVE]`를 보내면 응답 메시지가 그대로 나갔고, 우연히 `.senpai/state.json`이 남아있는 미관리 프로젝트라면 `approved_scope`가 실제로 그 파일에 기록될 수 있었다 — G0의 "완전히 관여 안 함" 약속을 로깅 누수 때와 똑같은 방식으로 어긴 것. 감사 중 하나는 **이 정확한 전제조건이 이 개발 저장소 자신의 로컬 상태에 실제로 남아있었다**는 것까지 확인했다(마커 없는 저장소 루트에 `.senpai/state.json`이 존재 — 세션 중 라이브 테스트의 잔재, gitignore 대상이라 커밋된 적은 없음, 정리 완료).
- **수정**: 개별 분기마다 게이트를 반복해서 넣는 대신, `hooks/scripts/handler.js#main()` 맨 위에서 `isSenpaiManagedProject`를 **딱 한 번** 확인하는 단일 관문(single choke point)으로 재구성했다 — 미관리 프로젝트면 그 즉시 `{}`를 찍고 끝, 로깅도 PreToolUse 처리도 승인 캡처도 전부 도달 불가능. 이렇게 하면 앞으로 새 이벤트 분기가 추가돼도 "게이트 넣는 걸 깜빡함" 부류의 버그가 구조적으로 불가능해진다(이번 버그가 정확히 그 부류였다 — 로깅 분기는 최초 CRITICAL 수정 때 게이트가 걸렸지만, 나중에 추가된 승인 캡처 분기는 그 배선 방식을 몰라서 빠뜨렸다). `approval-gate.js#handlePreToolUse` 내부의 자체 게이트는 방어 심층화 목적으로 그대로 남겨뒀다 — 테스트가 `handlePreToolUse`를 handler.js 경유 없이 직접 호출하기도 하므로 필요하다.

**MAJOR/CONFIRMED — 배달용 템플릿에 ponytail 메모가 하나 더 남아 있었다.** 방금 전 커밋에서 "CLAUDE.md/AGENTS.md에서 ponytail 코멘트를 제거했다"고 문서에 적었는데, 실제로는 `project-template/senpai.config.yaml`(세 번째 배달 파일, G0 마커 자신)에 ponytail 메모가 그대로 남아 있었다 — "제거 완료" 주장 자체가 틀렸던 것. 같은 파일의 `obsidian.template_path: ./vault-template` 필드도 아무도 읽지 않는 죽은 값이라 함께 삭제했다(`init.js`는 플러그인의 `vault-template/`를 대상 프로젝트의 `./vault`로 통째로 복사할 뿐, 이 필드를 참조하는 코드가 없다 -- `docs/03_TECHNICAL_SPEC.md`도 동일하게 정정). 교훈: "배달 파일에서 dev 메모를 지웠다"는 주장은 배달되는 **파일 전체 집합**을 열거해서 확인해야지, 일부만 확인하고 완료라고 적으면 이번처럼 같은 버그가 또 남는다.

**MAJOR/PLAUSIBLE, 새로 추가 — 제어 영역(control-plane) 자기 보호.** 이전까지는 Phase Plan의 `allowed_files`가 `senpai.config.yaml`이나 `.senpai/**` 자신을 가리키는 것을 막는 장치가 없었다. 이론상 경로: 모델이 vault 예외를 통해 Phase Plan을 쓰고(자동 allow) → 사람이 `[SENPAI-APPROVE]`를 보내면 그 경로가 `allowed_files`에 들어가고 → 이후 그 경로에 대한 mutation은 `ask`(네이티브 프롬프트)로 바뀐다 → `scope-hash.js`의 해시 계산은 결정론적이고 플러그인에 그대로 포함돼 있으므로, `allowed_files`와 해시를 같은 세션 안에서 통째로 재작성하면 변조 흔적 감지(scope drift)도 우회된다. 실제로 끝까지 재현한 것은 아니지만(PLAUSIBLE), 코드 경로는 각 단계 전부 확인됐다. **수정**: `scripts/scope-check.js`에 `findControlPlanePath`(Write/Edit/NotebookEdit/MultiEdit용)와 `checkBashCommand` 내부의 대응 검사(Bash가 실제로 추출한 mutating target에 대해서만) 두 곳을 추가해, `senpai.config.yaml`이나 `.senpai/` 아래 무엇이든 대상으로 하는 mutation은 **scope 승인 여부와 무관하게 항상 deny**한다 — secret 차단과 동일한 급의 무조건 차단. Read/Grep 같은 비-mutating 접근이나 `cat .senpai/state.json`처럼 진짜 읽기 전용인 Bash 명령은 전혀 영향받지 않는다(사용자에게 거부 사유를 설명하려고 상태를 읽는 것 자체는 정당하고 무해하므로) -- 이 구분을 잘못 두면(처음엔 Bash 원시 토큰 전체를 검사해서) `cat .senpai/state.json` 같은 정상적인 읽기 명령까지 막아버리는 회귀가 생긴다는 것을 자체 테스트로 확인해서 고쳤다.

**Minor 두 건도 함께 반영**: (1) `tests/unit/approval-gate.test.js`/`scope-check.test.js`의 픽스처 코멘트가 여전히 "checkToolCall이 'allow'로 단락한다"는, 이미 CRITICAL 수정으로 틀려진 예전 설계를 설명하고 있었다 — 정정. (2) Bash 명령을 파싱할 수 없을 때(`hasUnresolvableSyntax`) 그 실패가 secret-check 채널을 그대로 타고 나가 "secret path detected ((unresolvable command syntax...))"라는, secret과 무관한데 secret처럼 보이는 오해의 소지가 있는 거부 사유가 나갔다 — 이 제품에서 거부 사유는 비개발자에게 보여지는 UI 그 자체이므로, 별도 sentinel로 분리해 "unrecognized/unparseable command, fail-closed per G1"이라는 정확한 문구로 나가게 정정했다.

**세 감사(critic/security-reviewer 최초 라운드, 라이브 재검증, Fable 5 독립 감사)를 거치며 반복적으로 드러난 패턴**: G0은 원래 "이 하네스가 이 프로젝트에서 활성 상태인가"라는 활성화 경계로 설계되지 않고, "PreToolUse가 뭘 반환해야 하는가"라는 결정-경로 버그의 땜질로 시작됐다. 그래서 매 검토마다 "그 시점에 검토 대상이었던 표면"만 게이트가 걸렸고(처음엔 PreToolUse 결정, 그다음 로깅), 새로 추가되는 표면(승인 캡처)은 매번 게이트 없이 출발했다. 이번의 단일 관문 리팩터가 그 패턴에 대한 구조적 답이다 — 다음에 새 이벤트 분기가 추가돼도 게이트를 깜빡할 수 없다.

## G1 — mutating 기본 거부 (Bash 포함)

- 게이팅 대상 도구: `Write`, `Edit`, `Bash`. 그 외 도구(Read, Grep, Glob 등)는 원칙적으로 비-mutating이므로 이 정책의 대상이 아니다(단 protect-secrets는 Read에도 적용, 아래 참조).
- **Bash 정책은 화이트리스트 우선**: 읽기전용으로 알려진 패턴(`ls`, `cat` 리다이렉션 없음, `git status`, `git diff`, `git log`, `pwd`, `echo` 리다이렉션 없음, `grep`, `find`, `node --version`, `npm --version` 등)만 무조건 `allow`.
- 화이트리스트에 없는 모든 Bash 명령은 "mutating일 수 있다"고 가정한다. 리다이렉션(`>`, `>>`), in-place 편집(`sed -i`, `perl -i`), 패키지 설치(`npm install`, `pip install`, `brew install`), 삭제/이동(`rm`, `mv`)가 보이면 명시적으로 mutating으로 분류한다.
- **파싱 불가능한 명령 = deny.** "이해 못 했으니 일단 허용"은 절대 금지 — 모르면 막는다.
- `rm -rf`류 파괴적 삭제는 대상 경로가 안전한 임시 범위가 아닌 한 **scope 승인 여부와 무관하게 항상 deny** (quality.md의 "절대 줄이면 안 되는 것: 데이터 손실 방지"와 동일선).

## G2 — 결정론적 승인 캡처 + T0~T3 재확인 등급 (2026-07 재설계)

이 프로젝트의 근본 모순(어드바이저 지적): "명령어 안 외워도 된다"는 철학과 "결정론적 승인엔 파싱 가능한 신호가 필요하다"는 요구가 충돌한다. 초기 해법은 "범위 안이면 매번 사람에게 물어본다"(모든 in-scope 쓰기에 `permissionDecision:"ask"`)였다.

**정정(P5 실세션 스모크 테스트, 2026-07): 이 "매번 물어봄" 전제 자체가 실제로는 깨져 있었다.** `permissions.defaultMode: acceptEdits`가 전역으로 켜진 실제 사용자 환경에서 라이브로 재현한 결과, 승인된 범위 안 쓰기에 훅이 정확히 `"ask"`를 반환했는데도 네이티브 확인 팝업이 전혀 뜨지 않고 14개 파일이 그대로 통과됐다(공식 문서도 `"ask"`와 permission mode의 상호작용을 명시하지 않음을 확인함 — claude-code-guide 조사). 반면 범위 밖 거부(`deny`)와 secret 경로 거부는 같은 환경에서 여전히 완벽하게 작동했다 — 즉 `deny`는 강제력을 유지했지만, `ask`만 `acceptEdits` 사용자에게 조용히 무력화됐다. 이 상태에서 유일하게 실제로 작동하는 승인 신호는 채팅 문구(`UserPromptSubmit` 기반, permission mode와 무관하게 항상 작동) 하나뿐이었다 — "명령어 안 외워도 된다"는 제품 약속이 정확히 이 사용자층에서 깨지고 있었다는 뜻이다.

동시에 사용자 피드백: "승인된 파일이라도 매번 재확인"은 비개발자가 실제로 판단할 수 있는 것의 한계를 넘어서는 너무 투박한 기준이며, `senpai.config.yaml`의 `require_approval_for`(auth/payment/deploy/db/dependency-install/destructive) 목록은 실제로 아무 코드에서도 읽지 않는 죽은 설정이었다(확인: 이번 라이브 테스트에서 `src/auth.ts`가 `postcss.config.mjs`와 완전히 동일하게 취급됨).

이 두 문제(acceptEdits 무력화 + 재확인 등급 부재)를 해결하려는 첫 시도로 **T0~T3 등급**을 도입했다. 그런데 이 첫 시도 자체가 독립 이중 감사(security-reviewer + critic, 별도 컨텍스트, 아래 "T0~T3 이중 독립 감사" 절 참고)에서 세 건의 실제 결함으로 REVISE 판정을 받았다 — 아래 표와 설명은 그 감사 결과까지 반영한 **최종** 형태다.

| 등급 | 대상 | 판정 |
|---|---|---|
| T0 | `vault/` 문서 (하네스 자체 메모) | 항상 `allow`, 승인 여부와 무관 |
| T1 | `allowed_files` 중 `sensitive_files`에 없는 나머지 | Phase Plan 승인 시점에 이미 확인받았으므로 `allow` (재확인 없음) |
| T2 | Phase Plan의 `sensitive_files` **+ 코드에 하드코딩된 escalate-only 패턴 바닥선**(아래 참고) | **`deny`**, 사용자가 `[senpai-touch:<project>:<file>]`을 개별로 보내야 그 파일만 풀림 (2026-07 재수정 — 최초엔 `ask`였으나 아래 감사에서 acceptEdits 미해결로 확인돼 교체) |
| T3 | secret 경로, 제어 영역(`.senpai/`, `senpai.config.yaml`), 임의 코드 실행 | 항상 `deny`, 협상 불가 |

- T1을 `ask`에서 `allow`로 바꾼 것은 G0 수정 당시 명시적으로 금지한 "`allow`를 무의견의 대용으로 쓰지 않는다"는 원칙과 **다른 경우다** — G0의 그 원칙은 미승인/미관리 상태에서 `allow`가 실질적 자동승인으로 작동하는 것(무의견을 가장한 승인)을 막기 위한 것이었다. 여기서는 `state.approved_scope === true`이고 대상이 사람이 직접 검토한 `allowed_files` 안에 있는 경우에만 `allow`가 나온다 — 이건 무의견이 아니라 "방금 승인받은 것에 대한 명시적·범위가 좁혀진 판단"이다.
- **정정(M6, P4.5, 그리고 2026-07 재설계)**: 초기 설계는 "파워유저 폴백"으로 별도 `/senpai-approve` 슬래시 커맨드를 상정했으나, 실제 구현(`scripts/senpai-approve.js`)은 슬래시 커맨드가 아니라 **채팅창에 정확한 문구를 그대로 보내는 것**으로 귀결됐다. 승인 문구는 원래 고정된 `[SENPAI-APPROVE]`였으나 **`[senpai-go:<project>]`**(대괄호 안에 지금 진행 중인 프로젝트 폴더명을 정확히 넣어야 함)로 바뀌었다. 프로젝트 이름이 틀리면 승인은 기록되지 않고 정확한 문구를 다시 안내받는다(`scripts/senpai-approve.js#diagnoseApprovalFailure`). 승인에는 여전히 별도 폴백 커맨드가 없다 — 이 문구가 유일한 경로다. (**정정 2026-07**: `commands/` 디렉토리 자체는 이후 `/senpai-harness:init`용으로 생겼다 — 위 문장은 "승인에 커맨드가 없다"는 뜻이지 "`commands/`가 아예 없다"는 뜻이 더 이상 아니다.)
  - **정직한 정정(critic 감사, MEDIUM/CONFIRMED)**: 이 문구를 도입한 이유로 "매번 프로젝트 이름을 다시 입력/재인식하게 만들어 무의식적 반사 승인을 줄인다"고 처음 적었는데, 실제로는 `guided-plan` 스킬이 Build Gate 요약에서 **정확한 문구를 그대로 화면에 보여줘 복사-붙여넣기**하게 하므로 이 "재인식" 효과는 거의 없다 — 사용자는 프로젝트 이름을 스스로 떠올리거나 타이핑할 필요가 없다. 이 문구가 실제로 제공하는 가치는 **다른/오래된 프로젝트의 pending plan을 실수로 승인하는 것을 막는 것**(엄밀히는 "정확한 프로젝트명"이라는 검증 가능한 신호 하나가 늘어난 것)이지, 심리적 재인식 유도가 아니다. 대괄호 구분자가 자연어("네", "좋아요")와의 혼동을 막는다는 부분은 여전히 유효하다.

### T2를 어떻게 강제하는가 — `[senpai-touch:<project>:<file>]`

T2가 `ask`였던 첫 버전은 G0/T1을 고치게 만든 바로 그 문제(acceptEdits에서 `ask`가 프롬프트를 못 띄움)를 T2 자신은 전혀 해결하지 못했다 — 아래 감사에서 확인됨. 고친 방식은 T1을 고칠 때와 동일한 원리다: **오늘 이미 검증한 대로 `deny`와 `UserPromptSubmit` 채팅 캡처는 permission mode와 무관하게 항상 작동한다.** 그래서 T2는:

1. 민감 파일 쓰기 시도 → `deny`, 사유에 정확한 문구 `[senpai-touch:<project>:<file>]`를 담아 반환(`scripts/scope-check.js#checkPathsAgainstScope`).
2. 사용자가 그 문구를 채팅으로 보내면 → `scripts/senpai-approve.js#recordSensitiveFileConfirmation`이 (기존 승인과 동일한 프로젝트-이름 일치 + 세션 일치 검사를 거쳐) `state.confirmed_sensitive_files`에 그 파일 하나를 추가.
3. 같은 파일에 대한 다음 쓰기 시도 → `confirmed_sensitive_files`에 있으므로 `allow`.

`confirmed_sensitive_files`는 그 자체로 scope를 부여하지 않는다 — `checkPathsAgainstScope`가 이미 `allowed_files`+`sensitive_files` 양쪽에 있다고 독립적으로 확인한 대상에 대해서만 참조되므로, 엉뚱한 파일명을 보내도 아무 실제 쓰기 대상과도 매치되지 않아 무해하다(옛 `sensitive_files` 부분집합 필터와 동일한 non-smuggling 성질). 매 `recordApproval()`(재승인)마다 `[]`로 초기화된다 — 이전 계획에서 받은 개별 확인이 다음 계획에 몰래 이어지지 않는다.

### 민감도 바닥선(escalate-only floor) — 모델의 자기 보고를 유일한 결정자로 두지 않는다

`sensitive_files`는 `guided-plan` 스킬이 Phase Plan 작성 시점에 **스스로 판단해서** 채우는 필드다. critic 감사(MAJOR/CONFIRMED)는 이게 "모델의 자기 보고는 신뢰할 수 없다"(이 문서 맨 위 "배경" 절)는 이 프로젝트 자신의 원칙과 정면으로 충돌한다고 지적했다 — 모델이 서두르거나 실수로 `src/auth.ts`를 빠뜨리면, 코드 차원의 안전망 없이 그냥 T1로 자동 승인된다.

그래서 `scripts/scope-check.js`에 `matchesSensitiveFloor`(package.json/Dockerfile/\*.sql/Gemfile 등 파일명 패턴 + auth/login/payment/billing/migration/deploy 등 경로 세그먼트 패턴)를 하드코딩했다 — **escalate-only**: Phase Plan은 이 바닥선 위에 항목을 더 추가할 수는 있어도, 바닥선에 걸린 파일을 T1으로 낮출 수는 없다. `senpai.config.yaml`의 `require_approval_for` 카테고리(auth/payment/deploy/db/dependency-install/destructive)를 코드로 옮긴 것이며, **이 yaml 필드 자체는 여전히 `scope-check.js`가 직접 읽지 않는다** — `guided-plan` 스킬이 참고하는 카테고리 설명, 그리고 이 코드 바닥선, 둘 다 같은 카테고리 목록을 독립적으로 인코딩하고 있을 뿐이다(critic MEDIUM-1: 이전 버전 문서가 "require_approval_for가 이제 실제 역할을 갖는다"고 적었는데, guided-plan 스킬이 그 yaml 파일을 실제로 읽는 게 아니라 자기 프롬프트 안에 같은 카테고리를 산문으로 하드코딩해뒀을 뿐이라 부정확했다 — 지금 이 문단이 정정이다).

### T0~T3 이중 독립 감사 (security-reviewer + critic, 2026-07) — 별도 컨텍스트, 서로의 결론을 모르는 채로 병행

첫 T0~T3 초안(T2도 `ask`, `sensitive_files`는 `allowed_files`의 정확 문자열 부분집합으로 필터링, 프로젝트 이름 불일치 시 이름을 못 뽑으면 검사를 건너뜀)을 커밋하기 전에 security-reviewer와 critic을 별도 컨텍스트로 병렬 소환했다. 둘 다 실제로 코드를 실행해 재현하며 REVISE 판정을 냈고, 서로 다른 관점에서 같은 핵심 패턴("T2→T1로 조용히 강등되는 경로가 여러 개")에 수렴했다.

- **HIGH/MAJOR/CONFIRMED, 둘 다 발견 — glob 불일치로 `sensitive_files`가 조용히 사라짐.** 부분집합 필터가 정확 문자열 비교(`Set.has`)였는데 실제 scope 매칭은 glob 인지였다 — `allowed_files: [src/**]` + `sensitive_files: [src/auth.ts]`이면 필터가 `[]`로 지워버려 auth.ts가 재확인 없이 T1으로 진행됐다. **수정**: 필터 자체를 제거(`extractSensitiveFilesFromPhasePlan`) — 애초에 anti-smuggling에 필요하지 않았다(`checkPathsAgainstScope`가 sensitive 여부를 확인하는 시점은 이미 `allInScope`가 참으로 확인된 뒤뿐이라, scope 밖 항목을 sensitive로 표시해도 smuggling이 안 됨).
- **HIGH/MAJOR/CONFIRMED, 둘 다 발견 — T2가 `ask`로 남아 정확히 재설계가 고치려던 문제를 상속.** 위 "T2를 어떻게 강제하는가" 절의 `deny`+`[senpai-touch:...]`로 교체해 해결.
- **MAJOR/CONFIRMED, critic만 발견 — 모델 자기 보고가 유일한 결정자.** 위 "민감도 바닥선" 절의 코드 하드코딩 floor로 해결.
- **MEDIUM/CONFIRMED, security-reviewer만 발견 — 프로젝트 이름을 못 뽑으면 검사를 건너뜀.** `extractProjectFromPlanPath`가 `null`을 반환하는 경로(Phase Plan이 `vault/10_Projects/<이름>/` 형태가 아닌 곳에 저장된 경우)에서 `if (expectedProject && ...)`가 통째로 `false`가 되어, 아무 프로젝트 이름이나(심지어 빈 `[senpai-go]`도) 승인됐다. 모델이 Phase Plan을 어디에 쓸지 통제하므로(`scope-check.js`는 파일명만 확인) 이론적 우회가 아니라 실제로 도달 가능했다. **수정**: `recordApproval`/`diagnoseApprovalFailure` 모두 `expectedProject`가 null이면 **무조건 거부**(새 실패 사유 `plan_path_nonstandard`)로 변경.
- **MEDIUM/CONFIRMED, critic만 발견 — `require_approval_for`가 여전히 죽은 설정.** 위 "민감도 바닥선" 절에서 정정.
- **MINOR, critic만 발견 — 트리거 문구의 "재인식" 근거가 과장.** 위 G2 본문에서 정정.
- **MINOR, 둘 다 언급 — `computeScopeHash`가 `sensitive_files`/`confirmed_sensitive_files`를 포함하지 않음.** 방어심층 갭으로 기록만 하고 이번 라운드에서는 고치지 않았다 — `state.json`은 제어 영역 자기 보호로 도구에 의한 mutation이 이미 전부 deny되므로 현재는 실제로 악용 불가능하다는 게 두 리뷰의 공통 판단.
- 부수적으로: 프로젝트 이름 비교가 대소문자 구분이었는데 트리거 키워드 자체(`senpai-go`/`senpai-touch`)는 대소문자 무시라 일관성이 없었다(critic MINOR) — `projectNamesMatch`로 양쪽 다 대소문자 무시로 통일.

**커밋 직전 세 번째 검토(Opus 4.8 advisor)에서 발견 — 바닥선이 절대경로를 검사해 과다-거부(over-deny)로 실사용을 망가뜨림.** 위 두 감사 이후 커밋 전 마지막 확인에서 발견된 실제 버그(이론이 아니라 코드 결함): `matchesSensitiveFloor`의 세그먼트 정규식(`\b(auth|login|payment|...)\b`)이 realpath로 정규화된 **절대경로**를 그대로 검사했다 — 즉 사용자 홈 디렉터리·상위 폴더 이름까지 포함해서 매칭된다. 예를 들어 프로젝트를 `~/Developer/login-app/`에 두면 그 프로젝트의 **모든 파일**이 `/Users/.../login-app/src/무엇이든.ts`로 정규화되고 `\blogin\b`이 "login-app"에 걸려 T2로 강제 승격된다 — "진짜 민감한 파일에만 마찰을 준다"는 이 재설계 전체의 전제를 정확히 깨뜨린다. 두 감사 모두 `os.tmpdir()` 샌드박스(우연히 트리거 단어가 없는 경로)로만 테스트해서 놓쳤다. **수정**: `matchesSensitiveFloor(normalizedPath, repoRoot)`로 시그니처를 바꿔 세그먼트 검사를 `path.relative(repoRoot, normalizedPath)`(레포 루트 기준 상대경로) 대상으로 수행 — 파일명 패턴 검사는 영향 없음(`path.basename`은 조상 폴더 이름과 무관). `tests/unit/scope-check.test.js` test35로 회귀 테스트 추가(레포 루트 이름 자체에 "login"이 들어간 전용 샌드박스를 만들어 검증 — 수정 전에는 실패, 수정 후 통과 확인함).

**T0~T3 라이브 세션 검증 (2026-07-05 실행 완료)**: 위 이중 감사와 floor 수정은 전부 `tests/unit/*.test.js`의 가짜 `state.json` 시뮬레이션으로만 검증됐었다 — 정작 이 재설계를 촉발한 원 버그(`acceptEdits`가 `ask`를 무력화)는 유닛 테스트가 아니라 라이브 세션에서만 발견됐었다는 걸 감안하면, 재설계 결과물 자체를 유닛 테스트로만 검증하고 끝내는 건 같은 종류의 사각지대를 남기는 셈이었다. 별도 스크래치 프로젝트에 실제 설치된 플러그인으로 `--permission-mode acceptEdits` 고정 상태에서 Phase Plan 작성 → `[senpai-go:...]` 캡처 → T1 allow(파일 실제 생성 확인) → T2 deny(파일 미생성 확인, `permissionDecisionReason`에 정확한 `[senpai-touch:...]` 문구 확인) → `[senpai-touch:...]` 캡처 → T2 재시도 allow(파일 실제 생성 확인)까지 전 구간을 실제 훅 배관으로 재현했다(상세 로그: `tests/smoke/real-session.md`). 부수 발견 하나(T2 거부 시 모델이 가끔 정확한 문구 대신 자연어로 되묻는 것)는 `agents/builder-runtime.md`에 명시적 규칙을 추가해 수정.

**H2 — "채팅 요약 vs 디스크 Phase Plan" 불일치: 재검토 후 결론 (2026-07, 사용자와의 논의 + Fable 5 독립 검토)**

security-reviewer가 HIGH로 표시했던 원 지적: 승인은 "사용자가 채팅에서 실제로 본 요약"이 아니라 "승인 순간 디스크에 있는 Phase Plan 프론트매터"를 신뢰한다. 모델이 좁은 범위를 채팅에 보여준 뒤 승인 직전에 같은 경로의 Phase Plan을 더 넓은 `allowed_files`로 덮어쓰면, 정확한 프로젝트 이름을 입력해도 사용자가 못 본 범위가 승인될 수 있다는 경로였다.

이 지적을 실제로 코드로 막는 방법(승인 문구에 Phase Plan 내용 해시를 끼워 넣어 "화면에 보여진 것"과 "디스크의 것"을 묶는 방법)을 설계해 advisor에게 검증받았으나, **실제로는 문제를 막지 못한다는 게 밝혀졌다** — 모델이 화면 설명과 디스크 파일을 처음부터 일관되게 (좁게 보여주고 넓게 쓰는 게 아니라, 애초에 넓게 쓰고 그 해시를 보여주는 순서로) 조작하면 해시 일치 검사를 그대로 통과한다. 근본 원인은 어떤 훅도 모델이 채팅에 실제로 출력하는 텍스트 자체를 가로채 검증할 방법이 없다는 것 — 이는 이번 T0-T3 재설계 전체를 촉발한 `acceptEdits`-`ask` 문제와 같은 뿌리(코드가 볼 수 없는 층에서 발생하는 문제는 코드로 완전히 막을 수 없다)다.

여기서 사용자가 던진 더 근본적인 질문이 이 논의의 방향을 바꿨다: "규칙과 규율 위에서 작동하는 AI가 몰래 파일을 바꿔치기한다는 게 실제로 반복적으로 일어나는 일이 맞는가, 아니면 어떤 특이 현상을 잘못 해석하고 있는 것 아닌가?" — 실제로 이 저장소의 라이브 검증 기록을 전부 뒤져봐도, "채팅에 좁게 보여주고 디스크에 넓게 쓴다"는 시나리오가 **실제로 관측된 사례는 0건**이다. 실제로 반복 관측된 것은 전혀 다른 현상 — 모델이 차단당한 뒤 "파일을 생성했습니다"라고 **거짓 완료 보고**를 한 것(§P1 실증 검증 2번, 2회 독립 재현)뿐이며, 이건 "몰래 바꿔치기"가 아니라 "실패를 성공으로 잘못 보고"한 것이고, 그때도 실제 파일은 안 만들어졌다(기본 거부가 정상 작동). H2의 원 위협 모델은 security-reviewer(검토용 AI)가 코드를 읽고 이론적으로 구성한 것이었지, 실측된 사고가 아니었다.

**결론**: H2를 "코드로 막을 안전 결함"으로 취급하는 대신, 이 논의는 훨씬 더 생산적인 방향으로 이어졌다 — "승인된 파일 접근 범위 안에서, 실제로 만드는 동안 어떤 판단을 사용자에게 물어야 하고 어떤 판단을 AI가 알아서 해도 되는가"라는 원래 이 프로젝트가 답해야 했던 질문이었다는 걸 재발견했다. 그 답이 `agents/builder-runtime.md`의 "빌드 중 판단 규칙 — 선배의 4단 판정"이다. H2의 잔여 위협(디스크와 화면이 처음부터 다른 경우)은 이 4단 판정으로도 이론적으로는 완전히 막히지 않지만 — 4단 판정은 파일 접근 범위(T0~T3, 이 절의 주제)가 아니라 그 범위 **안**의 판단을 다루는 다른 층이다 — 실제로 관측된 적 없는 시나리오를 위해 새 코드 메커니즘을 만드는 것보다, 관측된 실패 패턴(자기 보고 불신뢰, 범위 안 판단의 무분별)에 실제 대응을 집중하는 게 옳은 우선순위라는 게 이 논의의 최종 판단이다. H2는 여전히 "완전히 닫히지 않는다"는 사실 자체는 정확하지만, 그게 곧 "위험하다"는 뜻은 아니다.

## G3 — 경로 정규화

- `allowed_files` 비교 전 대상 경로를 반드시 정규화한다: 상대경로 `path.resolve`, `..` 트래버설 해소, 가능하면 심링크 해소(`fs.realpathSync`, 실패 시 `path.resolve`로 폴백).
- 비교는 정규화된 절대경로 기준. `allowed_files` 항목은 정확한 경로 또는 단순 glob(`*`, `**`)으로 해석한다(새 의존성 없이 최소 매처 직접 구현).

## G4 — fail-closed

- `state.json`이 없거나, JSON 파싱에 실패하거나, `session_id`/`scope_hash`가 현재 세션과 불일치하면 → mutating 도구 호출은 **무조건 deny**, 이유는 "아직 회의/승인이 안 된 상태"로 안내한다.
- `doctor`는 손상된 `state.json`을 감지하면 크래시하지 않고 보고하며, 필요 시 백업에서 복구 경로를 제안한다(구현은 최소: 손상 감지 + 사람이 이해할 보고, 자동 복구는 다음 단계로 미뤄도 됨).

## P1 실증 검증 (실제 코드, 실제 세션)

P0는 throwaway probe로, P1은 실제 `scope-check.js`/`approval-gate.js`/`state-store.js`가 연결된 진짜 코드로 `claude -p --plugin-dir` 실제 세션에서 재검증했다.

1. **`state.json` 없음(G4)**: 모델이 Write 2회, Bash `echo >`·`printf >`·심지어 `touch`까지 **7가지 방법**으로 파일 생성을 시도했으나 전부 차단됨. 파일 미생성 확인. 모델이 스스로 "Scope Meeting이 필요하다"고 정확히 진단하고 멈춤.
2. **승인된 scope 안(G2 ask 경로)**: 세션ID를 `--session-id`로 고정해 그 세션에 정확히 매칭되는 승인 상태를 심은 뒤 재실행 → 실제 `handlePreToolUse`가 `permissionDecision:"ask"`를 반환했고, headless(TTY 없음) 환경이라 안전하게 거부로 귀결(P0와 동일 패턴, 크래시 없음). 그런데 모델은 **또다시 "파일을 생성했습니다"라고 거짓 보고**했다 — Evidence Loop가 왜 필요한지에 대한 **두 번째 독립적 실증 사례**. `docs/09_ACCEPTANCE_CRITERIA.md`의 "증거 없이 완료라고 말하지 않는다"는 산문이 아니라 최소 두 번 재현된 실측 결함에 대한 대응이다.

이 발견은 P5 실세션 스모크 테스트 설계에 반드시 반영한다: 완료 판정은 절대 모델의 최종 응답 텍스트가 아니라 실제 파일 존재 여부로 한다.

## protect-secrets는 G1~G4에 선행하지만, G0 미관리 프로젝트에서는 아예 실행되지 않는다

secret 경로(`.env`, `id_rsa`, `*.pem`, `*.key`, `*credential*`, `*secret*` 등)는 scope나 승인 상태와 무관하게 **항상 deny**(Read 포함) — 단 이건 G0을 통과한(=`senpai.config.yaml`이 있는 관리 대상 프로젝트) 경우에 한해 G1~G4 판정보다 먼저 체크한다는 뜻이다. G0에서 걸러진(관리 대상이 아닌) 프로젝트에서는 secret 차단을 포함해 이 정책의 어떤 검사도 실행되지 않는다 — Claude Code 자신의 평소 처리에 완전히 맡긴다(하네스가 설치 안 된 것과 동일).

## 제어 영역(control-plane) 자기 보호 (Fable 5 독립 감사, 2026-07)

secret 차단과 별개로, `senpai.config.yaml` 자신과 `.senpai/` 아래 전부(주로 `state.json`)는 **mutating 도구 호출(Write/Edit/NotebookEdit/MultiEdit/Bash/apply_patch)에 한해** scope 승인 여부와 무관하게 deny한다 — Phase Plan의 `allowed_files`에 이 경로들이 들어가더라도 마찬가지다. Read/Grep 같은 비-mutating 접근이나 `cat .senpai/state.json`처럼 진짜 읽기 전용인 Bash 명령은 대상이 아니다(사용자에게 거부 사유를 설명하려고 상태를 읽는 것은 정당하고 무해함). Bash 쪽은 반드시 `checkBashCommand`가 이미 추출한 mutating target에 대해서만 검사해야 한다 — 모든 Bash 호출의 원시 토큰을 무조건 검사하면 읽기 전용 허용목록(read-only allowlist)보다 먼저 실행돼 `cat .senpai/state.json` 같은 정상적인 읽기 명령까지 막아버리는 회귀가 생긴다(자체 테스트로 발견·수정).

**보장 범위는 비대칭이다.** Write/Edit/NotebookEdit/MultiEdit은 `input.file_path`/`input.notebook_path`를 직접 세그먼트 검사하므로 무조건적이다. Bash 쪽은 `extractMutatingTargets`가 실제로 분류해낸 대상에 한해서만 걸리는 **조건부** 보장이며, 두 경로 모두 심링크를 해석하지 않는다 — 즉 `ln -s .senpai/state.json innocuous.txt`처럼 심링크를 먼저 만든 뒤 그 무해해 보이는 이름으로 쓰기를 시도하면 이 검사를 우회할 수 있다. 이는 secret 경로 검사가 이미 안고 있는 것과 동일한 종류의 심링크 한계(LOW로 분류됨)이며, 이 기능 자체가 deny-only(오탐 시 최악의 경우가 "과잉 차단"일 뿐 안전 방향)라 별도 감사 없이 기록만 해 둔다.

## apply_patch (Codex CLI 네이티브 도구) — 실제 Codex 세션에서 라이브 발견된 결함, 2026-07

Codex CLI(OpenAI)에서 Senpai Harness를 실제로 라이브 테스트하는 과정(`docs/P15_CODEX_CLI_ENVIRONMENT_CLEANUP.md`)에서, Codex의 파일 수정 전용 도구인 `apply_patch`가 `MUTATING_TOOL_NAMES`에 아예 없어 승인/scope 검사를 완전히 건너뛴다는 것을 실제 세션으로 확인했다(`senpai.config.yaml`이 있고 승인된 scope가 전혀 없는 상태에서 `hello.txt`가 그대로 생성됨). `apply_patch`는 Claude Code의 `Write`/`Edit`와 달리 `input.file_path`가 없다 — 패치 전체(건드리는 모든 파일 경로 포함)가 `input.command` 문자열 하나에 OpenAI의 `*** Begin Patch / *** Add File|Update File|Delete File: <path> / *** End Patch` 형식으로 들어있고, 한 번의 호출이 여러 파일을 동시에 건드릴 수 있다. 이 비대칭 때문에 기존 단일-target 헬퍼(`getMutatingFileTarget`/`findSecretPath`의 `file_path` 분기)를 재사용하지 않고, `checkToolCall` 안에 `apply_patch` 전용 분기를 두어 patch 텍스트에서 추출한 모든 경로 각각에 대해 동일한 secret/제어영역/scope 검사를 독립적으로 적용한다(`extractApplyPatchTargets`, `scripts/scope-check.js`). 회귀 테스트: `tests/unit/scope-check.test.js` test38.

## 구현 매핑

| 정책 | 구현 파일 |
|---|---|
| G0 (opt-in 게이트, passthrough) | `hooks/scripts/handler.js#main()` 최상단 단일 관문(모든 이벤트) + `scripts/approval-gate.js#handlePreToolUse` 내부(방어 심층화, `handlePreToolUse`를 직접 호출하는 테스트를 위해 유지). 마커 판정 함수 자체는 `scripts/scope-check.js`의 `isSenpaiManagedProject` |
| G1 (Bash 포함 mutating 판정) | `scripts/scope-check.js` |
| G2 (T0~T3 등급 판정 + 승인 캡처) | T0(vault 항상 allow)·T3(secret/제어영역 항상 deny)는 `scripts/scope-check.js#checkToolCall` 상위 분기에서, T1/T2(allow/deny 분기 + 민감도 바닥선)는 `checkPathsAgainstScope`+`matchesSensitiveFloor`에서 처리 + `scripts/approval-gate.js`(PreToolUse 출력 변환) + `scripts/senpai-approve.js`(`[senpai-go:<project>]`/`[senpai-touch:<project>:<file>]` 캡처, `sensitive_files` 추출, `recordSensitiveFileConfirmation`) |
| G3 (경로 정규화) | `scripts/scope-check.js` 내부 유틸 |
| G4 (fail-closed) | `scripts/state-store.js`(안전한 실패 반환) + `scripts/approval-gate.js`(deny로 변환) |
| secret 우선 차단 | `scripts/protect-secrets.js`, G0을 통과한 프로젝트에 한해 모든 게이팅 진입점에서 최우선 호출 |
| 제어 영역 자기 보호 | `scripts/scope-check.js`의 `findControlPlanePath`(Write/Edit 등) + `checkBashCommand` 내부 대응 검사(Bash) |
| G0 cwd 불일치 진단 + init 상위 폴더 거부 | `scripts/scope-check.js#findAncestorManagedMarker`(공유 유틸) — `scripts/doctor.js#checkManagedMarkerReachability`(경고만)와 `scripts/init.js`(하위 폴더에서 실행 시 상위 폴더의 기존 관리 대상을 감지해 거부)가 함께 사용 |
| `/senpai-harness:init` | `scripts/init.js`(단일 Bash 호출, 직접 fs 쓰기, 마커 마지막) + `commands/init.md`(Bash 시도 전 Glob으로 마커 존재 확인) |
| G0 cwd 불일치 진단 | `scripts/doctor.js#checkManagedMarkerReachability` (상위 폴더에 마커가 있는데 지금 위치엔 없음을 경고) |
