# 02. Product Specification

## 제품 동작 원칙

Senpai Harness는 명령어 중심이 아니라 자연어 흐름 중심으로 동작합니다.

사용자는 `/plan`, `/build`, `/check` 같은 명령어를 몰라도 됩니다. 하네스는 사용자의 말에서 의도를 감지하고, 지금 필요한 회의를 자동으로 엽니다.

단, 자동으로 실행하더라도 사용자의 이해와 결정은 생략하지 않습니다.

## 핵심 사용자 흐름

### 1. 자동 체크인 흐름

Trigger:

- 세션 시작
- 사용자가 “이어가자”, “어제 하던 거”, “어디까지 했지?”라고 말함

Steps:

1. 현재 프로젝트 감지
2. Obsidian Vault 감지
3. `Current State.md` 읽기
4. 최근 `Session Memory.md` 읽기
5. 미완료 Decision, Error, Task 확인
6. 사용자에게 “오늘 이어갈 수 있는 작업” 카드 표시

User-facing output:

```md
# 오늘 이어갈 수 있는 작업

지난 세션 요약:
어제는 MVP 범위를 정리했고, 로그인 없이 로컬 저장으로 먼저 가기로 결정했습니다.

현재 단계:
Planning → Build Readiness 직전

남은 결정:
1. 회복 미션 종류를 몇 개로 시작할지
2. 실제 API 연동을 이번 단계에 넣을지

추천:
오늘은 API 연동보다 로컬 화면 흐름부터 만드는 것이 좋습니다.
```

### 2. 새 기능 요청 흐름

Trigger:

- 사용자가 “기능 추가해줘”, “붙여줘”, “만들어줘”라고 말함

Steps:

1. 기능 요청 감지
2. 바로 구현 금지
3. Unknown Detector 실행
4. 숨은 결정과 리스크 추출
5. Decision Card 생성
6. 사용자 선택 대기
7. 사용자가 선택하면 Decision Record 저장
8. Build Readiness Meeting으로 이동

User-facing output:

```md
# 먼저 결정해야 할 것이 있습니다

요청하신 기능:
로그인 기능 추가

겉으로는 버튼 하나처럼 보이지만, 실제로는 아래 결정이 함께 생깁니다.

1. 이메일 로그인인가요, 소셜 로그인인가요?
2. 비밀번호 재설정이 필요한가요?
3. 사용자 정보는 어디에 저장하나요?
4. 첫 MVP에서 꼭 필요한가요?

추천:
첫 버전에서는 로그인 없이 시작하는 것을 추천합니다.

선택해주세요:
A. 로그인 없이 MVP 먼저 만들기
B. 이메일 로그인까지 포함하기
C. 소셜 로그인까지 포함하기
D. 로그인 기능을 더 쉽게 설명해달라고 하기
```

### 3. Build Readiness 흐름

Trigger:

- Decision Card가 해결됨
- 사용자가 구현 진행을 승인함

Steps:

1. 승인된 결정 목록 확인
2. MVP Scope 확인
3. Minimality Ladder 실행
4. Verification Target 정의
5. Build Checklist 생성
6. 사용자에게 최종 진행 확인

User-facing output:

```md
# 이제 만들어도 되는지 확인합니다

이번에 만들 것:
- 온보딩 화면
- 일일 목표 시간 설정
- 로컬 저장

이번에 만들지 않을 것:
- 로그인
- 서버
- 결제
- 배포

확인 방법:
- 빌드 성공
- 설정값 저장
- 앱 재시작 후 값 유지

이 범위로 진행할까요?
```

### 4. Guided Work 흐름

Trigger:

- 사용자가 Build Readiness 범위를 승인함

Steps:

1. Phase Plan 체크리스트 읽기
2. Project Explorer가 기존 코드 확인
3. Builder가 승인된 체크리스트 항목만 구현
4. Code Diagnostics 실행
5. Evidence Reviewer가 완료 증거 확인
6. Memory Librarian이 변경 요약 저장

Policy:

- 계획 밖 작업 금지
- 새 라이브러리 추가 전 승인 필요
- 인증, 결제, 배포, 데이터 삭제는 승인 없이는 금지
- 코드 쓰기는 단일 Writer 원칙 적용

### 5. 오류 해결 흐름

Trigger:

- 사용자가 에러 메시지 제공
- 테스트/빌드 실패 감지

Steps:

1. Error Record 후보 생성
2. 기존 Error Index 검색
3. 반복 오류 여부 판단
4. Debug Council 필요 여부 판단
5. 원인 후보와 확인 순서 제시
6. 수정 실행
7. 검증
8. Error Record 업데이트
9. 반복 3회 이상이면 Playbook 후보 생성

### 6. 검증 흐름

Trigger:

- 사용자가 “다 됐어?”, “확인해줘”라고 말함
- 파일 변경 후 TaskCompleted 발생

Steps:

1. Completion Evidence Board 읽기
2. 필요한 증거 체크
3. 빌드/테스트/파일 확인 수행
4. 부족한 증거 표시
5. 정확한 완료 상태 보고

Allowed completion language:

- 부분 완료
- 구현 완료, 검증 전
- 로컬 기준 완료
- 빌드 기준 완료
- 검증 완료

Forbidden completion language:

- 증거 없이 “완료했습니다”
- 테스트 없이 “문제 없습니다”
- 확인하지 않은 기능을 “작동합니다”라고 단정

### 7. 자동 체크아웃 흐름

Trigger:

- 사용자가 “오늘 여기까지”, “정리하고 끝내자”, “저장해줘”라고 말함
- 세션 종료 이벤트

Steps:

1. 오늘 작업 요약
2. 변경 파일 요약
3. 결정 요약
4. 오류 요약
5. 남은 작업 요약
6. 다음 세션 시작점 저장
7. Obsidian 업데이트

User-facing output:

```md
# 오늘 작업을 정리합니다

완료한 일:
- 설정 화면 초안 생성
- 로컬 저장 방식 결정

아직 남은 일:
- 앱 재시작 후 저장값 유지 확인
- 실제 기기 테스트

다음 세션 시작점:
Completion Evidence Board에서 저장 유지 확인부터 시작하면 됩니다.
```

## 회의 모드

Senpai Harness는 상황에 따라 아래 회의를 자동으로 엽니다.

### Orientation Meeting

처음 프로젝트를 시작하거나 맥락이 불명확할 때 사용합니다.

### Discovery Meeting

사용자가 모르는 숨은 결정이 많을 때 사용합니다.

### Design Meeting

여러 설계 선택지를 비교해야 할 때 사용합니다.

### Scope Meeting

MVP에 넣을 것과 뺄 것을 정할 때 사용합니다.

### Build Readiness Meeting

실제 구현 전에 진행 가능 여부를 확인할 때 사용합니다.

### Review Meeting

구현 결과를 검토하고 다음 방향을 정할 때 사용합니다.

### Checkout Meeting

세션을 정리하고 다음 시작점을 저장할 때 사용합니다.

## 사용자 이해 상태

하네스는 사용자의 이해 상태를 추적합니다.

```yaml
understanding_state:
  unknown: 설명 전
  explained: AI가 설명했지만 확인 전
  user_confirmed: 사용자가 이해를 확인함
  decision_confirmed: 사용자가 선택지를 결정함
  confused: 사용자가 다시 설명 요청
  overloaded: 정보가 많아 범위를 줄여야 함
```

구현 전 요구 조건:

```yaml
before_build:
  require:
    - mvp_scope_exists: true
    - unresolved_decisions: 0
    - understanding_state in [user_confirmed, decision_confirmed]
    - verification_target_exists: true
```
