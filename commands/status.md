---
description: 지금 프로젝트가 어느 단계인지, 최근 상태를 비개발자 언어로 보여줍니다
allowed-tools: Bash(node:*), Glob, Read
---

1. `node "${CLAUDE_PLUGIN_ROOT}/scripts/state-store.js"`를 실행해 `.senpai/state.json`의 현재 승인 상태를 확인합니다. 이 스크립트는 읽기 전용이라 항상 안전하게 실행할 수 있습니다. 파일이 없거나 손상됐다는 결과(`valid: false`)가 나오면 "아직 승인된 빌드가 없습니다"로 이해합니다.
2. Glob으로 `vault/10_Projects/*/Current State.md`를 찾습니다.
   - 프로젝트가 하나도 없으면: "아직 시작한 프로젝트가 없습니다. 새 프로젝트를 시작해볼까요?"라고 답하고 끝냅니다.
   - 프로젝트가 하나면: 그 `Current State.md`를 Read로 읽어 그대로 요약합니다.
   - 여러 개면: 프로젝트 이름 목록을 보여주고 어느 프로젝트 상태를 보고 싶은지 물어봅니다.
3. 1단계에서 확인한 승인 상태(`approved_scope`, `allowed_files`)와 2단계에서 읽은 `Current State.md`를 합쳐서, 비개발자가 읽을 수 있는 말로 정리합니다. 예: `approved_scope: true`이고 `allowed_files`에 3개 파일이 있으면 "지금 이 3개 파일 범위가 승인되어 작업 가능한 상태입니다: ..."처럼 뜻을 풀어서 전달하고, JSON을 원문 그대로 보여주지 않습니다.

이 명령은 읽기 전용입니다 — 아무 파일도 쓰거나 바꾸지 않습니다.
