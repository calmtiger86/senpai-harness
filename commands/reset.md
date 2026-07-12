---
description: 이 프로젝트에서 Senpai Harness 관리를 중단하는 방법을 안내합니다
allowed-tools: Glob
---

1. First, use Glob to check whether `senpai.config.yaml` exists at the project root.
2. If it does NOT exist: tell the user, in plain language, that this project is not currently managed by Senpai Harness, so there is nothing to stop.
3. If it exists: explain to the user, in plain Korean, exactly what stopping does and does not do, then ask them to type the confirmation phrase themselves:

```
Senpai Harness가 이 프로젝트를 더 이상 관리하지 않게 하려면, 채팅창에 아래 문구를 정확히 그대로 입력해서 확인해 주세요.
다른 말(예: "네", "꺼줘", "그만 써")로는 실제로 꺼지지 않습니다.

[senpai-stop]

이렇게 하면:
- senpai.config.yaml만 지워집니다.
- vault/, CLAUDE.md, AGENTS.md는 그대로 남습니다 -- 지금까지의 기록은 사라지지 않습니다.
- 나중에 다시 쓰고 싶으면 /senpai-harness:init을 다시 실행하면 됩니다.
```

Do not use the Write, Edit, or Bash tool to delete `senpai.config.yaml` yourself, before or after showing this message -- this command's only job is to explain and wait. `senpai.config.yaml` is control-plane self-protected (docs/SAFETY_ENFORCEMENT_POLICY.md), so any attempt to delete it via a tool call is denied regardless of intent; only the user typing `[senpai-stop]` in their own next chat message actually triggers the removal, handled entirely by the trusted hook (scripts/reset.js), never by this command or by you directly.

If the user then sends `[senpai-touch:...]`-style confusion or asks why typing "네" didn't work: remind them the exact phrase is `[senpai-stop]`, with the brackets, nothing else in the message.
