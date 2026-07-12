# 07. Parallel Council and Model Routing Specification

## 목적

비개발자는 어떤 작업을 어떤 에이전트에게 맡겨야 하는지, 어떤 모델이 필요한지 알기 어렵습니다. Senpai Harness는 작업 성격에 맞게 병렬 자문단과 모델 티어를 자동으로 선택해야 합니다.

단, 병렬 실행은 사용자의 의사결정을 대체하지 않습니다. 병렬 에이전트는 먼저 회의 준비 자료를 만들고, 사용자가 이해하고 승인한 뒤에만 구현 단계로 넘어갑니다.

## 핵심 용어

### Parallel Council Router

사용자 요청을 여러 역할의 에이전트에게 나누어 분석시키고, 그 결과를 회의 카드로 종합하는 라우터입니다.

### Auto Model Routing

각 작업의 성격에 따라 적절한 모델 티어를 자동 선택하는 기능입니다.

### Single Writer Principle

여러 에이전트가 동시에 의견을 낼 수는 있지만, 실제 제품 파일을 수정하는 에이전트는 한 번에 하나만 허용합니다.

## 모델 티어

모델 이름은 특정 서비스에 종속되지 않게 추상화합니다.

```yaml
model_tiers:
  fast:
    use_for:
      - 쉬운 설명
      - 문서 정리
      - 체크리스트 업데이트
      - Obsidian 링크 정리

  coding:
    use_for:
      - 코드 수정
      - 테스트 작성
      - 리팩터링
      - 코드 진단

  strong_reasoning:
    use_for:
      - 숨은 결정 탐지
      - 제품 방향 판단
      - 보안/개인정보 위험 판단
      - 복잡한 오류 원인 분석
      - 완료 증거 검토

  long_context:
    use_for:
      - 큰 코드베이스 읽기
      - 여러 세션 기록 요약
      - Obsidian Vault 맥락 회수

  cheap_background:
    use_for:
      - 로그 정리
      - 중복 노트 후보 찾기
      - 태그 정리
```

### 정정 — long_context는 별도 API 티어가 아니다 (WP-B2 조사, 2026-07)

**정정 (WP-B2, 2026-07)**: 위 `model_tiers`의 `long_context`는 다른 티어들과 달리 실제 모델 지정 값으로 실현할 수 없다 — Claude Code 서브에이전트의 `model:` 필드에 그런 값이 존재하지 않는다. 아래가 그 조사 기록과 확정 결론이다.

**조사한 것**: Claude Code 서브에이전트 frontmatter의 `model:` 필드가 확장 컨텍스트(1M 토큰) 윈도우를 지정하는 공식 표기(예: 별도 접미사나 별도 필드)를 지원하는지, 공식 문서 근거로 확인.

**조사 방법**: 공식 문서 `code.claude.com/docs/en/sub-agents`(서브에이전트 frontmatter 스펙), `code.claude.com/docs/en/model-config`(모델/컨텍스트 윈도우 설정), 관련 GitHub 이슈를 직접 확인.

**확인된 사실**:

- `code.claude.com/docs/en/sub-agents`의 "Supported frontmatter fields" 표와 "Choose a model" 절은 `model:` 필드가 받는 값을 전부 나열한다: 모델 별칭(`sonnet`/`opus`/`haiku`/`fable`), 전체 모델 ID(예: `claude-opus-4-8`, `claude-sonnet-5`), `inherit`, 또는 생략(기본값 `inherit`). 이 목록에 `long_context`나 확장 컨텍스트를 뜻하는 값은 없다.
- `[1m]` 접미사(예: `opus[1m]`, `claude-opus-4-8[1m]`)는 실제로 존재하는 공식 표기이지만, `code.claude.com/docs/en/model-config`에 따르면 이는 **메인 세션의 모델 설정(`/model` 명령, `settings.json`의 `model` 필드, `ANTHROPIC_DEFAULT_OPUS_MODEL` 같은 환경변수)에서만** 문서화돼 있다 — 서브에이전트 frontmatter의 `model:` 필드 문서(위 표)에는 등장하지 않는다.
- `anthropics/claude-code` GitHub 이슈 #45169("Subagent model resolution strips [1m] context window suffix", 2026-05-28 closed as **not planned** — `gh issue view`로 직접 확인)는 **parent 세션**의 `~/.claude/settings.json`에 `"model": "opus[1m]"`을 설정해도, 서브에이전트 스폰 시 모델 별칭 해석 과정에서 접미사가 벗겨져 서브에이전트는 항상 기본(~200k) 컨텍스트로 축소된다는 것을 실측으로 보고했다(재현: parent는 `claude-opus-4-6[1m]`인데 서브에이전트 시스템 프롬프트에는 접미사 없는 `claude-opus-4-6`). 서브에이전트 frontmatter 쪽은 애초에 위 불릿대로 `[1m]` 표기가 문서에 없다 — 즉 상속으로도 명시로도, 서브에이전트에서 확장 컨텍스트를 강제하는 경로는 공식적으로 지원되지 않는다.
- (추가 확인) `code.claude.com/docs/en/model-config`의 "Extended context" 절에 따르면, **Anthropic API 기준 `sonnet` 별칭은 Sonnet 5로 해석되고, Sonnet 5는 그 자체로 항상 100만 토큰(1M) 컨텍스트 윈도우로 실행된다** — 200K 버전이 없고 `[1m]` 접미사도, 별도 사용량 크레딧도 필요 없다. 즉 이슈 #45169의 버그(구형 모델을 `[1m]`으로 고정할 때만 발생)는 이미 `model: sonnet`을 쓰는 이 하네스의 서브에이전트에는 애초에 해당하지 않는다 — 별도 표기 없이도 큰 컨텍스트를 받는다. 단, 플랫폼 의존성이 있다: Amazon Bedrock/Google Cloud Agent Platform/Microsoft Foundry에서는 `sonnet`이 Sonnet 4.5로, Claude Platform on AWS에서는 Sonnet 4.6으로 해석되어 1M이 자동 적용되지 않으며(Sonnet 4.6의 1M은 구독 플랜에서 별도 사용량 크레딧 필요, API 종량제는 전체 이용 가능), LLM 게이트웨이(`ANTHROPIC_BASE_URL`) 뒤에서는 Sonnet 5도 `sonnet[1m]`을 명시하지 않으면 200K로 예산이 잡힌다. 이 하네스가 어떤 백엔드로 배포되는지는 이 문서의 조사 범위 밖이므로 결론에서 플랫폼 의존성으로만 명시한다.

**확정: (ii)** — Claude Code 서브에이전트 frontmatter의 `model:` 필드는 구체적 모델 이름/별칭(`opus`/`sonnet`/`haiku`/`fable`/전체 모델 ID)과 `inherit`만 받고, `long_context`라는 추상 티어 이름이나 확장 컨텍스트 지정 표기를 지원하지 않는다. 따라서 `long_context`는 **별도 API 티어가 아니라, `sonnet` + 분할 읽기 전략(파일을 여러 번에 나눠 읽기, 요약을 Obsidian Vault에 누적 저장해 매번 전체를 다시 읽지 않기)으로 실현한다.** `agents/project-explorer.md`가 이미 명시한 `fallback: coding`(→ `sonnet`) 라우팅이 이 결론과 정확히 일치하므로 수정하지 않는다. (Anthropic API 배포라면) `sonnet`이 Sonnet 5로 해석되어 이미 1M 컨텍스트를 기본 제공하므로, 분할 읽기/누적 요약 전략은 "부족한 컨텍스트를 흉내 내는 우회"가 아니라 비용·집중력 관리를 위한 보완책으로 이해해야 한다.

다음 작업(B3, `scripts/route-model-tier.js`)은 이 결론에 따라 `long_context`를 실제 API 모델/컨텍스트 옵션으로 매핑하는 코드를 만들지 말고, `sonnet`으로 라우팅하면서 분할 읽기/누적 요약 전략을 안내하는 방식으로 구현해야 한다. `long_context`를 실제 확장 컨텍스트 API 티어인 것처럼 흉내 내는 코드는 금지.

참고:
- https://code.claude.com/docs/en/sub-agents ("Supported frontmatter fields", "Choose a model")
- https://code.claude.com/docs/en/model-config ("Model aliases" 표, "Extended context" 절과 그 하위 "Sonnet 5 context window" 절)
- https://github.com/anthropics/claude-code/issues/45169 (closed as not planned)

## 에이전트별 기본 모델 티어

```yaml
agent_model_map:
  Meeting Selector:
    default: fast
    escalate_to: strong_reasoning
    when: 새 프로젝트이거나 범위가 큼

  Unknown Detector:
    default: strong_reasoning

  Product Strategist:
    default: strong_reasoning

  Minimality Guardian:
    default: strong_reasoning

  Project Explorer:
    default: long_context
    fallback: coding

  Builder:
    default: coding

  Debugger:
    default: coding
    escalate_to: strong_reasoning
    when: 같은 오류가 2회 이상 반복

  Evidence Reviewer:
    default: strong_reasoning

  Memory Librarian:
    default: fast
    escalate_to: long_context
    when: 과거 세션 5개 이상 회수 필요

  Nondev Explainer:
    default: fast

  Skeptic:
    default: strong_reasoning

  Risk Guardian:
    default: strong_reasoning
```

## 라우팅 기준

```yaml
routing_factors:
  uncertainty:
    meaning: 요구사항이 얼마나 불명확한가

  risk:
    meaning: 보안, 데이터, 비용, 배포 위험이 있는가

  complexity:
    meaning: 여러 파일, 여러 기능, 여러 시스템이 연결되는가

  reversibility:
    meaning: 되돌리기 쉬운 작업인가

  user_understanding:
    meaning: 사용자가 결과를 이해하고 있는가

  evidence_requirement:
    meaning: 완료 증거가 얼마나 필요한가
```

## 병렬 라우팅 매트릭스

```yaml
parallel_routing_matrix:
  low_uncertainty_low_risk:
    mode: fast_single_agent
    example: 버튼 문구 바꿔줘
    agents:
      - Builder
      - Evidence Reviewer
    user_approval: optional

  medium_uncertainty:
    mode: small_council
    example: 설정 화면 추가해줘
    agents:
      - Minimality Guardian
      - Project Explorer
      - Builder
      - Evidence Reviewer
    user_approval: required_before_build

  high_uncertainty:
    mode: discovery_council
    example: 새 앱 만들고 싶어
    agents:
      - Unknown Detector
      - Product Strategist
      - Risk Guardian
      - Minimality Guardian
      - Nondev Explainer
    user_approval: required

  high_risk:
    mode: safety_council
    example: 로그인, 결제, 개인정보, 배포
    agents:
      - Risk Guardian
      - Skeptic
      - Product Strategist
      - Evidence Reviewer
    user_approval: mandatory

  repeated_failure:
    mode: debug_council
    example: 같은 에러가 또 발생
    agents:
      - Debugger
      - Memory Librarian
      - Project Explorer
      - Skeptic
      - Builder
      - Evidence Reviewer
    user_approval: required_if_scope_changes
```

### 정정 — 구현된 라우터와 위 매트릭스의 의도적 차이 (WP-A1~A3, 2026-07)

위 `parallel_routing_matrix`는 원 설계이고, 실제 구현은 `scripts/select-parallel-council.js`(모드·명단 결정의 단일 진실 소스) + `skills/parallel-council/SKILL.md`(최상위 루프의 병렬 스폰 절차) + `hooks/scripts/handler.js`의 UserPromptSubmit Council 넛지다. 구현하면서 다음 결정으로 원 매트릭스와 의도적으로 달라졌다 — 이 각주가 그 차이의 공식 기록이다.

- **D1 — 병렬 스폰 주체 = 훅 넛지 + 최상위 대화 루프.** 위원 에이전트(`agents/*.md`)에는 Task 도구가 없어 스스로 다른 에이전트를 소집하지 못한다. 훅이 additionalContext 넛지에 모드·위원 명단을 실어 보내고, 최상위 대화 루프(`skills/parallel-council`)가 Task 도구로 한 메시지 안에서 병렬 소집한다.
- **D3 — Builder는 어떤 Council에도 포함되지 않는다(Single Writer).** 위 매트릭스의 `fast_single_agent`/`small_council`/`debug_council` 명단에 있던 Builder와 그에 딸린 Evidence Reviewer 실행 단계는 Council 명단에서 제외됐다 — Council 스폰은 전부 읽기 전용 자문이고, 코드 쓰기·완료 검증은 기존 승인 경로(`docs/SAFETY_ENFORCEMENT_POLICY.md`)와 오류 해결 흐름의 원래 단계로만 간다. 그래서 구현에서 `fast_single_agent`/`small_council`의 `agents`는 빈 배열이다(병렬 스폰 없이 기존 순차 경로 그대로). `select-parallel-council.js`가 "어떤 모드의 agents에도 `builder`/`builder-runtime` 없음" 불변식을 코드로 강제하고 `tests/unit/select-parallel-council.test.js`가 전 모드에서 검증한다.
- **D5 — Nondev Explainer는 별도 위원으로 부르지 않는다.** 위 매트릭스의 `discovery_council` 명단에서 제외됐다 — 위원 카드들을 쉬운 말로 종합하는 단계 자체를 최상위 대화 루프가 수행하므로(아래 "사용자에게 보여주는 방식") 별도 스폰은 중복이다.
- **라우팅 입력의 구체화.** 위 "라우팅 기준"의 추상 축(uncertainty/risk/...)은 구현에서 검사·재현 가능한 신호로 옮겨졌다: `scripts/classify-intent.js`의 의도 라벨 + 위험 키워드 6범주(인증/로그인, 결제, 개인정보, 배포, 데이터 삭제, 외부 비용) + 오류 반복 횟수(`vault/30_Errors/ERR-*.md`의 `recurrence_count`).

## 병렬 실행 정책

기본값:

```yaml
parallel_write_policy:
  default: read_only_parallel
  single_writer: true
  allow_parallel_code_write: false
```

승인 전 허용:

- Unknown detection
- Option comparison
- Risk review
- Existing code exploration
- Memory recall
- Minimality review
- UX review

승인 전 금지:

- Product code change
- Dependency installation
- Schema change
- Auth change
- Payment change
- Deployment change
- Destructive file operation

## Scope Drift 감지

다음이 발생하면 실행을 멈추고 Scope Meeting을 엽니다.

- 새 기능 제안
- 새 라이브러리 제안
- 새 서버 제안
- 인증/결제/배포 범위 확장
- 계획보다 큰 파일 수정
- 새로운 데이터 저장 방식 도입

## 사용자에게 보여주는 방식

사용자에게 모델 이름을 노출하지 않습니다. 역할 중심으로 설명합니다.

예시:

```md
# 여러 관점으로 먼저 확인하겠습니다

1. 기획 관점: 이 기능이 지금 필요한지 확인
2. 기술 관점: 기존 코드로 가능한지 확인
3. 위험 관점: 보안이나 데이터 문제가 있는지 확인
4. 최소 구현 관점: 더 작은 버전이 가능한지 확인

결과를 모아서 선택지로 정리하겠습니다.
```
