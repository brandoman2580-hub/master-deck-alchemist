#!/usr/bin/env node
/**
 * Strategist chat-in eval — session CLI.
 *
 * Loads NEXT_PUBLIC_SUPABASE_* / SUPABASE_* from .env.development.local automatically.
 * Deck comes from an eval session (DeckType JSON or Supabase deck id), not from React state.
 *
 * Commands:
 *   start --deck-id <uuid>          Fetch deck + format from Supabase; open session
 *   start --deck <path/to.json>     Open session from exported DeckType JSON
 *   run [--ids A1,B2]               Run scenarios (+ goldens) against the active session
 *   end                             Close active session (ready for a new deck)
 *   status                          Show active session
 *   report [--all | --session id]   Aggregate pass/fail/warn/skip across runs
 *   promote --from <jsonl> --id A3  Append a regression golden stub from a fail row
 *
 * Goldens: scripts/strategist-eval/scenarios.json + goldens/*.jsonl
 * (repo-versioned — not a live DB table). Schema: golden-constraints.schema.json
 *
 * Auth: uses STRATEGIST_EVAL_TOKEN if set; otherwise mints a short-lived JWT with
 * SUPABASE_JWT_SECRET for the deck owner (local eval only).
 *
 * Docs: docs/strategist-eval-matrix.md
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import {
  classifyFlags,
  resolveScenarioFormat,
  scoreScenario,
  stubGoldenFromFail,
} from "./strategist-eval/score.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EVAL_DIR = path.join(ROOT, "scripts", "strategist-eval");
const SCENARIOS_PATH = path.join(EVAL_DIR, "scenarios.json");
const GOLDENS_DIR = path.join(EVAL_DIR, "goldens");
const REGRESSION_JSONL = path.join(GOLDENS_DIR, "regression.jsonl");
const OUT_DIR = path.join(ROOT, "reports", "strategist-eval");
const SESSION_DIR = path.join(OUT_DIR, "sessions");
const ACTIVE_PATH = path.join(SESSION_DIR, "active.json");

function loadEnvFiles() {
  for (const rel of [
    ".env.development.local",
    ".env.local",
    ".env.development",
    ".env",
  ]) {
    const p = path.join(ROOT, rel);
    if (fs.existsSync(p)) {
      dotenv.config({ path: p, override: false });
    }
  }
}

function env(name, fallback = "") {
  return (process.env[name] || fallback).trim();
}

function ensureDirs() {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function b64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString("base64url");
}

/**
 * Mint a short-lived authenticated JWT for local edge calls (eval only).
 */
function mintUserJwt(userId, secret, expiresInSec = 3600) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      sub: userId,
      role: "authenticated",
      aud: "authenticated",
      iss: "supabase",
      iat: now,
      exp: now + expiresInSec,
    }),
  );
  const data = `${header}.${payload}`;
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function toEngineFormat(mode) {
  return mode === "TCG" ? "TCG" : "MASTER_DUEL";
}

function countSectionEntries(cards) {
  const counts = new Map();
  for (const card of cards || []) {
    const id = Number(card?.id ?? card?.cardId);
    if (!Number.isFinite(id) || id <= 0) continue;
    // Expanded DeckType rows are one entry per copy; some payloads use id+count.
    const rawCount = Number(card?.count);
    const incr =
      Number.isFinite(rawCount) && rawCount > 0
        ? Math.min(3, Math.floor(rawCount))
        : 1;
    counts.set(id, (counts.get(id) ?? 0) + incr);
  }
  return [...counts.entries()].map(([id, count]) => ({
    id,
    count: Math.min(3, count),
  }));
}

/** Total physical copies in an id+count snapshot zone (not unique ID length). */
function sumSnapshotCopies(entries) {
  return (entries || []).reduce((acc, e) => acc + (Number(e?.count) || 0), 0);
}

/** Build Strategist snapshot from DeckType-shaped object. */
function snapshotFromDeckType(deck) {
  return {
    main: countSectionEntries(deck.mainDeck ?? deck.main ?? []),
    extra: countSectionEntries(deck.extraDeck ?? deck.extra ?? []),
    side: countSectionEntries(deck.sideDeck ?? deck.side ?? []),
  };
}

function normalizeDeckType(raw) {
  const cards = raw.cards || {};
  const main =
    raw.mainDeck ?? cards.main ?? raw.main ?? [];
  const extra =
    raw.extraDeck ?? cards.extra ?? raw.extra ?? [];
  const side =
    raw.sideDeck ?? cards.side ?? raw.side ?? [];
  return {
    id: String(raw.id),
    name: String(raw.name || "Eval deck"),
    mainDeck: Array.isArray(main) ? main : [],
    extraDeck: Array.isArray(extra) ? extra : [],
    sideDeck: Array.isArray(side) ? side : [],
    mode: raw.mode === "TCG" ? "TCG" : "Master Duel",
    updated_at: raw.updated_at,
    isPinned: Boolean(raw.isPinned ?? raw.is_pinned),
    user_id: raw.user_id || raw.userId || null,
  };
}

function readActiveSession() {
  if (!fs.existsSync(ACTIVE_PATH)) return null;
  return JSON.parse(fs.readFileSync(ACTIVE_PATH, "utf8"));
}

function writeActiveSession(session) {
  ensureDirs();
  fs.writeFileSync(ACTIVE_PATH, `${JSON.stringify(session, null, 2)}\n`, "utf8");
  const archive = path.join(SESSION_DIR, `${session.sessionId}.json`);
  fs.writeFileSync(archive, `${JSON.stringify(session, null, 2)}\n`, "utf8");
}

function clearActiveSession() {
  if (fs.existsSync(ACTIVE_PATH)) fs.unlinkSync(ACTIVE_PATH);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq !== -1) {
        const key = a.slice(2, eq);
        args[key] = a.slice(eq + 1);
        continue;
      }
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) args[key] = true;
      else {
        args[key] = next;
        i += 1;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Resolve deck id for `start`. Prefer positional args — npm 11+ swallows
 * `--deck-id` as an npm CLI config and never forwards it to the script.
 */
function resolveStartDeckTarget(args) {
  const positional = args._.slice(1); // after "start"
  const flagId =
    args["deck-id"] ||
    args.deckId ||
    args.deck_id ||
    env("STRATEGIST_EVAL_DECK_ID") ||
    "";
  const flagFile = args.deck || args.file || "";

  const uuidPos = positional.find((p) => UUID_RE.test(p));
  const filePos = positional.find(
    (p) => !UUID_RE.test(p) && /\.json$/i.test(p),
  );

  if (uuidPos || flagId) {
    return { kind: "id", value: uuidPos || flagId };
  }
  if (filePos || flagFile) {
    return { kind: "file", value: filePos || flagFile };
  }
  return null;
}

async function fetchDeckById(deckId, supabaseUrl, serviceKey) {
  const url = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/decks?id=eq.${encodeURIComponent(deckId)}&select=*`;
  const res = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch deck ${deckId}: HTTP ${res.status}`);
  }
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`Deck not found: ${deckId}`);
  }
  return normalizeDeckType(rows[0]);
}

function loadDeckFromFile(filePath) {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
  const raw = JSON.parse(fs.readFileSync(abs, "utf8"));
  return normalizeDeckType(raw);
}

function resolveAuthToken(session) {
  const explicit = env("STRATEGIST_EVAL_TOKEN");
  if (explicit) return { token: explicit, source: "STRATEGIST_EVAL_TOKEN" };

  const secret = env("SUPABASE_JWT_SECRET");
  const userId = session.deck?.user_id;
  if (secret && userId) {
    return {
      token: mintUserJwt(userId, secret),
      source: "minted_from_SUPABASE_JWT_SECRET",
    };
  }

  throw new Error(
    `No auth token available.
Add STRATEGIST_EVAL_TOKEN=<your access JWT> to .env.development.local
(or ensure SUPABASE_JWT_SECRET is set and the deck row has user_id for minting).
Copy the access_token from the browser Supabase session while logged in.`,
  );
}

function poisonSnapshot(base, unknownId) {
  const snap = base
    ? structuredClone(base)
    : { main: [{ id: 14558127, count: 3 }], extra: [], side: [] };
  snap.main = [...(snap.main || []), { id: unknownId, count: 1 }];
  return snap;
}

function loadJsonlRows(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, "utf8").trim();
  if (!text) return [];
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

/**
 * Merge seed scenarios with additive goldens/*.jsonl.
 * Later rows with the same id override earlier ones (regression can tighten seeds).
 */
function loadScenarioCatalog() {
  const catalog = JSON.parse(fs.readFileSync(SCENARIOS_PATH, "utf8"));
  const byId = new Map();
  for (const s of catalog.scenarios || []) {
    byId.set(s.id, s);
  }

  if (fs.existsSync(GOLDENS_DIR)) {
    const files = fs
      .readdirSync(GOLDENS_DIR)
      .filter((f) => f.endsWith(".jsonl"))
      .sort();
    for (const file of files) {
      for (const row of loadJsonlRows(path.join(GOLDENS_DIR, file))) {
        if (!row?.id || !row?.prompt) continue;
        const prev = byId.get(row.id);
        byId.set(row.id, prev ? { ...prev, ...row } : row);
      }
    }
  }

  return {
    version: catalog.version,
    scenarios: [...byId.values()],
    manualOnly: catalog.manualOnly || [],
  };
}

async function postChat({
  url,
  token,
  deckId,
  prompt,
  format,
  snapshot,
  mode = "auto",
}) {
  const body = {
    action: "chat",
    deck_id: deckId,
    user_query: prompt,
    question: prompt,
    mode,
    format,
    deck_snapshot: snapshot,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { error: text.slice(0, 500) };
  }
  json._httpStatus = res.status;
  return json;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function cmdStart(args) {
  const existing = readActiveSession();
  if (existing?.status === "active") {
    console.error(
      `Active session already open: ${existing.sessionId} (deck ${existing.deck?.name || existing.deckId}).
Run: npm run strategist:eval -- end
Then start again with the new deck.`,
    );
    process.exit(1);
  }

  const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL") || env("SUPABASE_URL");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL in .env files.");
    process.exit(1);
  }

  let deck;
  const target = resolveStartDeckTarget(args);
  if (!target) {
    console.error(`Usage (prefer positional — npm swallows --deck-id flags):
  npm run strategist:eval -- start <deck-uuid>
  npm run strategist:eval -- start path/to/DeckType.json
  node scripts/strategist-eval.mjs start --deck-id <uuid>`);
    process.exit(1);
  }

  if (target.kind === "id") {
    if (!serviceKey) {
      console.error(
        "Fetching by deck id requires SUPABASE_SERVICE_ROLE_KEY in .env.development.local",
      );
      process.exit(1);
    }
    deck = await fetchDeckById(target.value, supabaseUrl, serviceKey);
  } else {
    deck = loadDeckFromFile(target.value);
  }

  const session = {
    sessionId: `sess_${Date.now().toString(36)}`,
    status: "active",
    startedAt: new Date().toISOString(),
    endedAt: null,
    deckId: deck.id,
    format: toEngineFormat(deck.mode),
    deck: {
      id: deck.id,
      name: deck.name,
      mode: deck.mode,
      user_id: deck.user_id,
      mainDeck: deck.mainDeck,
      extraDeck: deck.extraDeck,
      sideDeck: deck.sideDeck,
    },
    snapshot: snapshotFromDeckType(deck),
    runs: [],
  };

  writeActiveSession(session);
  const mainCopies = sumSnapshotCopies(session.snapshot.main);
  const extraCopies = sumSnapshotCopies(session.snapshot.extra);
  const sideCopies = sumSnapshotCopies(session.snapshot.side);
  console.log(`Session started: ${session.sessionId}
  Deck: ${session.deck.name} (${session.deckId})
  Mode: ${session.deck.mode} → format ${session.format}
  Cards (copies): main=${mainCopies} extra=${extraCopies} side=${sideCopies}
  Unique IDs: main=${session.snapshot.main.length} extra=${session.snapshot.extra.length} side=${session.snapshot.side.length}

Next: npm run strategist:eval -- run
End:  npm run strategist:eval -- end`);
}

async function cmdEnd() {
  const session = readActiveSession();
  if (!session) {
    console.log("No active session.");
    return;
  }
  session.status = "ended";
  session.endedAt = new Date().toISOString();
  writeActiveSession(session);
  clearActiveSession();
  // Keep archive with ended status
  const archive = path.join(SESSION_DIR, `${session.sessionId}.json`);
  fs.writeFileSync(archive, `${JSON.stringify(session, null, 2)}\n`, "utf8");
  console.log(`Session ended: ${session.sessionId}
Runs: ${session.runs.length}
You can start a new session with another deck.`);
}

function cmdStatus() {
  const session = readActiveSession();
  if (!session) {
    console.log("No active session. Start with: npm run strategist:eval -- start --deck-id <uuid>");
    return;
  }
  console.log(JSON.stringify({
    sessionId: session.sessionId,
    status: session.status,
    deckId: session.deckId,
    deckName: session.deck?.name,
    format: session.format,
    cardCopies: {
      main: sumSnapshotCopies(session.snapshot?.main),
      extra: sumSnapshotCopies(session.snapshot?.extra),
      side: sumSnapshotCopies(session.snapshot?.side),
    },
    uniqueIds: {
      main: session.snapshot?.main?.length ?? 0,
      extra: session.snapshot?.extra?.length ?? 0,
      side: session.snapshot?.side?.length ?? 0,
    },
    runs: session.runs,
    startedAt: session.startedAt,
  }, null, 2));
}

async function cmdRun(args) {
  const session = readActiveSession();
  if (!session || session.status !== "active") {
    console.error(
      `No active session. Start one first:\n  npm run strategist:eval -- start --deck-id <uuid>`,
    );
    process.exit(1);
  }

  const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL") || env("SUPABASE_URL");
  const { token, source } = resolveAuthToken(session);
  const delayMs = Number(env("STRATEGIST_EVAL_DELAY_MS", "800")) || 800;
  const idFilter = String(
    args.ids ||
      args._[1] ||
      env("STRATEGIST_EVAL_IDS") ||
      "",
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const catalog = loadScenarioCatalog();
  let scenarios = catalog.scenarios || [];
  if (idFilter.length) {
    scenarios = scenarios.filter((s) => idFilter.includes(s.id));
  }

  const endpoint = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/strategist`;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonlPath = path.join(
    OUT_DIR,
    `${session.sessionId}_${stamp}.jsonl`,
  );
  const mdPath = path.join(
    OUT_DIR,
    `${session.sessionId}_${stamp}-summary.md`,
  );

  const baseSnapshot = session.snapshot;
  const defaultFormat = session.format;
  const lines = [];
  let pass = 0;
  let fail = 0;
  let warn = 0;
  let skip = 0;

  const summary = [
    `# Strategist eval run`,
    "",
    `- Session: \`${session.sessionId}\``,
    `- Deck: ${session.deck?.name} (\`${session.deckId}\`)`,
    `- Format default: \`${defaultFormat}\``,
    `- Auth: ${source}`,
    `- Scenarios: ${scenarios.length}`,
    "",
    "| ID | Result | Mode | Redirect | Flags |",
    "|---|---|---|---|---|",
  ];

  console.log(
    `Running ${scenarios.length} scenarios (session ${session.sessionId}, auth=${source})`,
  );

  for (const scenario of scenarios) {
    const formatResolution = resolveScenarioFormat(scenario, defaultFormat);
    if (formatResolution.skip) {
      skip += 1;
      const flags = [`skip_${formatResolution.skipReason}`];
      const row = {
        sessionId: session.sessionId,
        deckId: session.deckId,
        deckName: session.deck?.name,
        id: scenario.id,
        group: scenario.group,
        format: defaultFormat,
        prompt: scenario.prompt,
        elapsedMs: 0,
        httpStatus: null,
        mode: null,
        redirectHint: null,
        softFlags: flags,
        verdict: "skip",
        expectNotes:
          scenario.constraints?.notes || scenario.expect?.notes || null,
      };
      lines.push(JSON.stringify(row));
      console.log(`  ${scenario.id}… SKIP ${formatResolution.skipReason}`);
      summary.push(
        `| ${row.id} | **skip** | — | — | ${flags.join(", ")} |`,
      );
      continue;
    }

    const format = formatResolution.format;
    let snapshot = baseSnapshot;
    if (scenario.injectUnknownCardId) {
      snapshot = poisonSnapshot(baseSnapshot, scenario.injectUnknownCardId);
    }

    process.stdout.write(`  ${scenario.id}… `);
    const started = Date.now();
    let result;
    try {
      result = await postChat({
        url: endpoint,
        token,
        deckId: session.deckId,
        prompt: scenario.prompt,
        format,
        snapshot,
      });
    } catch (err) {
      result = {
        _httpStatus: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    const flags = scoreScenario(scenario, result);
    const verdict = classifyFlags(flags);
    if (verdict === "pass") pass += 1;
    else if (verdict === "warn") warn += 1;
    else if (verdict === "skip") skip += 1;
    else fail += 1;

    const coach = result.coach || {};
    const row = {
      sessionId: session.sessionId,
      deckId: session.deckId,
      deckName: session.deck?.name,
      id: scenario.id,
      group: scenario.group,
      format,
      prompt: scenario.prompt,
      elapsedMs: Date.now() - started,
      httpStatus: result._httpStatus,
      mode: result.mode || coach.mode || null,
      redirectHint: coach.redirectHint ?? result.redirectHint ?? null,
      confidence: result.confidence || coach.confidence || null,
      answer: String(result.answer || result.text || coach.answer || "").slice(
        0,
        2400,
      ),
      limitations: result.limitations || coach.limitations || [],
      evidence: result.evidence || coach.evidence || [],
      tuning: result.tuning ?? coach.tuning ?? null,
      synergies: result.synergies ?? coach.synergies ?? null,
      error: result.error || null,
      softFlags: flags,
      verdict,
      expectNotes:
        scenario.constraints?.notes || scenario.expect?.notes || null,
    };

    lines.push(JSON.stringify(row));
    console.log(
      `${verdict.toUpperCase()} mode=${row.mode || "-"} redirect=${row.redirectHint || "-"}`,
    );
    summary.push(
      `| ${row.id} | **${verdict}** | ${row.mode || "—"} | ${row.redirectHint || "—"} | ${flags.join(", ") || "—"} |`,
    );

    if (delayMs > 0) await sleep(delayMs);
  }

  fs.writeFileSync(jsonlPath, `${lines.join("\n")}\n`, "utf8");
  summary.push(
    "",
    `## Totals`,
    "",
    `- Pass: ${pass}`,
    `- Warn: ${warn}`,
    `- Fail: ${fail}`,
    `- Skip: ${skip}`,
    "",
    "## Manual-only",
    "",
  );
  for (const m of catalog.manualOnly || []) {
    summary.push(`- **${m.id}:** ${m.steps}`);
  }
  summary.push(
    "",
    `Full rows: \`${path.relative(ROOT, jsonlPath)}\``,
    "",
    "Promote a fail into goldens: `npm run strategist:eval -- promote --from <jsonl> --id <ID>`",
    "",
    "Aggregate later: `npm run strategist:eval -- report`",
  );
  fs.writeFileSync(mdPath, `${summary.join("\n")}\n`, "utf8");

  session.runs.push({
    at: new Date().toISOString(),
    jsonl: path.relative(ROOT, jsonlPath).replace(/\\/g, "/"),
    summary: path.relative(ROOT, mdPath).replace(/\\/g, "/"),
    pass,
    warn,
    fail,
    skip,
  });
  writeActiveSession(session);

  console.log(`\nPass ${pass} | Warn ${warn} | Fail ${fail} | Skip ${skip}
Wrote:\n  ${jsonlPath}\n  ${mdPath}`);
}

function cmdReport(args) {
  ensureDirs();
  const sessionFilter = args.session || null;
  const all = Boolean(args.all) || !sessionFilter;

  let files = fs
    .readdirSync(OUT_DIR)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => path.join(OUT_DIR, f));

  if (sessionFilter) {
    files = files.filter((f) => path.basename(f).startsWith(sessionFilter));
  } else if (!all) {
    const active = readActiveSession();
    if (active) {
      files = files.filter((f) =>
        path.basename(f).startsWith(active.sessionId),
      );
    }
  }

  if (files.length === 0) {
    console.error("No JSONL runs found under reports/strategist-eval/");
    process.exit(1);
  }

  const rows = [];
  for (const f of files) {
    for (const row of loadJsonlRows(f)) {
      rows.push({ ...row, _file: path.relative(ROOT, f).replace(/\\/g, "/") });
    }
  }

  let pass = 0;
  let fail = 0;
  let warn = 0;
  let skip = 0;
  const byId = new Map();
  const errors = [];

  for (const row of rows) {
    const verdict =
      row.verdict ||
      classifyFlags(row.softFlags || []);
    if (verdict === "pass") pass += 1;
    else if (verdict === "warn") warn += 1;
    else if (verdict === "skip") skip += 1;
    else fail += 1;

    if (!byId.has(row.id)) byId.set(row.id, []);
    byId.get(row.id).push({ ...row, verdict });

    if (row.error || (row.httpStatus && row.httpStatus >= 400)) {
      errors.push({
        id: row.id,
        sessionId: row.sessionId,
        httpStatus: row.httpStatus,
        error: row.error,
        file: row._file,
      });
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(OUT_DIR, `aggregate-report_${stamp}.md`);
  const lines = [
    `# Strategist eval aggregate report`,
    "",
    `- Generated: ${new Date().toISOString()}`,
    `- Runs (jsonl files): ${files.length}`,
    `- Rows: ${rows.length}`,
    `- Pass: **${pass}** | Warn: **${warn}** | Fail: **${fail}** | Skip: **${skip}**`,
    "",
    "## By scenario ID",
    "",
    "| ID | Latest verdict | Runs | Fail/skip flags (latest) |",
    "|---|---|---|---|",
  ];

  const ids = [...byId.keys()].sort();
  for (const id of ids) {
    const list = byId.get(id);
    const latest = list[list.length - 1];
    const failFlags = (latest.softFlags || [])
      .filter(
        (f) =>
          f.startsWith("fail_") ||
          f.startsWith("warn_") ||
          f.startsWith("skip_"),
      )
      .join(", ");
    lines.push(
      `| ${id} | **${latest.verdict}** | ${list.length} | ${failFlags || "—"} |`,
    );
  }

  lines.push("", "## Failures & errors", "");
  const failedRows = rows.filter(
    (r) => (r.verdict || classifyFlags(r.softFlags || [])) === "fail",
  );
  if (failedRows.length === 0 && errors.length === 0) {
    lines.push("_None._");
  } else {
    for (const r of failedRows) {
      lines.push(
        `### ${r.id} (${r.sessionId || "—"})`,
        "",
        `- File: \`${r._file}\``,
        `- Mode: ${r.mode || "—"} | HTTP: ${r.httpStatus ?? "—"}`,
        `- Flags: ${(r.softFlags || []).join(", ")}`,
        `- Answer excerpt: ${String(r.answer || "").slice(0, 280)}`,
        `- Promote: \`npm run strategist:eval -- promote --from ${r._file} --id ${r.id}\``,
        "",
      );
    }
    for (const e of errors) {
      lines.push(
        `- **${e.id}** HTTP ${e.httpStatus}: ${e.error || "(no message)"} (\`${e.file}\`)`,
      );
    }
  }

  lines.push(
    "",
    "## Triage tags",
    "",
    "routing | grounding | banlist | tone | CTA | honesty | actionable_clamp",
  );

  fs.writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");
  console.log(`Pass ${pass} | Warn ${warn} | Fail ${fail} | Skip ${skip}
Wrote ${reportPath}`);
}

function cmdPromote(args) {
  const fromRel =
    args.from ||
    args.file ||
    args._[1] ||
    "";
  const id = String(args.id || args._[2] || "").trim();
  if (!fromRel || !id) {
    console.error(`Usage:
  npm run strategist:eval -- promote --from reports/strategist-eval/<run>.jsonl --id A3
  node scripts/strategist-eval.mjs promote --from <jsonl> --id <ID>`);
    process.exit(1);
  }

  const abs = path.isAbsolute(fromRel) ? fromRel : path.join(ROOT, fromRel);
  if (!fs.existsSync(abs)) {
    console.error(`JSONL not found: ${abs}`);
    process.exit(1);
  }

  const rows = loadJsonlRows(abs);
  const matches = rows.filter((r) => r.id === id);
  if (matches.length === 0) {
    console.error(`No rows with id=${id} in ${abs}`);
    process.exit(1);
  }
  const row = matches[matches.length - 1];
  if (row.verdict === "pass") {
    console.error(
      `Latest row for ${id} is pass — promote is for fails. Override with --force if needed.`,
    );
    if (!args.force) process.exit(1);
  }

  const stub = stubGoldenFromFail({ ...row, _file: path.relative(ROOT, abs).replace(/\\/g, "/") });
  fs.mkdirSync(GOLDENS_DIR, { recursive: true });
  fs.appendFileSync(REGRESSION_JSONL, `${JSON.stringify(stub)}\n`, "utf8");
  console.log(`Appended regression golden ${stub.id}
  → ${path.relative(ROOT, REGRESSION_JSONL)}
Edit constraints (forbidRecommendNames / requireRefuseNames / answerMustMatch), then re-run eval.`);
}

function printHelp() {
  console.log(`Strategist eval CLI

  npm run strategist:eval -- start <deck-uuid>
  npm run strategist:eval -- start path/to/DeckType.json
  npm run strategist:eval -- run
  npm run strategist:eval -- run A1,B2,E3
  npm run strategist:eval -- end
  npm run strategist:eval -- status
  npm run strategist:eval -- report
  npm run strategist:eval -- promote --from <jsonl> --id A3

Goldens: scripts/strategist-eval/scenarios.json + goldens/*.jsonl
Schema: scripts/strategist-eval/golden-constraints.schema.json

Note: On npm 11+, do NOT use --deck-id / --ids flags via \`npm run\` —
npm treats them as its own CLI config and strips them. Use positional args
(shown above) or call node directly:
  node scripts/strategist-eval.mjs start --deck-id <uuid>

Env is loaded from .env.development.local (and .env*). See docs/strategist-eval-matrix.md`);
}

async function main() {
  loadEnvFiles();
  ensureDirs();
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0] || "help";

  switch (cmd) {
    case "start":
      await cmdStart(args);
      break;
    case "run":
      await cmdRun(args);
      break;
    case "end":
      await cmdEnd();
      break;
    case "status":
      cmdStatus();
      break;
    case "report":
      cmdReport(args);
      break;
    case "promote":
      cmdPromote(args);
      break;
    case "help":
    default:
      printHelp();
      if (cmd !== "help") process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
