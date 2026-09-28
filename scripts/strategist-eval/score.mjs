/**
 * Pure golden constraint scorers for Strategist eval (Node ESM).
 * Keep behavior in sync with lib/eval/strategist-golden-score.ts (Jest source of truth).
 */

const CASUAL_RE =
  /\byo\b|\bbro\b|let'?s slide this out|solid pick|\bdialed\b|\bspicy\b|\bhype\b/i;

const REFUSE_WINDOW_RE =
  /\b(can'?t|cannot|couldn'?t|shouldn'?t|won'?t|do not|don'?t|never|not|no|forbidden|banned|illegal|not legal|not allowed|refuse|avoid|against (the )?banlist)\b/i;

const RECOMMEND_VERB_RE =
  /\b(add|run|play|include|splash|tech|main|side|recommend|consider (?:adding|running|playing))\b/i;

export function isRecommendFraming(blob, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nameRe = new RegExp(escaped, "ig");
  let match;
  while ((match = nameRe.exec(blob)) !== null) {
    const start = Math.max(0, match.index - 80);
    const end = Math.min(blob.length, match.index + name.length + 80);
    const window = blob.slice(start, end);
    if (REFUSE_WINDOW_RE.test(window)) continue;
    if (RECOMMEND_VERB_RE.test(window)) return true;
  }
  return false;
}

function structuredMentionsName(result, name) {
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

export function resolveConstraints(scenario) {
  return {
    ...(scenario.expect || {}),
    ...(scenario.constraints || {}),
  };
}

export function resolveFormatPolicy(scenario) {
  if (scenario.formatPolicy) return scenario.formatPolicy;
  if (scenario.format) return "match_session";
  return "any";
}

export function resolveScenarioFormat(scenario, sessionFormat) {
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
  return { format: scenario.format, skip: false };
}

function answerBlob(result) {
  return String(
    result.answer ||
      result.text ||
      result.coach?.answer ||
      result.error ||
      "",
  );
}

function recommendBlob(result) {
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

export function scoreScenario(scenario, result) {
  const flags = [];
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
    if (expect.modes.includes(mode)) flags.push(`ok_mode_${mode}`);
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
      flags.push(
        `fail_forbidden_answer_fragment:${String(needle).slice(0, 40)}`,
      );
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
      if (re.test(answer)) {
        flags.push(`fail_answer_matched_forbid:${source.slice(0, 40)}`);
      } else {
        flags.push("ok_answer_avoids_pattern");
      }
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
    let match;
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

export function classifyFlags(flags) {
  if (flags.some((f) => f.startsWith("skip_"))) return "skip";
  const fails = flags.filter((f) => f.startsWith("fail_"));
  const warns = flags.filter((f) => f.startsWith("warn_"));
  if (fails.length) return "fail";
  if (warns.length) return "warn";
  return "pass";
}

export function stubGoldenFromFail(row) {
  const id = String(row.id || "REG");
  const failFlags = (row.softFlags || []).filter((f) => f.startsWith("fail_"));
  return {
    id: `${id}-reg-${Date.now().toString(36)}`,
    group: row.group || "regression",
    prompt: String(row.prompt || ""),
    format: row.format,
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
