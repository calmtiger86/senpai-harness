---
name: error-to-playbook
description: 오류가 해결된 직후, 개별 오류 기록(ERR-000N.md)을 만들거나 갱신하고, 같은 오류가 3번째 반복되면 해결 순서를 Playbook(PB-000N.md)으로 승격한다. docs/01_PRD.md 성공 기준 "반복 오류는 Error Record와 Playbook 후보로 정리됩니다"를 실제로 구현하는 스킬. obsidian-brain-update의 Error Index.md 갱신과는 스코프가 다르다 — 그 스킬은 인덱스 표만 관리하고, 개별 ERR 파일 생성/갱신과 Playbook 승격은 이 스킬의 몫이라고 명시하고 있다.
disable-model-invocation: false
---

# Error to Playbook

## 이 스킬의 역할

`docs/02_PRODUCT_SPEC.md`의 "오류 해결 흐름"은 디버깅이 끝난 뒤 "Error Record 업데이트, 반복 3회 이상이면 Playbook 후보 생성"으로 끝납니다. 이 스킬이 그 마지막 단계입니다.

이 스킬은 **원인을 진단하지 않습니다.** 그건 `agents/builder-runtime.md`(Debugger 역할)의 몫입니다. 이 스킬은 디버깅이 **끝난 뒤**, 그 결과를 개별 오류 기록 파일로 남기고, 반복 패턴이 보이면 재사용 가능한 해결 순서로 승격하는 것까지만 합니다.

`skills/obsidian-brain-update/SKILL.md`와 스코프가 겹치지 않습니다:
- `obsidian-brain-update`는 `vault/30_Errors/Error Index.md`(전체 오류를 한눈에 보는 표)만 관리합니다.
- 이 스킬은 `vault/30_Errors/ERR-000N-{slug}.md`(개별 오류 기록 파일 하나하나)와 `vault/40_Playbooks/PB-000N-{slug}.md`(승격된 Playbook)를 관리합니다. `Playbook Index.md`도 이 스킬이 관리합니다.

## 언제 실행하는가

- 디버깅이 끝나고 수정 사항이 검증된 직후(원인을 찾아 고쳤고, 사용자가 "됐다"고 확인했거나 재현 테스트를 통과한 시점).
- `obsidian-brain-update`보다 **먼저** 실행합니다 — 그 스킬의 Error Index 갱신 절차(2단계: "이번 오류의 제목/프로젝트가 기존 행과 일치하면 반복횟수만 1 올립니다")가 참조할 ERR 파일이 이 스킬에서 먼저 만들어지거나 갱신돼 있어야 앞뒤가 맞습니다.
- 아직 원인을 못 찾았거나 수정이 검증 전이면 실행하지 않습니다 — 실패한 시도까지 기록하고 싶다면 "확인 순서"/"원인 후보" 섹션에만 채워 넣고, "실제 원인"/"해결 방법"/"검증 결과"는 비워둔 채로 저장해도 됩니다(다음 세션이 이어받을 수 있게).

## 실행 절차

### 1단계 — 같은 오류인지 판단

`vault/30_Errors/Error Index.md`를 Read로 읽고, 표의 "제목" 칸을 이번 오류의 증상/오류 메시지와 비교합니다. 완전히 같은 문장일 필요는 없습니다 — 같은 원인·같은 증상이면 같은 오류로 취급합니다(예: "로컬 저장값이 사라짐"과 "새로고침하면 설정이 초기화됨"은 같은 버그일 수 있습니다). 애매하면 그 행이 링크하는 `ERR-000N-{slug}.md`를 직접 열어 "오류 메시지"/"증상" 섹션을 비교해 확정합니다.

- **일치하는 기존 오류가 있으면** → 2단계(기존 오류 갱신)로.
- **처음 보는 오류면** → 3단계(새 오류 기록)로.

### 2단계 — 기존 오류 갱신

1. 해당 `ERR-000N-{slug}.md`를 Read로 읽습니다.
2. frontmatter의 `recurrence_count`를 1 올립니다.
3. "다음에 먼저 확인할 것" 섹션을 이번에 실제로 도움이 됐던(또는 헤매게 만들었던) 확인 순서로 갱신합니다 — 다음 재발 시 처음부터 헤매지 않게 하는 게 이 섹션의 목적입니다.
4. "관련 오류" 섹션에 이번 재발과 관련된 다른 ERR/PB 파일이 있으면 위키링크로 추가합니다.
5. `status`가 `open`인데 이번에 실제로 해결됐다면 `resolved`로 바꿉니다.
6. 새 `recurrence_count`가 **3 이상**이면 4단계(Playbook 승격)로.

### 3단계 — 새 오류 기록 생성

`vault/30_Errors/` 안의 기존 `ERR-XXXX-*.md` 파일들을 Glob으로 확인해 다음 번호를 정합니다(예: 마지막이 ERR-0003이면 이번은 ERR-0004). `vault-template/30_Errors/ERR-template.md` 구조 그대로, 자리표시자만 채워 `vault/30_Errors/ERR-{번호}-{영문-슬러그}.md`를 만듭니다.

```md
---
type: error
project: {project}
status: open
created: {오늘 날짜}
recurrence_count: 1
---

# ERR-0004 로컬 저장값이 재시작 후 사라짐

## 증상

## 오류 메시지

## 원인 후보

## 확인 순서

## 실제 원인

## 해결 방법

## 검증 결과

## 다음에 먼저 확인할 것

## 관련 오류
```

각 섹션은 비개발자가 나중에 다시 읽어도 이해할 수 있는 쉬운 말로 채웁니다. "실제 원인"과 "해결 방법"은 디버깅 단계에서 이미 나온 내용을 그대로 옮기면 됩니다 — 이 스킬이 새로 진단하지 않습니다.

### 4단계 — Playbook으로 승격 (recurrence_count가 3 이상일 때만)

1. `vault/40_Playbooks/` 안의 기존 `PB-XXXX-*.md`를 Glob으로 확인해 다음 번호를 정합니다.
2. `vault-template/40_Playbooks/PB-template.md` 구조 그대로 `vault/40_Playbooks/PB-{번호}-{영문-슬러그}.md`를 만듭니다. 내용은 방금 갱신한 ERR 파일의 "확인 순서"/"해결 방법"/"다음에 먼저 확인할 것"을 재사용 가능한 순서로 정리한 것입니다 — 특정 프로젝트 이름이나 그날의 세부사항은 빼고, 같은 유형의 문제라면 어디서든 참고할 수 있게 일반화합니다.

```md
---
type: playbook
status: active
created: {오늘 날짜}
used_count: 1
---

# PB-0002 로컬 저장값이 사라지는 문제

## 언제 쓰나

## 먼저 확인할 것

## 해결 순서

1.
2.
3.

## 주의할 점

## 관련 오류 기록

- [[ERR-0004-local-storage-reset]]
```

`used_count`는 이번 승격을 1회차로 시작합니다(이 문제를 이미 3번 겪었고, 방금 그 경험을 재사용 가능한 형태로 처음 정리했다는 뜻).

3. `vault/40_Playbooks/Playbook Index.md`를 Read로 읽고 새 행을 추가합니다:

```md
| 번호 | 제목 | 사용 횟수 | 상태 |
|------|------|----------|------|
| [[PB-0002-local-storage-reset]] | 로컬 저장값이 사라지는 문제 | 1 | active |
```

4. 사용자에게 쉬운 말로 알립니다:

```
이 문제가 벌써 3번째라, 다음에 또 생기면 바로 참고할 수 있도록
해결 순서를 정리해서 남겨뒀어요 (PB-0002).
```

### 5단계 — obsidian-brain-update로 이어주기

이 스킬은 `Error Index.md`/`Task Log.md`를 직접 건드리지 않습니다. 이 스킬이 끝나면 `obsidian-brain-update` 스킬이 이어받아 `Error Index.md`의 표(반복횟수 포함)를 갱신하도록 흐름을 넘깁니다.

## 지켜야 할 것

- 원인을 스스로 추측해서 채우지 않습니다 — "실제 원인"/"해결 방법"은 디버깅 단계에서 이미 확인된 내용만 옮겨 적습니다. 아직 검증 전이면 그 사실을 그대로 남깁니다("검증 결과: 아직 재현 테스트 안 함").
- `recurrence_count`가 3 미만이면 Playbook을 만들지 않습니다 — 한두 번 겪은 문제까지 전부 Playbook으로 승격하면 정작 진짜 반복되는 문제가 파묻힙니다(Minimality Ladder와 같은 원칙).
- Playbook 내용은 특정 프로젝트에 국한되지 않게 일반화합니다 — 프로젝트 이름이나 그날의 특수한 사정은 ERR 파일에만 남기고, Playbook은 "같은 유형의 문제를 다른 프로젝트에서 만나도 쓸 수 있는" 수준으로 정리합니다.
- `vault/30_Errors/`, `vault/40_Playbooks/` 모두 `Write` 도구로 씁니다(`scope-check.js`가 vault 쓰기를 build 승인과 무관하게 항상 허용, `skills/guided-plan/SKILL.md` "3단계" 참고). secret 경로 차단과 덮어쓰기 전 백업은 자동 처리됩니다.
