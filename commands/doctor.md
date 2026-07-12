---
description: Senpai Harness 설치 상태를 점검하고 비개발자가 읽을 수 있는 리포트를 보여줍니다
allowed-tools: Bash(node:*)
---

아래를 정확히 한 번 실행하고, 그 출력을 그대로(가공하거나 요약하지 않고) 사용자에게 보여줍니다:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.js"
```

`scripts/doctor.js`는 읽기 전용입니다 — 아무것도 고치거나 만들지 않고, `.senpai/state.json`/`.claude-plugin/plugin.json`/`hooks/hooks.json`/`vault-template/`/`.git`/`senpai.config.yaml` 위치가 정상인지만 확인해 각 항목을 한글로 보고합니다. 이 명령이 이 프로젝트가 아직 Senpai Harness로 관리되고 있지 않다고 보고하더라도(예: `senpai.config.yaml` 없음), 그 자체가 오류가 아닙니다 — `/senpai-harness:init`으로 시작하면 됩니다.

출력 외에 추가 진단이나 해석을 덧붙이지 않습니다. 이 스크립트의 리포트 자체가 이미 비개발자가 읽을 수 있는 형태입니다.
