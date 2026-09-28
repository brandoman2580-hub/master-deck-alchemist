/**
 * Deterministic scorers for Strategist chat-in golden constraints.
 * Shared by Jest and the eval CLI (via scripts/strategist-eval/score.mjs mirror).
 *
 * Goldens live in-repo (scenarios.json + goldens/*.jsonl), not a live DB table —
 * eval cases are reviewable CI artifacts that grow from real fails.
 */

export type EvalVerdict = "pass" | "fail" | "warn" | "skip";

export interface GoldenConstraints {
  modes?: string[];
  forbidCasualTone?: boolean;
  redirectHint?: string | null;
  forbidRedirectHints?: string[];
  httpError?: boolean;
  mustContainAnswer?: string[];
  mustNotContainAnswer?: string[];
  /** RegExp source strings (case-insensitive unless flag in pattern). */
  answerMustMatch?: string[];
  answerMustNotMatch?: string[];
  /**
   * Card names that must not appear as add/run/play recommendations.
   * Mentions in refuse/ban context are allowed.
   */
  forbidRecommendNames?: string[];
  /** Card names that must appear near refuse / ban / illegal language. */
  requireRefuseNames?: string[];
  /** Soft grounding: names that should appear somewhere in the answer. */
  requiredEntities?: string[];
  /** Out-of-bounds / meta / weather style prompts. */
  oob?: boolean;
  notes?: string;
}

export type FormatPolicy = "match_session" | "require_format" | "any";

export interface GoldenScenario {
  id: string;
  group?: string;
  prompt: string;
  format?: "MASTER_DUEL" | "TCG" | string;
  /**
   * How scenario.format interacts with the session deck format.
   * - match_session (default when format set): skip if formats differ
   * - require_format: send scenario.format even on a mismatched deck
   * - any: ignore scenario.format; use session format
   */
  formatPolicy?: FormatPolicy;
  injectUnknownCardId?: number;
  constraints?: GoldenConstraints;
  /** @deprecated Prefer `constraints`. Still read for back-compat. */
  expect?: GoldenConstraints & Record<string, unknown>;
  source?: {
    type?: "seed" | "promoted_fail" | string;
    at?: string;
    fromFile?: string;
    notes?: string;
  };
}

export interface ScoreableResult {
  _httpStatus?: number;
  error?: string | null;
  answer?: string;
  text?: string;
  mode?: string | null;
  redirectHint?: string | null;
  synergies?: Array<{ title?: string; cardName?: string }>;
  recommendations?: Array<{ cardName?: string; title?: string }>;
  coach?: {
    answer?: string;
    mode?: string | null;
    redirectHint?: string | null;
    synergies?: Array<{ title?: string; cardName?: string }>;
    recommendations?: Array<{ cardName?: string; title?: string }>;
  };
}

const CASUAL_RE =
  /\byo\b|\bbro\b|let'?s slide this out|solid pick|\bdialed\b|\bspicy\b|\bhype\b/i;

const REFUSE_WINDOW_RE =
  /\b(can'?t|cannot|couldn'?t|shouldn'?t|won'?t|do not|don'?t|never|not|no|forbidden|banned|illegal|not legal|not allowed|refuse|avoid|against (the )?banlist)\b/i;

const RECOMMEND_VERB_RE =
  /\b(add|run|play|include|splash|tech|main|side|recommend|consider (?:adding|running|playing))\b/i;

/**
 * True when `name` is framed as something to add/run (not refused).
 */
export function isRecommendFraming(blob: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nameRe = new RegExp(escaped, "ig");
  let match: RegExpExecArray | null;
  while ((match = nameRe.exec(blob)) !== null) {
    const start = Math.max(0, match.index - 80);
    const end = Math.min(blob.length, match.index + name.length + 80);
    const window = blob.slice(start, end);
    if (REFUSE_WINDOW_RE.test(window)) continue;
    if (RECOMMEND_VERB_RE.test(window)) return true;
  }

  // Structured actionables: name in synergies/recs without refuse in title.
  return false;
}

function structuredMentionsName(
  result: ScoreableResult,
  name: string,
): boolean {
  const syn = [
    ...(result.synergies || []),
    ...(result.coach?.synergies || []),
  ];
  const recs = [
    ...(result.recommendations || []),
    ...(result.coach?.recommendations || []),
  ];
  const needle = name.toLowerCase();
  for (const row of [...syn, ...recs]) {
    const title = String(row.title || row.cardName || "").toLowerCase();
    if (title.includes(needle)) return true;
  }
  return false;
}

export function resolveConstraints(
  scenario: GoldenScenario,
): GoldenConstraints {
  return {
    ...(scenario.expect || {}),
    ...(scenario.constraints || {}),
  };
}

export function resolveFormatPolicy(scenario: GoldenScenario): FormatPolicy {
  if (scenario.formatPolicy) return scenario.formatPolicy;
  if (scenario.format) return "match_session";
  return "any";
}

/**
 * Decide request format / skip before HTTP.
 */
export function resolveScenarioFormat(
  scenario: GoldenScenario,
  sessionFormat: string,
): { format: string; skip: boolean; skipReason?: string } {
  const policy = resolveFormatPolicy(scenario);
  if (policy === "any" || !scenario.format) {
    return { format: sessionFormat, skip: false };
  }
  if (policy === "match_session") {
    if (scenario.format !== sessionFormat) {
      return {
        format: sessionFormat,
        skip: true,
        skipReason: `format_mismatch_want_${scenario.format}_session_${sessionFormat}`,
      };
    }
    return { format: sessionFormat, skip: false };
  }
  // require_format
  return { format: scenario.format, skip: false };
}

function answerBlob(result: ScoreableResult): string {
  return String(
    result.answer ||
      result.text ||
      result.coach?.answer ||
      result.error ||
      "",
  );
}

function recommendBlob(result: ScoreableResult): string {
  const answer = answerBlob(result);
  const syn = [
    ...(result.synergies || []),
    ...(result.coach?.synergies || []),
  ]
    .map((s) => s.title || s.cardName || "")
    .join(" ");
  const recs = [
    ...(result.recommendations || []),
    ...(result.coach?.recommendations || []),
  ]
    .map((r) => r.cardName || r.title || "")
    .join(" ");
  return `${answer}\n${syn}\n${recs}`;
}

/**
 * Score one scenario against a coach HTTP result.
 * Returns soft flags; classifyFlags maps them to a verdict.
 */
export function scoreScenario(
  scenario: GoldenScenario,
  result: ScoreableResult,
): string[] {
  const flags: string[] = [];
  const expect = resolveConstraints(scenario);
  const answer = answerBlob(result);
  const mode = result.mode || result.coach?.mode;
  const redirectHint =
    result.coach?.redirectHint ?? result.redirectHint ?? null;
  const status = result._httpStatus ?? 200;

  if (expect.httpError) {
    if (status >= 400 || result.error) flags.push("ok_http_error");
    else flags.push("fail_expected_http_error");
    return flags;
  }

  if (status >= 400) {
    flags.push(`fail_http_${status}`);
    return flags;
  }

  if (expect.forbidCasualTone && CASUAL_RE.test(answer)) {
    flags.push("fail_casual_tone");
  } else if (expect.forbidCasualTone) {
    flags.push("ok_tone");
  }

  if (expect.modes?.length) {
    if (expect.modes.includes(String(mode))) flags.push(`ok_mode_${mode}`);
    else {
      flags.push(
        `fail_mode_got_${mode || "none"}_want_${expect.modes.join("|")}`,
      );
    }
  }

  if (expect.redirectHint) {
    if (redirectHint === expect.redirectHint) {
      flags.push(`ok_redirect_${redirectHint}`);
    } else {
      flags.push(
        `fail_redirect_got_${redirectHint || "none"}_want_${expect.redirectHint}`,
      );
    }
  }

  for (const hint of expect.forbidRedirectHints || []) {
    if (redirectHint === hint) flags.push(`fail_unexpected_redirect_${hint}`);
  }

  for (const needle of expect.mustContainAnswer || []) {
    if (answer.toLowerCase().includes(String(needle).toLowerCase())) {
      flags.push("ok_answer_contains");
    } else {
      flags.push(`fail_missing_answer_fragment:${String(needle).slice(0, 40)}`);
    }
  }

  for (const needle of expect.mustNotContainAnswer || []) {
    if (answer.toLowerCase().includes(String(needle).toLowerCase())) {
      flags.push(`fail_forbidden_answer_fragment:${String(needle).slice(0, 40)}`);
    } else {
      flags.push("ok_answer_omits_fragment");
    }
  }

  for (const source of expect.answerMustMatch || []) {
    try {
      const re = new RegExp(source, "i");
      if (re.test(answer)) flags.push("ok_answer_match");
      else flags.push(`fail_answer_unmatched:${source.slice(0, 40)}`);
    } catch {
      flags.push(`fail_bad_regex:${source.slice(0, 24)}`);
    }
  }

  for (const source of expect.answerMustNotMatch || []) {
    try {
      const re = new RegExp(source, "i");
      if (re.test(answer)) flags.push(`fail_answer_matched_forbid:${source.slice(0, 40)}`);
      else flags.push("ok_answer_avoids_pattern");
    } catch {
      flags.push(`fail_bad_regex:${source.slice(0, 24)}`);
    }
  }

  const blob = recommendBlob(result);
  for (const name of expect.forbidRecommendNames || []) {
    const structured = structuredMentionsName(result, name);
    const framed = isRecommendFraming(blob, name);
    if (structured || framed) {
      flags.push(`fail_recommended_${name.slice(0, 24)}`);
    } else {
      flags.push("ok_no_forbidden_rec");
    }
  }

  for (const name of expect.requireRefuseNames || []) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const nameRe = new RegExp(escaped, "i");
    if (!nameRe.test(answer)) {
      flags.push(`fail_missing_refuse_name:${name.slice(0, 24)}`);
      continue;
    }
    let refused = false;
    let match: RegExpExecArray | null;
    const global = new RegExp(escaped, "ig");
    while ((match = global.exec(answer)) !== null) {
      const start = Math.max(0, match.index - 80);
      const end = Math.min(answer.length, match.index + name.length + 80);
      if (REFUSE_WINDOW_RE.test(answer.slice(start, end))) {
        refused = true;
        break;
      }
    }
    if (refused) flags.push("ok_refuse_name");
    else flags.push(`fail_name_without_refuse:${name.slice(0, 24)}`);
  }

  for (const name of expect.requiredEntities || []) {
    if (answer.toLowerCase().includes(name.toLowerCase())) {
      flags.push("ok_required_entity");
    } else {
      flags.push(`fail_missing_entity:${name.slice(0, 24)}`);
    }
  }

  if (
    expect.oob &&
    !redirectHint &&
    !/limited to information|cannot design|out of scope|Meta|tier/i.test(
      answer,
    )
  ) {
    flags.push("warn_oob_unclear");
  }

  return flags;
}

export function classifyFlags(flags: string[]): EvalVerdict {
  if (flags.some((f) => f.startsWith("skip_"))) return "skip";
  const fails = flags.filter((f) => f.startsWith("fail_"));
  const warns = flags.filter((f) => f.startsWith("warn_"));
  if (fails.length) return "fail";
  if (warns.length) return "warn";
  return "pass";
}

/**
 * Build a regression golden stub from a failed JSONL row for human editing.
 */
export function stubGoldenFromFail(row: {
  id?: string;
  prompt?: string;
  format?: string;
  group?: string;
  answer?: string;
  mode?: string | null;
  redirectHint?: string | null;
  softFlags?: string[];
  _file?: string;
}): GoldenScenario {
  const id = String(row.id || "REG");
  const failFlags = (row.softFlags || []).filter((f) => f.startsWith("fail_"));
  return {
    id: `${id}-reg-${Date.now().toString(36)}`,
    group: row.group || "regression",
    prompt: String(row.prompt || ""),
    format: row.format as GoldenScenario["format"],
    formatPolicy: row.format ? "match_session" : "any",
    source: {
      type: "promoted_fail",
      at: new Date().toISOString(),
      fromFile: row._file,
      notes: `Promoted from fail flags: ${failFlags.join(", ") || "unknown"}. Answer excerpt: ${String(row.answer || "").slice(0, 280)}`,
    },
    constraints: {
      forbidCasualTone: true,
      modes: row.mode ? [String(row.mode)] : undefined,
      redirectHint: row.redirectHint ?? undefined,
      notes:
        "Fill forbidRecommendNames / requireRefuseNames / answerMustMatch from the failing answer, then re-run.",
    },
  };
}
