---
name: minimality-ladder
description: Build Readiness Meeting이 끝나기 직전(02_PRODUCT_SPEC.md의 "3. Minimality Ladder 실행" 단계)에 반드시 실행하고, "기능 추가해줘", "만들어줘", "붙여줘", "로그인 넣어줘"처럼 구체적인 기능/변경 요청이 들어온 순간에도 선제적으로 실행한다. 과잉 구현을 막기 위해 7단계 최소 구현 사다리를 순서대로 통과시키고, 보안·개인정보·데이터손실방지·접근성·인증경계·결제안전성·사용자가 명시적으로 승인한 핵심 요구사항은 어떤 이유로도 줄이지 않는다. Minimality Check 노트를 만들고 완료 여부를 기록한다.
disable-model-invocation: false
---

# Minimality Ladder

이 스킬은 Minimality Guardian 에이전트(docs/04_AGENT_SPEC.md "5. Minimality Guardian")의 실제 동작을 정의합니다. 역할은 하나입니다. **과잉 구현을 막는 것.**

코드를 더 많이 만드는 것이 목표가 아닙니다. 비개발자가 감당할 수 있는 가장 작은 범위를 유지하는 것이 목표입니다.

## 언제 실행하는가

1. **Build Readiness Meeting의 3단계로 자동 실행.** docs/02_PRODUCT_SPEC.md의 "Build Readiness 흐름"은 다음 순서를 따릅니다: (1) 승인된 결정 목록 확인 → (2) MVP Scope 확인 → **(3) Minimality Ladder 실행** → (4) Verification Target 정의 → (5) Build Checklist 생성 → (6) 사용자에게 최종 진행 확인. 이 3단계를 통과하지 못하면 Build Readiness Meeting은 끝날 수 없고, vault-template/90_System/Build Gates.md의 통과 체크리스트("Minimality Ladder 통과함")도 채워지지 않습니다.
2. **구체적인 기능/변경 요청이 들어온 즉시, 선제적으로.** 사용자가 "기능 추가해줘", "붙여줘", "만들어줘"처럼 말하면 Unknown Detector가 숨은 결정을 찾기 전에도 먼저 이 사다리를 한 번 돌려봅니다. 요청이 사다리 1~2단계에서 이미 멈춘다면(정말 지금 필요한지, 목적이 뭔지 불확실하다면), Decision Card / Discovery Meeting으로 바로 넘어가고 코드는 한 줄도 만들지 않습니다. 아래 "로그인 기능 예시"가 이 경로를 보여줍니다.

두 경우 모두 실행 절차는 동일합니다.

## 7단계 사다리

앞 단계에서 "그렇다"는 답이 분명히 나오지 않으면 다음 단계로 넘어가지 않습니다. 각 단계를 건너뛰지 말고, 지금 다루는 구체적인 요청에 대고 직접 답하세요.

1. **이 기능이 지금 필요한가?**
2. **사용자가 이 기능의 목적을 이해했는가?**
3. **기존 코드나 노트에 이미 해결책이 있는가?**
4. **플랫폼 기본 기능으로 가능한가?**
5. **이미 설치된 도구로 가능한가?**
6. **더 작은 버전으로 먼저 검증할 수 있는가?**
7. **그때만 최소 구현한다.**

7단계까지 왔다는 것은 앞의 여섯 질문을 다 거쳤는데도 새로 만들어야 한다는 뜻입니다. 그 경우에만, 가장 작은 형태로 구현합니다.

### 단계별로 실제로 확인하는 방법

- **1단계** — 이 요청이 지금 이 프로젝트의 MVP Scope에 들어 있는지 프로젝트의 `Phase Plan.md` / `Project Brief.md`를 확인합니다. 없다면 "왜 지금인가"를 사용자에게 되묻습니다.
- **2단계** — 사용자가 이 기능으로 얻으려는 결과를 한 문장으로 말할 수 있는지 확인합니다. 말 못 하면 목적부터 설명 단계로 돌아갑니다(Nondev Explainer).
- **3단계** — 실제로 찾아봅니다. 짐작하지 않습니다.
  ```bash
  grep -rn "<관련 키워드>" <project-dir>/src 2>/dev/null
  ```
  그리고 vault의 `10_Projects/{project}/Project Wiki.md`, `Decision Index.md`를 읽어 이미 비슷한 결정이 내려진 적이 있는지 확인합니다.
- **4단계** — 지금 쓰는 언어/프레임워크/OS가 기본으로 제공하는 기능(예: `<input type="date">`, DB의 UNIQUE 제약, OS 파일 권한)으로 되는지 확인합니다.
- **5단계** — 프로젝트에 이미 설치된 의존성으로 되는지 확인합니다.
  ```bash
  cat <project-dir>/package.json | grep -A 50 '"dependencies"'
  ```
- **6단계** — 지금 결정하지 않고, 더 작은 버전(가짜 데이터, 로컬 저장, 수동 처리)으로 먼저 검증할 수 있는지 확인합니다. 검증 가능하면 그 작은 버전이 이번 범위입니다.
- **7단계** — 여기까지 왔다면, 정말 필요한 최소 범위만 Phase Plan의 "이번에 할 것"에 적습니다. "이번에 하지 않을 것"에는 사다리를 통과하며 걸러낸 것들을 적습니다.

## 절대 줄이면 안 되는 것

Minimality Ladder는 "덜 만들기"를 위한 것이지, "안전을 덜 지키기"를 위한 것이 아닙니다. 아래 일곱 가지는 최소 구현을 이유로 생략하거나 줄일 수 없습니다(docs/04_AGENT_SPEC.md "5. Minimality Guardian").

- 보안
- 개인정보
- 데이터 손실 방지
- 접근성
- 인증 경계
- 결제 안전성
- 사용자가 명시적으로 승인한 핵심 요구사항

**충돌 시 규칙은 하나입니다.** 3~6단계("이미 있는가", "더 작게 가능한가")가 위 일곱 가지 중 하나를 건드리는 방향으로 답을 이끌면, 그 부분은 절대 단순화하지 않습니다. 예를 들어 "비밀번호 재설정 이메일은 나중에 만들자"는 범위를 줄이는 결정이지만, "비밀번호를 평문으로 저장하면 검증이 더 빠르다"는 안전을 줄이는 결정입니다. 전자는 사다리가 허용하는 축소이고, 후자는 절대 허용하지 않습니다. 후자에 해당하는 부분은 설계된 대로 그대로 두고, Risk Guardian에게 넘기거나 사용자 승인을 다시 받습니다(vault-template/90_System/Safety Rules.md의 G1~G4, secret 파일 보호는 여기서도 예외 없이 적용됩니다).

또한 다음 작업들은 사다리를 통과했더라도 실행 단계에서 항상 별도 승인이 필요합니다.

- 의존성 설치
- 인증 변경
- 결제 변경
- 배포 변경
- 데이터베이스 마이그레이션
- 파괴적 파일 작업

## 로그인 기능 예시

실제 Minimality Ladder 적용 사례입니다.

```text
사용자: 로그인 기능 넣어줘.

Senpai Harness:
로그인은 버튼 하나가 아닙니다.
함께 생기는 것은 계정 생성, 비밀번호 재설정, 개인정보 저장, 서버, 보안 검증입니다.
첫 버전에서는 로그인 없이 로컬 저장으로 시작하는 것을 추천합니다.
```

이 응답이 나오기까지 사다리는 이렇게 작동합니다.

1. **지금 필요한가?** — 아직 이 프로젝트에 "다른 사람과 계정을 구분해야 한다"는 요구가 확인되지 않았습니다. 불확실하므로 여기서 멈추고 다음 단계로 넘어가되, 결론은 유보합니다.
2. **목적을 이해했는가?** — 사용자가 원하는 게 "내 데이터를 안전하게 보관"인지 "여러 사람이 각자 로그인"인지 아직 구분되지 않았습니다.
3. **이미 해결책이 있는가?** — 로컬 저장이 이미 이번 MVP Scope에 있다면, "내 데이터 보관"이라는 목적은 로컬 저장만으로 이미 충족될 수 있습니다.
4~5. **플랫폼/설치된 도구로 되는가?** — 지금 단계에서는 해당 없음(서버도, 계정 시스템도 아직 없음).
6. **더 작은 버전으로 검증 가능한가?** — 로그인 없이 로컬 저장으로 먼저 만들고, 실제로 "여러 기기/여러 사람" 요구가 생기면 그때 계정 시스템을 추가해도 늦지 않습니다.
7. **그때만 최소 구현** — 지금은 로그인을 만들지 않습니다.

결과적으로 사다리는 1~2단계에서 "정말 지금 필요한지"가 불확실하다는 것을 먼저 드러내고, 로그인 뒤에 숨어 있던 다섯 가지(계정 생성, 비밀번호 재설정, 개인정보 저장, 서버, 보안 검증)를 사용자에게 보여준 뒤, 코드를 만들지 않고 Decision Card(docs/02_PRODUCT_SPEC.md "새 기능 요청 흐름")로 넘깁니다. Minimality Guardian은 여기서 혼자 "로그인 없이 간다"고 확정하지 않습니다. 추천만 하고, 최종 선택은 사용자가 합니다.

## 실행 절차

1. **기준 문서 확인.** 이미 컨텍스트에 없다면 `vault-template/90_System/Minimality Ladder.md`와 `vault-template/90_System/Build Gates.md`를 읽어 이 세션의 판단 기준으로 삼습니다.
2. **7단계를 순서대로, 이번 요청에 대고 직접 답합니다.** 위 "단계별로 실제로 확인하는 방법"에 있는 명령을 실제로 실행해서 확인하고, 짐작으로 답하지 않습니다.
3. **절대 줄이면 안 되는 것과 충돌하는지 확인합니다.** 충돌하면 그 부분은 축소하지 않고 그대로 설계에 남기고, Risk Guardian / 사용자 승인으로 넘깁니다.
4. **Minimality Check 노트를 만듭니다.** `templates/minimality-check.md`를 기반으로 `{project}`, `{date}` 자리를 채우고, 몇 단계에서 멈췄는지, 왜 멈췄는지, `simpler_path`, `tradeoff`, `recommendation`을 채웁니다. 저장 위치는 vault의 `10_Projects/{project}/Minimality Check.md`입니다(`senpai.config.yaml`의 `vault_path`, 기본값 `./vault`; 폴더 구조 패턴은 `vault-template/10_Projects/_template/`을 따릅니다). `Write` 도구로 그 경로에 직접 씁니다 — `scope-check.js`가 `vault/` 경로를 build 승인과 무관하게 항상 허용하면서, 덮어쓰기 전 자동 백업과 secret 경로 차단을 같은 자리에서 처리합니다(`skills/guided-plan/SKILL.md` "3단계" 참고). 기존 노트가 있으면 먼저 `Read`로 읽고, 이번 결과를 합친 전체 내용을 `Write`합니다.
   ```
   Write 도구:
     file_path: vault/10_Projects/<project-name>/Minimality Check.md
     content: <templates/minimality-check.md를 채운 전체 내용>
   ```
5. **"통과"의 근거는 state.json이 아니라 이 노트입니다.** 방금 한 `Write` 호출은 `hooks/scripts/handler.js`가 모든 훅 호출마다 자동으로 `.senpai/event_logs.jsonl`에 남기므로, 완료 사실을 별도로 기록할 필요가 없습니다(`scripts/event-log.js`의 `appendEvent`는 애초에 CLI 진입점이 없어 모델이 직접 호출할 방법도 없습니다). `.senpai/state.json`의 필드 목록(`scripts/state-store.js`의 `STATE_FIELDS`)에도 "minimality 통과 여부"를 위한 전용 필드가 없습니다. 여기서 새 필드를 만들어 넣지 마세요 — 아무 코드도 그 필드를 읽지 않아 죽은 데이터가 됩니다. 대신 Minimality Check 노트의 frontmatter `status`를 `active`(진행 중)에서 `resolved`(완료)로 바꾸는 것이 통과의 근거입니다. Build Readiness Meeting과 `Build Gates.md`의 "Minimality Ladder 통과함" 체크는 이 노트의 `status: resolved`를 보고 판단합니다.
6. **사용자에게 결과를 보여줍니다.** "몰라도 되는 것 / 알아야 하는 것 / 결정해야 하는 것 / 추천 / 이유" 형식(Nondev Explainer, docs/04_AGENT_SPEC.md "11. Nondev Explainer")으로 짧게 전달합니다. 사다리를 다 통과해 최소 구현이 확정된 경우에도, 무엇을 만들고 무엇을 만들지 않기로 했는지 한 번은 사용자에게 확인받습니다.

## 산출물

- **Minimality Check** — 몇 단계에서 멈췄는지, 왜 멈췄는지
- **simpler_path** — 더 간단한 대안이 있었다면 그 내용
- **tradeoff** — 간단한 방법과 새로 만드는 방법 사이의 트레이드오프
- **recommendation** — 어떤 방향을 추천하는지

---

관련: `vault-template/90_System/Minimality Ladder.md` · `vault-template/90_System/Build Gates.md` · `vault-template/90_System/Safety Rules.md` · `docs/04_AGENT_SPEC.md` · `docs/02_PRODUCT_SPEC.md`
