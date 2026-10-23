// The plugin's contract test — an integration rehearsal of exactly what
// plugin/main.ts does over HTTP, against a SCRATCH pool (own port, own
// database) so the learning pool stays seed-clean no matter how often this runs.
//
// Run: npm test   (spawns server on :3101, waits, asserts, shuts down)
//
// Contract exercised (routes/publish.js):
//   200 {ok, entryId, payoffPath, replaced, createdAccount}
//   401 {ok:false, error}  — wrong password on an existing account
//   422 {ok:false, error}  — banned word refused, nothing written
//   400 {ok:false, error}  — malformed body
//   tag normalization: only the seven chips survive, case/#-insensitive

import { spawn } from "node:child_process";
import { rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

const PORT = 3101;
const BASE = `http://localhost:${PORT}`;
const scratch = mkdtempSync(join(tmpdir(), "opencode", "das-contract-"));
const creds = { username: "contract-ghost", password: "paperlamp9" };

let failures = 0;
function check(name, cond, detail = "") {
  console.log(`${cond ? "  ok" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

async function publish(body) {
  const res = await fetch(`${BASE}/api/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON body — leave null, tests assert on status too */
  }
  return { status: res.status, data };
}

// --- spawn the scratch server, wait for readiness ---
const child = spawn(process.execPath, ["webapp/server.js"], {
  env: { ...process.env, PORT: String(PORT), DIARY_DATA_DIR: join(scratch, "pool") },
  stdio: "ignore",
});

let ready = false;
for (let i = 0; i < 50 && !ready; i++) {
  await new Promise((r) => setTimeout(r, 150));
  ready = await fetch(`${BASE}/`)
    .then((r) => r.ok)
    .catch(() => false);
}

try {
  if (!ready) throw new Error("scratch server never got ready on " + BASE);

  // 0a — the Obsidian renderer preflights cross-origin POSTs; the pool must
  // answer them (real-world: the plugin's first send died silently here).
  const pf = await fetch(`${BASE}/api/publish`, {
    method: "OPTIONS",
    headers: {
      Origin: "app://obsidian.md",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  check("preflight OPTIONS /api/publish → 204", pf.status === 204);
  check(
    'preflight allows app://obsidian.md + content-type',
    pf.headers.get("access-control-allow-origin") === "app://obsidian.md" &&
      pf.headers.get("access-control-allow-headers") === "content-type"
  );

  // 0b — the same POST with a browser-style Origin header must succeed: the
  // CORS layer admits the app origin without loosening anything else.
  const crossOrigin = await publish({
    ...creds,
    username: "origin-ghost",
    text: "Cross-origin publish from a sandboxed window.",
    tags: [],
  });
  check("POST with Origin app://obsidian.md → 200 ok", crossOrigin.status === 200 && crossOrigin.data?.ok === true);

  // 0c — a malformed body gets a quiet JSON 400, never a stack trace or engine header.
  const badBody = await fetch(`${BASE}/api/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "app://obsidian.md" },
    body: "{not json",
  });
  const badData = await badBody.json().catch(() => ({}));
  check("invalid JSON → quiet 400 JSON", badBody.status === 400 && badData?.ok === false);
  check("responses carry no engine header", badBody.headers.get("x-powered-by") === null);

  // 1 — first publish: creates the account and the entry, in one motion.
  const v1 = await publish({
    ...creds,
    text: "The kettle sighed before I did tonight. Somewhere between the second cup and the window, the day forgave itself.",
    tags: ["#Tired", "sugarplum", "Late Night"],
  });
  check("first publish → 200 ok", v1.status === 200 && v1.data?.ok === true);
  check("createdAccount true", v1.data?.createdAccount === true);
  check("payoffPath /mine", v1.data?.payoffPath === "/mine");
  const entryId = v1.data?.entryId;
  check("entryId is a number", typeof entryId === "number");

  // 2 — tag normalization, read straight from the scratch db between publishes.
  const db = new Database(join(scratch, "pool", "diary_pool.db"), { readonly: true });
  const v1row = db.prepare(`SELECT text, tags FROM entries WHERE id = ?`).get(entryId);
  const v1tags = JSON.parse(v1row?.tags ?? "[]").sort();
  check(
    "tags normalized to the seven chips (#Tired+sugarplum+Late Night → tired, late night)",
    JSON.stringify(v1tags) === JSON.stringify(["late night", "tired"]),
    JSON.stringify(v1tags)
  );

  // 3 — republish: replaces the newest entry, same row, same id, tags too.
  const v2 = await publish({
    ...creds,
    text: "Republished: the market was open at six and the stallkeeper sang. It reframed the whole Tuesday.",
    tags: ["small joys"],
  });
  check("republish → ok, replaced true", v2.status === 200 && v2.data?.replaced === true);
  check("same entryId (newest-only UPSERT)", v2.data?.entryId === entryId);

  const row = db.prepare(`SELECT text, tags FROM entries WHERE id = ?`).get(entryId);
  check("db row replaced in place", /market was open at six/.test(row?.text ?? ""));
  check("replacement also replaced tags", row?.tags === `["small joys"]`, row?.tags);

  // 4 — wrong password on the existing account: generic 401, indistinguishable.
  const bad = await publish({ ...creds, password: "incorrect7", text: "wrong key" });
  check("wrong password → 401 generic", bad.status === 401 && typeof bad.data?.error === "string" && bad.data.error.length > 10);

  // 5 — banned word in the entry: refused, and the public entry untouched.
  const banned = await publish({ ...creds, text: "tonight was a shit show of noise", tags: [] });
  check("banned entry → 422", banned.status === 422 && typeof banned.data?.error === "string");
  const after = db.prepare(`SELECT text FROM entries WHERE id = ?`).get(entryId);
  check("banned publish wrote nothing", after?.text === row.text);
  db.close();

  // 6 — malformed: no text → 400.
  const empty = await publish({ ...creds, text: "   ", tags: [] });
  check("empty text → 400", empty.status === 400);
} catch (e) {
  failures++;
  console.log("FAIL  contract-test crashed —", e.message);
} finally {
  child.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 300));
  rmSync(scratch, { recursive: true, force: true });
}

console.log(failures === 0 ? "\ncontract test: all clear\n" : `\ncontract test: ${failures} failing\n`);
process.exit(failures === 0 ? 0 : 1);
