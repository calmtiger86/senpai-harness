---
type: system_reference
status: active
updated: "{date}"
---

# Build Gates

Build Gate는 Builder가 실제로 코드를 만들기 시작하기 전에 반드시 통과해야 하는 관문입니다. 아래 조건이 모두 충족되지 않으면, Builder는 작업을 시작할 수 없고 Build Readiness Meeting이나 이전 회의로 돌아갑니다.

이 체크리스트는 PreToolUse Hook과 Build Readiness Meeting이 함께 확인합니다.

## 통과 체크리스트

- [ ] **Phase Plan.md 실제 저장됨** — `Write` 도구로 `vault/10_Projects/{project}/Phase Plan.md`가 이번 세션에서 이미 디스크에 저장되어 있는가. **이 조건이 채워지기 전에는 사용자에게 `[senpai-go:...]` 승인 문구를 보여주지 않는다** — 승인 문구를 먼저 보여주고 계획을 나중에 쓰는 순서(또는 승인 실패 후에야 계획을 쓰는 순서)는 금지된다.
- [ ] **Project Brief 존재함** — 이 프로젝트가 무엇을 하려는지 정리한 문서가 있는가
- [ ] **Current State 파악됨** — 지금 프로젝트가 어느 단계에 있는지 알고 있는가
- [ ] **MVP Scope 존재함** — 이번에 만들 것과 만들지 않을 것이 정리되어 있는가
- [ ] **Unknown Map 검토됨** — 숨은 결정을 찾는 과정을 거쳤는가
- [ ] **미해결 결정 0개 (또는 명시적으로 미룬 것)** — 남아있는 결정이 없거나, 있다면 "지금은 미룬다"고 분명히 밝혔는가
- [ ] **사용자 승인 완료** — 사용자가 이 범위로 진행해도 좋다고 확인했는가 (`user_approval == true`)
- [ ] **Minimality Ladder 통과함** — [[Minimality Ladder]]의 7단계를 거쳐 지금 필요한 만큼만 만들기로 했는가
- [ ] **검증 목표 존재함** — 무엇을 확인하면 "완료"라고 부를 수 있는지가 정해져 있는가 (`verification_target_exists == true`)

## 원본 규칙

```yaml
build_gate:
  require:
    - Phase Plan.md written (Write 도구로 실제 저장 완료)
    - Project Brief exists
    - Current State known
    - MVP Scope exists
    - Unknown Map reviewed
    - unresolved_decisions == 0 or explicitly_deferred
    - user_approval == true
    - minimality_ladder_passed == true
    - verification_target_exists == true
```

## 통과하지 못하면 생기는 일

이 중 하나라도 충족되지 않으면, PreToolUse Hook은 코드 수정을 막고 `ask_user_approval` 또는 `open_scope_meeting`으로 되돌립니다. 즉, 조건이 채워지지 않은 채로 구현이 먼저 시작되는 일은 없습니다.

이 관문을 통과한 뒤에도, Builder는 승인된 체크리스트 항목 밖의 작업(계획 밖 기능 추가, 새 의존성 임의 설치, 인증/결제/배포 임의 변경 등)은 할 수 없습니다.

---

관련: [[Meeting Rules]] · [[Minimality Ladder]] · [[Autonomy Contract]]
