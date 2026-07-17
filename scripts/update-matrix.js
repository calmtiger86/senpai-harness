'use strict';

/**
 * Edge Log Matrix Aggregator (docs/P10_INTENT_VS_REALITY_AUDIT.md "DDTF Edge
 * Log" finding, docs/08_MVP_SCOPE.md §8 "버킷 D": "update-matrix.js —
 * 미구현: Connectivity Matrix.md/Rewire History.md 집계 로직 자체가 없음.")
 *
 * `vault-template/60_Agent_Graph/Edge Logs.md` is the live, append-only
 * origin record -- `skills/obsidian-brain-update/SKILL.md` writes one row to
 * it per meaningful work unit (already verified live in prior audits). This
 * module is the missing consumer: a pure aggregation pipeline that turns
 * accumulated Edge Log rows into the two vault-template files that were,
 * until now, schema-only placeholders:
 *   - `vault-template/60_Agent_Graph/Connectivity Matrix.md` (4x4 role-group
 *     totals)
 *   - `vault-template/60_Agent_Graph/Rewire History.md` (routing changes
 *     between two aggregate snapshots)
 *
 * Every function here is pure: no filesystem access, no `Write`, no
 * `Date.now()`/`new Date()` inside the aggregation logic itself (the only
 * exception is the CLI entry point at the bottom, which reads a file from
 * argv and prints to stdout -- it never writes anywhere). Actually writing
 * the two vault files is `skills/obsidian-brain-update/SKILL.md`'s job via
 * the `Write` tool (same division of labor the skill already uses for the
 * 7 files it owns directly) -- this script only produces the markdown text
 * that skill can pass straight to `Write`.
 *
 * 13 -> 4 role-group mapping (per `vault-template/60_Agent_Graph/Connectivity
 * Matrix.md`'s own note: "Edge Logs.md의 from/to는 docs/04_AGENT_SPEC.md의
 * 13개 에이전트 이름을 그대로 쓰지만, 이 표의 행/열은 4개 런타임 역할...
 * 1:1로 이름이 같지 않으므로... 집계 단계에서 13->4 매핑을 먼저 정의해야
 * 한다"). The mapping below is not invented here -- it is read directly off
 * which of the 13 docs/04_AGENT_SPEC.md roles each of the 4 already-wired
 * runtime agents documents itself as absorbing:
 *   - agents/orchestrator-meeting.md: "Orchestrator + Meeting Selector +
 *     Unknown Detector + Product Strategist + Nondev Explainer"
 *   - agents/safety-minimality.md: "Minimality Guardian + Skeptic + Risk
 *     Guardian"
 *   - agents/builder-runtime.md: "Project Explorer, Builder, Debugger"
 *   - agents/evidence-memory.md: "Evidence Reviewer + Memory Librarian"
 */

const AGENT_TO_ROLE_GROUP = {
  'Senpai Orchestrator': 'Orchestrator/Meeting',
  'Meeting Selector': 'Orchestrator/Meeting',
  'Unknown Detector': 'Orchestrator/Meeting',
  'Product Strategist': 'Orchestrator/Meeting',
  'Nondev Explainer': 'Orchestrator/Meeting',

  'Minimality Guardian': 'Safety-Minimality',
  Skeptic: 'Safety-Minimality',
  'Risk Guardian': 'Safety-Minimality',

  'Project Explorer': 'Builder',
  Builder: 'Builder',
  Debugger: 'Builder',

  'Evidence Reviewer': 'Evidence-Memory',
  'Memory Librarian': 'Evidence-Memory'
};

// Fixed matrix axes, in the same order as
// `vault-template/60_Agent_Graph/Connectivity Matrix.md`'s header row.
const ROLE_GROUPS = ['Orchestrator/Meeting', 'Safety-Minimality', 'Builder', 'Evidence-Memory'];

// Display order for weight categories when a rendered cell needs a
// breakdown. Only categories that actually occur in the data are ever
// shown (see aggregateMatrix) -- this array is purely a stable sort order,
// not a claim that all three always exist.
const WEIGHT_DISPLAY_ORDER = ['강함', '보조', '차단'];

const EDGE_LOG_COLUMNS = [
  'from',
  'to',
  'weight',
  'directness',
  'state',
  'artifact',
  'user_understanding',
  'user_decision',
  'impact'
];

/**
 * Splits one markdown pipe-table line into trimmed cell strings.
 * Returns null for a line that isn't a pipe-table row at all (doesn't start
 * with "|" once trimmed), so callers can tell "not a table row" apart from
 * "a table row with the wrong number of cells".
 * @param {string} line
 * @returns {string[]|null}
 */
function splitTableRow(line) {
  const trimmed = typeof line === 'string' ? line.trim() : '';
  if (!trimmed.startsWith('|')) {
    return null;
  }
  let inner = trimmed.slice(1);
  if (inner.endsWith('|')) {
    inner = inner.slice(0, -1);
  }
  return inner.split('|').map((cell) => cell.trim());
}

/**
 * A markdown table separator row looks like `| ---- | :--- | ---: |`: every
 * cell is made of dashes only, with optional leading/trailing colons for
 * alignment.
 * @param {string[]} cells
 * @returns {boolean}
 */
function isSeparatorRow(cells) {
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell));
}

/**
 * Parses the Edge Log table out of `Edge Logs.md`'s raw markdown text into
 * structured rows (docs/05_OBSIDIAN_VAULT_SPEC.md, `Edge Logs.md`'s own
 * "항목 읽는 법" column contract). Pure function, no file I/O.
 *
 * Fail-closed: non-string input, input with no recognizable Edge Log header,
 * or a header with no data rows below it all safely return `[]` rather than
 * throwing. A malformed individual row (wrong cell count) is skipped rather
 * than aborting the whole parse -- one bad line shouldn't hide every good
 * one.
 *
 * @param {string} markdownText - full contents of Edge Logs.md.
 * @returns {Array<{from: string, to: string, weight: string, directness: string, state: string, artifact: string, user_understanding: string, user_decision: string, impact: string}>}
 */
function parseEdgeLogs(markdownText) {
  if (typeof markdownText !== 'string' || markdownText.trim().length === 0) {
    return [];
  }

  const lines = markdownText.split(/\r?\n/);

  let headerIndex = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const cells = splitTableRow(lines[i]);
    if (
      cells &&
      cells.length === EDGE_LOG_COLUMNS.length &&
      cells[0].toLowerCase() === 'from' &&
      cells[1].toLowerCase() === 'to'
    ) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex === -1) {
    return [];
  }

  let cursor = headerIndex + 1;
  const separatorCells = cursor < lines.length ? splitTableRow(lines[cursor]) : null;
  if (separatorCells && isSeparatorRow(separatorCells)) {
    cursor += 1;
  }

  const rows = [];
  while (cursor < lines.length) {
    const cells = splitTableRow(lines[cursor]);
    if (!cells) {
      // First non-table-row line ends the table.
      break;
    }
    cursor += 1;
    if (cells.length !== EDGE_LOG_COLUMNS.length || isSeparatorRow(cells)) {
      continue;
    }
    const row = {};
    EDGE_LOG_COLUMNS.forEach((column, index) => {
      row[column] = cells[index];
    });
    if (Object.values(row).some((value) => value.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Maps each Edge Log row's 13-agent `from`/`to` names onto the 4 runtime
 * role groups (see the module-level mapping note above). Rows naming an
 * agent that isn't one of the 13 documented names are dropped rather than
 * guessed at -- fail-closed the same way the rest of this harness treats
 * "unrecognized input" (`docs/SAFETY_ENFORCEMENT_POLICY.md` "모르면
 * 막는다").
 *
 * @param {Array<{from: string, to: string}>} edgeRows - rows shaped like
 *   parseEdgeLogs()'s output (only `from`/`to`/`weight` are read here; other
 *   fields are preserved as-is).
 * @returns {Array<object>} new row objects with `from`/`to` replaced by
 *   their role group. Never mutates the input rows.
 */
function mapToRoleGroups(edgeRows) {
  if (!Array.isArray(edgeRows)) {
    return [];
  }

  const mapped = [];
  for (const row of edgeRows) {
    if (!row || typeof row !== 'object') {
      continue;
    }
    const fromGroup = AGENT_TO_ROLE_GROUP[row.from];
    const toGroup = AGENT_TO_ROLE_GROUP[row.to];
    if (!fromGroup || !toGroup) {
      continue;
    }
    mapped.push({ ...row, from: fromGroup, to: toGroup });
  }
  return mapped;
}

/**
 * Aggregates role-group-mapped rows into 4x4 from/to counts, broken down by
 * `weight` (강함/보조/차단). Only weight categories that actually occur in
 * the data are ever present in the result -- no category is zero-filled
 * just because it exists in principle (`Edge Logs.md`'s own rule: "0~1
 * 사이의 소수점 확신도는 쓰지 않습니다... 실제 데이터가 쌓여야 채운다").
 *
 * Fail-closed: non-array input, or a row missing a mapped from/to/weight,
 * is skipped rather than thrown on -- the result is always the well-formed
 * `{ roleGroups, counts }` shape below, just with fewer/no counts.
 *
 * @param {Array<{from: string, to: string, weight: string}>} mappedRows -
 *   rows shaped like mapToRoleGroups()'s output.
 * @returns {{roleGroups: string[], counts: Object<string, Object<string, Object<string, number>>>}}
 *   `counts[fromGroup][toGroup][weight]` is the number of Edge Log rows
 *   observed for that exact (from, to, weight) combination.
 */
function aggregateMatrix(mappedRows) {
  const counts = {};
  if (Array.isArray(mappedRows)) {
    for (const row of mappedRows) {
      if (!row || typeof row !== 'object') {
        continue;
      }
      const { from, to, weight } = row;
      if (
        !ROLE_GROUPS.includes(from) ||
        !ROLE_GROUPS.includes(to) ||
        typeof weight !== 'string' ||
        weight.trim().length === 0
      ) {
        continue;
      }
      const w = weight.trim();
      counts[from] = counts[from] || {};
      counts[from][to] = counts[from][to] || {};
      counts[from][to][w] = (counts[from][to][w] || 0) + 1;
    }
  }
  return { roleGroups: ROLE_GROUPS, counts };
}

/**
 * @param {Object<string, number>|undefined} weightCounts
 * @returns {number}
 */
function cellTotal(weightCounts) {
  if (!weightCounts) {
    return 0;
  }
  return Object.values(weightCounts).reduce((sum, count) => sum + count, 0);
}

/**
 * Formats one matrix cell as "total (category:count, ...)", omitting the
 * breakdown when there's only one category (nothing to break down) and
 * leaving the cell blank when there's no data at all -- blank matches
 * `Connectivity Matrix.md`'s own template convention of an empty cell
 * meaning "no evidence recorded", rather than printing a fabricated "0".
 * @param {Object<string, number>|undefined} weightCounts
 * @returns {string}
 */
function formatCell(weightCounts) {
  const total = cellTotal(weightCounts);
  if (total === 0) {
    return '';
  }
  const categories = Object.keys(weightCounts);
  if (categories.length === 1) {
    return String(total);
  }
  const ordered = [...categories].sort((a, b) => {
    const ai = WEIGHT_DISPLAY_ORDER.indexOf(a);
    const bi = WEIGHT_DISPLAY_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
  const breakdown = ordered.map((category) => `${category}:${weightCounts[category]}`).join(', ');
  return `${total} (${breakdown})`;
}

/**
 * Renders `aggregateMatrix()`'s output as the markdown body of
 * `Connectivity Matrix.md`. Pure string builder -- never touches the
 * filesystem; `skills/obsidian-brain-update/SKILL.md` is responsible for
 * passing the result to the `Write` tool.
 *
 * Fail-closed: any input that isn't the well-formed `{ counts }` shape is
 * treated as an empty aggregate (an all-blank matrix), never thrown on.
 *
 * @param {{counts?: Object<string, Object<string, Object<string, number>>>}} aggregatedData
 * @returns {string}
 */
function renderConnectivityMatrix(aggregatedData) {
  const counts =
    aggregatedData && typeof aggregatedData === 'object' && aggregatedData.counts && typeof aggregatedData.counts === 'object'
      ? aggregatedData.counts
      : {};

  const headerRow = `| from \\ to | ${ROLE_GROUPS.join(' | ')} |`;
  const separatorRow = `| --- | ${ROLE_GROUPS.map(() => '---').join(' | ')} |`;
  const bodyRows = ROLE_GROUPS.map((from) => {
    const cells = ROLE_GROUPS.map((to) => formatCell((counts[from] || {})[to]));
    return `| ${from} | ${cells.join(' | ')} |`;
  });

  return [
    '---',
    'type: connectivity_matrix',
    'status: active',
    'updated: {date}',
    '---',
    '',
    '# Connectivity Matrix',
    '',
    '에이전트 런타임 역할 4가지가 서로 얼마나 강하게 영향을 주고받았는지 나타내는 표입니다. 행은 영향을 준 쪽, 열은 영향을 받은 쪽입니다.',
    '',
    '> `scripts/update-matrix.js`가 `Edge Logs.md` 누적 기록을 집계해 생성했습니다. 각 칸은 "총 횟수 (weight별 내역)" 형식이며, 실제 기록이 없는 칸은 비워둡니다(추정치를 채워 넣지 않습니다).',
    '',
    headerRow,
    separatorRow,
    ...bodyRows,
    ''
  ].join('\n');
}

/**
 * Picks the single weight category with the strictly-highest count for one
 * from/to pair. A tie between the top categories, or no data at all,
 * returns `null` -- "ambiguous" and "unknown" are both treated as "no
 * assertable dominant route" rather than guessing (same fail-closed spirit
 * as the rest of this module: don't state a conclusion the data doesn't
 * support).
 * @param {Object<string, number>|undefined} weightCounts
 * @returns {string|null}
 */
function dominantWeight(weightCounts) {
  if (!weightCounts) {
    return null;
  }
  let best = null;
  let bestCount = 0;
  let tied = false;
  for (const [category, count] of Object.entries(weightCounts)) {
    if (count > bestCount) {
      best = category;
      bestCount = count;
      tied = false;
    } else if (count === bestCount && bestCount > 0) {
      tied = true;
    }
  }
  return tied ? null : best;
}

/**
 * Compares two `aggregateMatrix()` snapshots (e.g. one taken before this
 * session's Edge Log rows and one taken after) and generates
 * `Rewire History.md` row strings for every (from, to) role-group pair
 * whose dominant weight category changed between the two snapshots.
 *
 * Fail-closed: non-object input (or input missing `.counts`) is treated as
 * an aggregate with zero data, never thrown on. No detected change returns
 * `[]`.
 *
 * @param {{counts?: object}} previousAggregate
 * @param {{counts?: object}} currentAggregate
 * @param {string} [date] - value for the "날짜" column; defaults to the
 *   `{date}` placeholder already used across vault-template files (the
 *   calling skill substitutes it, same convention as every other template).
 * @returns {string[]} zero or more `| 날짜 | 이전 라우팅 | 변경 라우팅 | 이유 |`
 *   row strings, ready to append to `Rewire History.md`'s table.
 */
function detectRewire(previousAggregate, currentAggregate, date) {
  const prevCounts =
    previousAggregate && typeof previousAggregate === 'object' && previousAggregate.counts && typeof previousAggregate.counts === 'object'
      ? previousAggregate.counts
      : {};
  const currCounts =
    currentAggregate && typeof currentAggregate === 'object' && currentAggregate.counts && typeof currentAggregate.counts === 'object'
      ? currentAggregate.counts
      : {};
  const dateLabel = typeof date === 'string' && date.length > 0 ? date : '{date}';

  const rows = [];
  for (const from of ROLE_GROUPS) {
    for (const to of ROLE_GROUPS) {
      const prevDominant = dominantWeight((prevCounts[from] || {})[to]);
      const currDominant = dominantWeight((currCounts[from] || {})[to]);
      if (prevDominant === currDominant) {
        continue;
      }
      const prevLabel = prevDominant || '연결 없음';
      const currLabel = currDominant || '연결 없음';
      const previousRouting = `${from} → ${to} (${prevLabel})`;
      const changedRouting = `${from} → ${to} (${currLabel})`;
      const reason = `Edge Logs 누적 집계에서 ${from} → ${to} 경로의 우세 weight가 ${prevLabel}에서 ${currLabel}로 바뀜`;
      rows.push(`| ${dateLabel} | ${previousRouting} | ${changedRouting} | ${reason} |`);
    }
  }
  return rows;
}

module.exports = {
  parseEdgeLogs,
  mapToRoleGroups,
  aggregateMatrix,
  renderConnectivityMatrix,
  detectRewire,
  AGENT_TO_ROLE_GROUP,
  ROLE_GROUPS
};

// CLI entry point (same rationale as scripts/select-meeting.js and
// scripts/select-parallel-council.js's own CLI blocks): a specific,
// auditable, side-effect-free command. Reads the Edge Logs.md file at the
// given path, runs parse -> map -> aggregate -> render, and prints the
// resulting Connectivity Matrix.md markdown to stdout. Never writes a file
// itself -- `skills/obsidian-brain-update/SKILL.md` is the one that takes
// this output and calls the `Write` tool, the same division of labor it
// already uses for the 7 vault files it owns directly.
if (require.main === module) {
  const fs = require('fs');
  const edgeLogsPath = process.argv[2];
  let markdownText = '';
  try {
    markdownText = edgeLogsPath ? fs.readFileSync(edgeLogsPath, 'utf8') : '';
  } catch (err) {
    markdownText = '';
  }
  const rows = parseEdgeLogs(markdownText);
  const mapped = mapToRoleGroups(rows);
  const aggregated = aggregateMatrix(mapped);
  process.stdout.write(renderConnectivityMatrix(aggregated) + '\n');
}
