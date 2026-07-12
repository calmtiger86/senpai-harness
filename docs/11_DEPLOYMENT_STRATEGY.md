# 11. Deployment Strategy

## 결론

Senpai Harness는 1차로 Claude Code Plugin으로 배포한다.

MCP는 하네스 자체의 배포 형태가 아니라, Phase 2에서 추가하는 선택 확장 계층이다.

## 1차 배포: Claude Code Plugin

1차 배포 대상은 다음 구성이다.

- agents
- skills
- commands
- hooks
- Obsidian vault template
- templates
- install / doctor scripts
- plugin metadata

사용자 설치 흐름 예시:

```text
/plugin marketplace add <github-owner>/<repo>
/plugin install senpai-harness@senpai-harness
/senpai-harness:init
```

## 2단계 확장: Optional MCP Server

MCP는 아래 기능이 필요해질 때 추가한다.

- Obsidian Vault 검색
- Session Memory 조회
- Error Record / Playbook 검색
- Agent Graph 조회
- Edge Log 분석
- Project State 질의

MVP는 MCP 없이도 완전히 동작해야 한다.

## 저장소 운영

**정정 (docs 00-07/09/11 재감사)**: 원래는 비공개 GitHub 저장소로 관리할 계획이었으나, 실제로는 원격 저장소 없이 로컬 git 저장소로만 관리되고 있다(`git remote -v` 결과 없음). GitHub 푸시는 아직 하지 않았다.

**추가 정정 (WP-C4 초안 시점, 2026-07)**: 위 문단은 더 이상 사실이 아니다 — 지금은 원격 저장소가 연결되어 있고(`origin` = `github.com/calmtiger86/senpai-harness`, **비공개**) `main` 브랜치를 푸시하고 있다. `release` 브랜치는 아직 만들지 않았다(아래 절차가 그 초안이다).

**추가 정정 (P5 라이브 검증, 2026-07)**: "비공개 개발 저장소"와 "공개 배포 저장소"를 별도 구조로 분리할 필요가 없다는 것까지 확인했다 — 이 저장소 자체가 이미 배포 가능한 marketplace+plugin 구조이므로, 검증이 끝난 뒤 **같은 저장소를 그대로** GitHub에 공개하면 그것이 배포 저장소가 된다. 아래 "공개 저장소 구조 예시"는 실제로 반영된 최종 구조다(더 이상 예시가 아님).

### release 브랜치 운영 절차

<!-- DRAFT: WP-C2 스크립트 실동작 확인 후 최종 확정 예정 -->

**언제 재생성하는가**: 버전 번호를 갱신하거나 새 태그를 붙일 때마다 다음 스크립트를 실행해 `release` 브랜치를 재생성한다:

```bash
node scripts/dev/build-release.js
```

이 스크립트는 개발 저장소(`main` 또는 현재 브랜치)의 배포 가능한 파일들만 선택적으로 `release` 브랜치로 복사한다. 무엇이 실리는지의 유일한 진실 소스는 `scripts/dev/release-manifest.json`(WP-C1에서 작성됨, allowlist 방식)이다 — 요약하면 플러그인 런타임 전체(`.claude-plugin/`, `agents/`, `skills/`, `commands/`, `hooks/`, `scripts/`, `vault-template/`, `templates/`, `project-template/`, `data-schema/`)와 메인 문서(`README.md`, `CHANGELOG.md`, `LICENSE`), 그리고 번호가 붙은 스펙 문서(`docs/00`~`docs/11`, `docs/SAFETY_ENFORCEMENT_POLICY.md`)가 포함된다.

**무엇이 빠지는가** (`release-manifest.json`의 `exclude` 기준):
- `docs/P0`~`P7` 검증·감사 기록과 `docs/HARNESS_ENGINEERING.md`, `docs/Design process meeting materials/` (내부 감사 이력 — 취약점 서술 포함, 공개 배포 전 반드시 제외)
- `tests/` (유닛/스모크 테스트 — 플러그인 로드와 무관)
- `scripts/dev/` (release 빌드 도구 자체), 그리고 git이 추적하지 않는 로컬 디렉터리(`.claude/`, `.omc/`, `.planning/`, `.senpai/`)

정합성은 `tests/unit/release-manifest.test.js`가 기계 검증한다(모든 `docs/*.md`가 include/exclude 중 정확히 한쪽에 분류되는지, 배포되는 파일이 제외된 문서를 참조하지 않는지 등).

**주의**: `build-release.js`는 WP-C2 산출물로, 이 절을 쓰는 시점에는 **아직 존재하지 않는다**(매니페스트와 정합 테스트만 먼저 존재). 스크립트가 만들어지고 실동작이 확인되면 이 절의 DRAFT 표시를 제거하고 확정한다.

## 저장소 구조 (실제 반영됨, 마켓플레이스+플러그인 자기참조)

```text
senpai-harness/
├── README.md
├── LICENSE
├── CHANGELOG.md
├── .claude-plugin/
│   ├── marketplace.json   # plugins[0].source: "./" — 저장소 자기 자신
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

`.claude-plugin/marketplace.json`에 `source: "./"`로 단일 plugin 엔트리를 지정하는 구성은 `claude plugin validate --strict`와 실제 `claude plugin marketplace add` + `claude plugin install --scope user` 설치까지 라이브로 검증됐다(설치 후 즉시 uninstall + marketplace remove로 원상복구). 자세한 스키마 근거는 `docs/03_TECHNICAL_SPEC.md`의 "배포 아키텍처" 절 참고.
