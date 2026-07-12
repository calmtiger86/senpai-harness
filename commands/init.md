---
description: Senpai Harness를 이 프로젝트에 설치합니다 (CLAUDE.md/AGENTS.md/senpai.config.yaml/vault 생성)
allowed-tools: Bash(node:*), Glob, Read
---

1. First, use Glob to check whether `senpai.config.yaml` already exists at the project root.
2. If it already exists: tell the user, in plain language, that Senpai Harness is already set up in this project. Stop here — do not run the script below.
3. If it does not exist yet: run exactly this, once:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/init.js"
```

Then show the user that command's output as-is (it is already plain-language Korean).

Do not use the Write or Edit tool to create or modify `CLAUDE.md`, `AGENTS.md`, `senpai.config.yaml`, or anything under `vault/` yourself, before or after running the script — this command's only job is to run that one script and report its output. Writing those files any other way defeats the reason this is a single script call in the first place (see `docs/SAFETY_ENFORCEMENT_POLICY.md`, G0's init 닭-달걀 문제 section): the script writes `senpai.config.yaml` last, on purpose, so nothing gets blocked mid-init.

If step 1 is somehow skipped and the Bash call above is denied instead of running (a message about scope/approval rather than the script's own output): that means this project already had `senpai.config.yaml` and Senpai Harness's own safety gate correctly stopped a second mutating attempt on an already-managed project. Tell the user the project is already set up — do not retry or try to work around the denial.

Run this from the project's root folder, not a subfolder of it — running it from a subfolder can create a second, nested Senpai Harness setup instead of recognizing the existing one.
