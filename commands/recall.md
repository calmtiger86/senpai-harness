---
description: 마지막 세션에서 어디까지 했는지 불러옵니다
allowed-tools: Glob, Read
---

1. Glob으로 `vault/80_Sessions/*.md`(파일명이 날짜인 세션 기록)를 찾습니다. `_template.md`, `Session Index.md`는 제외하고, 파일명 날짜 기준으로 가장 최근 것을 Read로 읽습니다.
2. 세션 기록이 하나도 없으면, 대신 `vault/10_Projects/*/Session Memory.md`가 있는지 확인합니다(프로젝트가 하나뿐이면 그걸 읽고, 여러 개면 어느 프로젝트인지 물어봅니다).
3. 그마저도 없으면: "아직 남아 있는 세션 기록이 없습니다. 새로 시작할까요?"라고 답하고 끝냅니다.
4. 기록을 찾았으면, `vault/20_Decisions/Decision Index.md`와 `vault/30_Errors/Error Index.md`에서 아직 해결 안 된 항목이 있는지 함께 확인합니다.
5. 아래 형식으로 비개발자용 요약을 보여줍니다:
   - **지난번에 한 일**
   - **아직 안 끝난 것** (미해결 결정/오류 포함)
   - **오늘 이어갈 수 있는 것** (다음 행동 제안)

이 명령은 읽기 전용입니다 — 아무 파일도 쓰거나 바꾸지 않습니다.
