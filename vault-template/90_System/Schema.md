---
type: system_reference
status: active
updated: "{date}"
---

# Schema

이 문서는 이 볼트에서 쓰이는 노트 타입과, 각 타입이 반드시 가져야 하는 frontmatter(노트 맨 위에 있는 `---`로 감싼 속성 표)를 정리합니다.

에이전트나 스킬이 노트를 새로 만들거나 읽을 때, 이 문서를 기준으로 삼습니다. 여기 없는 필드를 마음대로 추가하거나, 여기 있는 필드를 빼먹지 않도록 합니다.

## 기본 frontmatter 규칙 (모든 주요 노트 공통)

`05_OBSIDIAN_VAULT_SPEC`에 정의된 기본 규칙입니다. 아래 타입별 규칙에서 특별히 다르게 정하지 않는 한, 모든 주요 노트는 최소한 이 필드를 가집니다.

```yaml
type: note_type
project: project_name
status: active|done|deferred|open|closed
created: YYYY-MM-DD
updated: YYYY-MM-DD
```

- `type` — 이 노트가 어떤 종류인지 (아래 타입별 규칙 참고)
- `project` — 어느 프로젝트에 속한 노트인지. 프로젝트에 속하지 않는 공용 노트(예: 이 `90_System` 폴더의 문서들)는 생략할 수 있습니다.
- `status` — 지금 이 노트가 살아있는 상태인지, 끝났는지, 미뤄졌는지
- `created` / `updated` — 언제 만들어졌고 언제 마지막으로 바뀌었는지

## 타입별 규칙

실제로 각 노트 템플릿은 프로젝트마다 필요한 필드만 골라 씁니다. 아래는 `05_OBSIDIAN_VAULT_SPEC`에 정의된 실제 템플릿 기준입니다.

### `unknown_map`

숨은 결정을 정리하는 노트입니다. 위치: `10_Projects/{project}/Unknown Map.md`

```yaml
type: unknown_map
project: {project}
status: active
updated: {date}
```

### `decision`

결정 기록(ADR)입니다. 위치: `20_Decisions/ADR-XXXX-제목.md`

```yaml
type: decision
project: {project}
status: accepted
created: {date}
impact: {low|medium|high}
```

기본 규칙과 다른 점: `status`는 `accepted` 값을 쓰고, `updated` 대신 결정이 제품에 미치는 영향 크기를 나타내는 `impact` 필드가 추가됩니다.

### `phase_plan`

승인된 작업 범위와 체크리스트입니다. 위치: `10_Projects/{project}/Phase Plan.md`

```yaml
type: phase_plan
project: {project}
phase: {phase}
status: active
```

기본 규칙과 다른 점: 지금이 몇 번째 단계인지 나타내는 `phase` 필드가 추가됩니다.

### `completion_evidence`

완료 증거판입니다. 위치: `10_Projects/{project}/Completion Evidence.md` (또는 `00_Dashboard/Completion Evidence.md`처럼 여러 프로젝트를 모아 보여주는 버전)

```yaml
type: completion_evidence
project: {project}
status: partial
updated: {date}
```

기본 규칙과 다른 점: `status`는 완료 정도를 나타내는 값(`partial` 등)을 씁니다.

### `error`

오류 기록입니다. 위치: `30_Errors/ERR-XXXX-제목.md`

```yaml
type: error
project: {project}
status: open
created: {date}
recurrence_count: 1
```

기본 규칙과 다른 점: 같은 오류가 몇 번 반복됐는지 세는 `recurrence_count` 필드가 추가됩니다. 이 값이 일정 횟수를 넘으면 Playbook 후보로 승격됩니다.

### `playbook`

반복 오류를 해결하는 표준 절차입니다. 위치: `40_Playbooks/PB-XXXX-제목.md`

```yaml
type: playbook
status: active
created: {date}
used_count: 0
```

기본 규칙과 다른 점: 특정 프로젝트에 묶이지 않으므로 `project` 필드가 없습니다. 대신 이 절차가 몇 번 쓰였는지 세는 `used_count` 필드가 있습니다.

### `session`

세션(하루 작업 단위) 기록입니다. 위치: `80_Sessions/YYYY-MM-DD/` 아래, 그리고 `80_Sessions/Session Index.md`에 목록으로 모입니다.

세션 노트는 별도의 전용 필드 없이 기본 frontmatter 규칙을 그대로 따릅니다.

```yaml
type: session
project: {project}
status: active|done
created: {date}
updated: {date}
```

세션 안의 상세 내용(오늘 한 일, 다음 시작점 등)은 각 프로젝트의 `Session Memory.md`와 `Current State.md`에서 함께 관리합니다.

## 이 스키마를 지키는 이유

frontmatter가 정돈되어 있어야 대시보드(`00_Dashboard`)와 인덱스 노트(`Decision Index`, `Error Index`, `Playbook Index` 등)가 여러 노트를 자동으로 모아 보여줄 수 있습니다. 필드가 빠지거나 이름이 달라지면 이 자동 정리가 깨집니다.

---

관련: [[Autonomy Contract]] · [[Build Gates]]
