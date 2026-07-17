# 03. Technical Specification

## 구현 목표

Senpai Harness는 Claude Code CLI 프로젝트 안에 설치되는 하네스입니다. **정정 (docs 00-07/09/11 재감사)**: 원래는 최종 구현 프로젝트 저장소를 비공개 GitHub 저장소로 관리할 계획이었으나, 실제로는 원격 저장소 없이 로컬 git 저장소로만 관리되고 있다(GitHub push 이력 없음, `docs/11_DEPLOYMENT_STRATEGY.md` 참고). 완성 후 공개 가능한 버전을 별도로 정리해 공개 저장소에 올릴 수 있어야 합니다.

## 기술 방향

- Node.js 기반 CLI와 스크립트
- Claude Code compatible agents, skills, commands, hooks
- Obsidian Vault template
- Markdown 중심 데이터 관리
- JSONL 기반 이벤트/엣지 로그
- 로컬 파일 시스템 우선
- 외부 SaaS 연동 없음


## 배포 아키텍처

<!-- DRAFT: WP-C2 스크립트 실동작 확인 후 최종 확정 예정 -->

Senpai Harness는 **Plugin-first, MCP-later** 전략을 따른다.

### 1차: Claude Code Plugin

**정정 (P5 라이브 검증, 2026-07)**: 이 섹션은 원래 마켓플레이스 루트와 플러그인 디렉터리를 `plugins/senpai-harness/`로 물리적으로 분리하는 구조를 전제했으나, 실제로는 **이 저장소 자체가 마켓플레이스이자 유일한 플러그인**이다 — `.claude-plugin/marketplace.json`의 `plugins[0].source`를 `"./"`(저장소 자기 자신)로 지정한다. claude-code-guide를 통해 marketplace.json 공식 스키마를 확인한 뒤, 실제로 `claude plugin marketplace add <이 저장소 경로>` → `claude plugin install senpai-harness@senpai-harness --scope user`로 설치가 성공하는 것까지 라이브로 검증했다(설치 후 즉시 uninstall + marketplace remove로 원상복구, `~/.claude/settings.json`에 잔재 없음 확인). `plugins/senpai-harness/`로 분리하는 방식은 다중 플러그인 마켓플레이스에는 필요하지만, 이 프로젝트는 설계상 단일 플러그인이므로 저장소 전체를 옮기는 저장소 재구성(큰 기계적 리스크)을 감수할 이유가 없다고 판단했다.

**추가 정정 (WP-C4 배포 전략 초안, 2026-07)**: 공개 배포는 `release` 브랜치를 통해 이루어질 예정이다. `main` 또는 개발 브랜치의 변경사항이 검증을 통과하면, `scripts/dev/build-release.js`를 실행해 `release` 브랜치를 재생성한다. 무엇이 실리는지는 `scripts/dev/release-manifest.json`(allowlist, WP-C1에서 작성됨)이 정의하며, 내부 검증·감사 기록(`docs/P0`~`P7` 등)과 `tests/`, 개발 도구는 제외된다. 빌드 스크립트 `build-release.js` 자체는 WP-C2 산출물로 이 초안 시점에는 아직 없다. 자세한 절차는 [`docs/11_DEPLOYMENT_STRATEGY.md`](11_DEPLOYMENT_STRATEGY.md)의 "release 브랜치 운영 절차" 참고.

필수 요소(저장소 루트 = 마켓플레이스 루트 = 플러그인 루트):

```text
.claude-plugin/marketplace.json   # plugins[0].source: "./"
.claude-plugin/plugin.json
agents/
skills/
commands/
hooks/hooks.json
vault-template/
templates/
scripts/
```

개발 저장소와 배포 저장소는 구조적으로 분리할 필요가 없다 — 같은 저장소가 지금은 원격 없이 로컬로만 존재하고(비공개 개발 단계), 검증이 끝난 뒤 그대로 GitHub에 공개하면 배포 저장소가 된다.

### 2차: Optional MCP Server

MCP는 MVP 필수 기능이 아니다. 다만 향후 아래 기능을 위해 `mcp/` 또는 `plugins/senpai-harness/mcp/` 아래에 선택 확장으로 추가할 수 있다.

- Vault search
- Session recall
- Error / Playbook query
- Edge Log query
- Agent Graph query
- Project state query

MCP 서버는 플러그인과 독립적으로도 실행 가능해야 하지만, 사용자 관점에서는 Plugin 설치 후 선택적으로 활성화되는 구조가 바람직하다.

### 공개용 저장소 구조 (실제 반영됨)

```text
senpai-harness/
├── README.md
├── LICENSE
├── CHANGELOG.md
├── .claude-plugin/
│   ├── marketplace.json    # plugins[0].source: "./"
│   └── plugin.json
├── agents/
├── skills/
├── commands/
├── hooks/
├── scripts/
├── vault-template/
├── templates/
├── project-template/
├── data-schema/
├── tests/
└── docs/
```

`mcp/`는 Phase 2에서 필요해질 때 저장소 루트에 선택 확장으로 추가한다(§`2차: Optional MCP Server` 참고).

### `marketplace.json` (실제 파일, `.claude-plugin/marketplace.json`)

```json
{
  "name": "senpai-harness",
  "owner": {
    "name": "CalmTiger"
  },
  "description": "AI Senpai Harness for non-developer vibe coding.",
  "plugins": [
    {
      "name": "senpai-harness",
      "source": "./",
      "description": "Guided auto-drive Claude Code harness for non-developers. It opens meetings, surfaces hidden decisions, prevents overbuilding, verifies before done, and stores project memory in Obsidian.",
      "version": "0.2.0",
      "author": {
        "name": "CalmTiger"
      }
    }
  ]
}
```

### `plugin.json` (실제 파일, `.claude-plugin/plugin.json`)

```json
{
  "name": "senpai-harness",
  "description": "Guided auto-drive Claude Code harness for non-developers. It opens meetings, surfaces hidden decisions, prevents overbuilding, verifies before done, and stores project memory in Obsidian.",
  "version": "0.2.0",
  "author": { "name": "CalmTiger" }
}
```

## 최종 저장소 구조

> **정정 (하네스 엔지니어링 딥리서치 + 사용자 확인, 2026-07)**: `senpai.config.yaml`·`CLAUDE.md`·`AGENTS.md`는 원래 이 트리의 저장소 루트에 있었으나, 이 셋은 **이 저장소(senpai-harness) 자체의 파일이 아니라 Senpai Harness가 최종 사용자 프로젝트에 심어 넣는 산출물**이다(OpenAI "harness engineering" 원문: AGENTS.md는 harness 본체가 아니라 "a map, with pointers to deeper sources of truth elsewhere"). 아래 트리에서 `project-template/`로 옮겼다 — `docs/08_MVP_SCOPE.md` §9 참고.
>
> 별개로 아직 못 고친 것: 아래 트리는 `.claude/agents/`·`.claude/skills/` 등 nested 레이아웃을 보여주는데, 실제로는 `precious-forging-wind.md`의 "패키지 레이아웃 정정"에 따라 `agents/`·`skills/`·`commands/`·`hooks/hooks.json`이 저장소 루트에 바로 있다(`docs/P5_PRE_FLIGHT_RISK_REVIEW.md`도 이 사실을 전제한다). 이 트리 전체를 실제 레이아웃에 맞게 다시 그리는 작업은 이번 정정 범위 밖이라 별도로 남겨둔다.

```text
senpai-harness/
├── README.md
├── LICENSE
├── package.json
│
├── project-template/          # 최종 사용자 프로젝트 루트에 심어 넣을 산출물(초안) — 이 저장소 자체의 파일이 아님
│   ├── CLAUDE.md
│   ├── AGENTS.md
│   └── senpai.config.yaml
│
├── .claude-plugin/
│   └── plugin.json
│
├── .claude/
│   ├── agents/
│   │   ├── senpai-orchestrator.md
│   │   ├── meeting-selector.md
│   │   ├── unknown-detector.md
│   │   ├── product-strategist.md
│   │   ├── minimality-guardian.md
│   │   ├── project-explorer.md
│   │   ├── builder.md
│   │   ├── debugger.md
│   │   ├── evidence-reviewer.md
│   │   ├── memory-librarian.md
│   │   ├── nondev-explainer.md
│   │   ├── skeptic.md
│   │   └── risk-guardian.md
│   │
│   ├── skills/
│   │   ├── guided-auto-drive/
│   │   │   └── SKILL.md
│   │   ├── meeting-system/
│   │   │   └── SKILL.md
│   │   ├── unknown-map/
│   │   │   └── SKILL.md
│   │   ├── decision-card/
│   │   │   └── SKILL.md
│   │   ├── minimality-ladder/
│   │   │   └── SKILL.md
│   │   ├── guided-plan/
│   │   │   └── SKILL.md
│   │   ├── evidence-loop/
│   │   │   └── SKILL.md
│   │   ├── obsidian-brain-update/
│   │   │   └── SKILL.md
│   │   ├── error-to-playbook/
│   │   │   └── SKILL.md
│   │   ├── ddtf-edge-log/
│   │   │   └── SKILL.md
│   │   └── parallel-council-routing/
│   │       └── SKILL.md
│   │   # nondev-progress-report/ 없음 — 정정 (2026-07-17, 배포 전 최종 결정): 별도 스킬로 분리하지 않기로
│   │   # 확정, agents/nondev-explainer.md에 흡수됨(docs/08_MVP_SCOPE.md §5 참고)
│   │
│   ├── commands/
│   │   ├── senpai-status.md
│   │   ├── senpai-save.md
│   │   ├── senpai-recall.md
│   │   ├── senpai-doctor.md
│   │   ├── senpai-help.md
│   │   └── senpai-reset.md
│   │
│   ├── hooks/
│   │   ├── session-start.js
│   │   ├── user-prompt-submit.js
│   │   ├── pre-tool-use.js
│   │   ├── post-tool-use.js
│   │   ├── task-completed.js
│   │   ├── stop.js
│   │   └── session-end.js
│   │
│   └── settings.json
│
├── vault-template/
│   ├── 00_Dashboard/
│   ├── 10_Projects/
│   ├── 20_Decisions/
│   ├── 30_Errors/
│   ├── 40_Playbooks/
│   ├── 50_Concepts/
│   ├── 60_Agent_Graph/
│   ├── 70_Sources/
│   ├── 80_Sessions/
│   └── 90_System/
│
├── templates/
│   ├── project-brief.md
│   ├── unknown-map.md
│   ├── decision-card.md
│   ├── decision-record.md
│   ├── phase-plan.md
│   ├── minimality-check.md
│   ├── completion-evidence.md
│   ├── error-record.md
│   ├── playbook.md
│   ├── session-checkin.md
│   ├── session-checkout.md
│   └── nondev-summary.md
│
├── scripts/
│   ├── install.js
│   ├── uninstall.js
│   ├── doctor.js
│   ├── detect-project.js
│   ├── detect-project-state.js
│   ├── classify-user-intent.js
│   ├── select-meeting.js
│   ├── run-minimality-ladder.js
│   ├── update-obsidian.js
│   ├── score-edge.js
│   ├── update-matrix.js
│   ├── detect-repeated-error.js
│   ├── promote-playbook.js
│   ├── select-parallel-council.js
│   ├── route-model-tier.js
│   ├── protect-secrets.js
│   └── lint-vault.js
│
├── data-schema/
│   ├── event-log.schema.json
│   ├── edge-log.schema.json
│   ├── state-log.schema.json
│   └── model-routing.schema.json
│
├── tests/
│   ├── smoke/
│   ├── fixtures/
│   └── README.md
│
└── docs/
    └── ...
```

## 설정 파일

### `senpai.config.yaml`

```yaml
harness:
  name: senpai-harness
  version: 0.1.0
  audience: non_developer
  default_language: ko
  mode: guided_auto_drive

obsidian:
  vault_path: ./vault
  required: true

memory:
  current_state: ./vault/10_Projects/{project}/Current State.md
  session_memory: ./vault/10_Projects/{project}/Session Memory.md
  decision_index: ./vault/20_Decisions/Decision Index.md
  error_index: ./vault/30_Errors/Error Index.md
  playbook_index: ./vault/40_Playbooks/Playbook Index.md
  agent_graph: ./vault/60_Agent_Graph/Agent Graph.md

routing:
  default_state: orientation
  direct_build_from_user: blocked
  require_meeting_before_build: true
  require_user_approval_before_code: true
  require_evidence_before_done: true

parallel:
  default_mode: read_only_parallel
  single_writer: true
  allow_parallel_code_write: false

model_tiers:
  - fast
  - coding
  - strong_reasoning
  - long_context
  - cheap_background

safety:
  protect_secret_files: true
  backup_before_overwrite: true
  block_destructive_actions: true
  require_approval_for:
    - dependency_install
    - auth_change
    - payment_change
    - deployment_change
    - database_migration
    - destructive_file_operation
```

**정정 (2026-07, 독립 설계 감사)**: 위 스키마에 있던 `obsidian.template_path: ./vault-template` 필드는 삭제했다. `scripts/init.js`가 실제로 구현한 방식은 플러그인 자신의 `vault-template/`를 대상 프로젝트의 `./vault`로 통째로 복사하는 것뿐이라 이 필드를 읽는 코드가 아예 없었고, 남아있던 값(`./vault-template`)은 대상 프로젝트에 존재하지도 않을 경로를 가리켜 혼란만 줬다. 아무도 안 읽는 설정은 만들지 않는다(YAGNI) — `project-template/senpai.config.yaml`도 함께 수정.

## 데이터 로그

설치된 프로젝트에는 다음 로그 폴더를 생성합니다.

```text
.senpai/
├── event_logs.jsonl
├── state_logs.jsonl
├── model_routing_logs.jsonl
├── doctor_report.json
└── backups/
```

`event_logs.jsonl`은 `hooks/scripts/handler.js`가 모든 훅 호출마다 실제로 기록합니다. `state_logs.jsonl`/`model_routing_logs.jsonl`은 아직 writer가 없는 계획 단계입니다. `edge_logs.jsonl`은 이 목록에서 뺐습니다 — DDTF Edge Log는 별도 JSON 로그가 아니라 `vault/60_Agent_Graph/Edge Logs.md` 표 자체가 원본 기록입니다(`skills/obsidian-brain-update/SKILL.md` "Edge Logs.md" 참고, Decision Index/Error Index와 같은 방식).

## 구현 원칙

1. 먼저 문서와 템플릿을 생성합니다.
2. 그다음 agents, skills, commands를 생성합니다.
3. 그다음 hooks와 scripts를 구현합니다.
4. MVP 범위 밖 기능은 TODO로 남기고 구현하지 않습니다.
5. 모든 스크립트는 실패 시 사람이 이해할 수 있는 메시지를 출력해야 합니다.
6. 기존 파일을 덮어쓸 때는 백업하거나 확인해야 합니다.
7. secret 파일은 읽거나 출력하지 않아야 합니다.
