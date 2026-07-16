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

**추가 정정 (P5 라이브 검증, 2026-07)**: "비공개 개발 저장소"와 "공개 배포 저장소"를 별도 구조로 분리할 필요가 없다는 것까지 확인했다 — 이 저장소 자체가 이미 배포 가능한 marketplace+plugin 구조이므로, 검증이 끝난 뒤 같은 저장소를 그대로 GitHub에 공개하면 그것이 배포 저장소가 될 수 있다.

**최종 정정 (WP-C5 P9 실측 후 사용자 결정, 2026-07-16)**: 위 정정의 "같은 저장소를 그대로 공개"는 **기술적으로 가능함이 확인**됐지만(P9 실측: release 브랜치 캐시에 내부 문서 0건 유출), 실제 배포 방향은 사용자 결정으로 **별도 신규 공개 저장소**를 택했다 — 비공개 개발 이력 자체를 공개 저장소와 완전히 분리하기 위해서다. 결과: 기존 저장소(`calmtiger86/senpai-harness`, 전체 개발 이력 보유)는 `calmtiger86/senpai-harness-dev`로 이름을 바꿔 비공개로 유지하고, `calmtiger86/senpai-harness`라는 원래 이름은 `build-release.js`가 만드는 release 브랜치 내용만 담은 **새 저장소**가 가져간다(첫 커밋부터 시작, 개발 이력 없음). 아래 "저장소 구조"는 이 새 공개 저장소의 구조다.

### release 브랜치 운영 절차

**정정 (WP-C2 실동작 확인 + WP-C5 라이브 설치 검증 완료, 2026-07)**: 아래 절차는 더 이상 초안이 아니다 — `scripts/dev/build-release.js`가 실제로 존재하고, 실제 `marketplace add`/`install`/uninstall 사이클로 검증됐다(`docs/P9_RELEASE_BRANCH_LIVE_VERIFICATION.md`). 위 "최종 정정"에 따라 이 절차의 산출물(개발 저장소의 `release` 브랜치)은 이제 같은 저장소에 남지 않고 `calmtiger86/senpai-harness`(신규 공개 저장소)의 `main` 브랜치로 push된다.

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

## 저장소 구조 (신규 공개 저장소 `calmtiger86/senpai-harness`, 마켓플레이스+플러그인 자기참조)

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
├── scripts/               # scripts/dev/(release 빌드 도구 자체)는 제외
├── vault-template/
├── templates/
├── project-template/
├── data-schema/
└── docs/                  # 00~11 스펙 문서 + SAFETY_ENFORCEMENT_POLICY.md만(P0~P9 검증 기록 등은 제외)
```

`tests/`는 포함되지 않는다(플러그인 로드와 무관, `release-manifest.json`의 exclude 대상).

`.claude-plugin/marketplace.json`에 `source: "./"`로 단일 plugin 엔트리를 지정하는 구성은 `claude plugin validate --strict`와 실제 `claude plugin marketplace add` + `claude plugin install --scope user` 설치까지 라이브로 검증됐다(설치 후 즉시 uninstall + marketplace remove로 원상복구). 자세한 스키마 근거는 `docs/03_TECHNICAL_SPEC.md`의 "배포 아키텍처" 절 참고.
