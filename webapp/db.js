import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { splitSentences } from "./lib/sentences.js";
import { hashPassword, verifyPassword } from "./lib/auth.js";

const here = dirname(fileURLToPath(import.meta.url));
// DIARY_DATA_DIR lets the contract test run against a scratch pool (devpost/checks).
const dataDir = process.env.DIARY_DATA_DIR || join(here, "data");
mkdirSync(dataDir, { recursive: true });

export const db = new Database(join(dataDir, "diary_pool.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      is_seed       INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS entries (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id   INTEGER NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
      text         TEXT NOT NULL,
      sentences    TEXT NOT NULL,           -- JSON array of sentence strings
      tags         TEXT NOT NULL DEFAULT [], -- JSON array of chip names
      published_at TEXT NOT NULL DEFAULT (datetime('now')),
      hidden       INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS hearts (
      entry_id       INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
      sentence_index INTEGER NOT NULL,
      account_id     INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (entry_id, sentence_index, account_id)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id   INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      text       TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      hidden     INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS reports (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      type       TEXT NOT NULL CHECK (type IN ('entry', 'comment')),
      target_id  INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// ---- pool queries (shared by the peek route and later slices) ----

export function getEntryFull(id) {
  const e = db
    .prepare(
      `SELECT e.*, a.is_seed
         FROM entries e JOIN accounts a ON a.id = e.account_id
        WHERE e.id = ?`
    )
    .get(id);
  if (!e) return null;
  const counts = db
    .prepare(
      `SELECT sentence_index, COUNT(*) AS n
         FROM hearts WHERE entry_id = ? GROUP BY sentence_index`
    )
    .all(id);
  const heartCounts = new Map(counts.map((c) => [c.sentence_index, c.n]));
  const comments = db
    .prepare(
      `SELECT text, created_at
         FROM comments
        WHERE entry_id = ? AND hidden = 0
        ORDER BY datetime(created_at) ASC`
    )
    .all(id);
  return {
    ...e,
    sentences: JSON.parse(e.sentences),
    tags: JSON.parse(e.tags),
    heartCounts,
    comments,
  };
}

export function getEntryForAccount(accountId) {
  const row = db.prepare(`SELECT id FROM entries WHERE account_id = ?`).get(accountId);
  return row ? getEntryFull(row.id) : null;
}

// Random draw among current, unreported entries; optional tag filter and
// "don't show the one I'm looking at" exclusion. Pure random — spec decision.
export function chooseEntry({ tag = null, excludeId = null } = {}) {
  const rows = db.prepare(`SELECT id, tags FROM entries WHERE hidden = 0`).all();
  const candidates = rows.filter((r) => {
    if (excludeId != null && Number(excludeId) === r.id) return false;
    if (tag) {
      const tags = JSON.parse(r.tags);
      if (!tags.includes(tag)) return false;
    }
    return true;
  });
  if (candidates.length === 0) return null;
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  return getEntryFull(pick.id);
}

export function poolSize() {
  return db.prepare(`SELECT COUNT(*) AS n FROM entries WHERE hidden = 0`).get().n;
}

// --- reactions (slice 4) ---

// One heart per account per sentence; clicking again is idempotent.
export function heartSentence(entryId, sentenceIndex, accountId) {
  const info = db
    .prepare(
      `INSERT OR IGNORE INTO hearts (entry_id, sentence_index, account_id)
       VALUES (?, ?, ?)`
    )
    .run(entryId, sentenceIndex, accountId);
  // changes = 1 when a new heart appeared, 0 when this account had already hearted.
  return info.changes === 1;
}

export function heartCount(entryId, sentenceIndex) {
  return db
    .prepare(
      `SELECT COUNT(*) AS n FROM hearts WHERE entry_id = ? AND sentence_index = ?`
    )
    .get(entryId, sentenceIndex).n;
}

export function addComment(entryId, accountId, text) {
  return db
    .prepare(`INSERT INTO comments (entry_id, account_id, text) VALUES (?, ?, ?)`)
    .run(entryId, accountId, text.trim());
}

// --- publish (slice 5) ---

// "Only your newest entry is public" is structural: one row per account,
// updated in place. Republish = UPDATE on the same row.

export function verifyOrCreateAccount(username, password) {
  const name = String(username).trim();
  const row = db
    .prepare(`SELECT id, password_hash, password_salt FROM accounts WHERE username = ?`)
    .get(name);
  if (row) {
    const ok = verifyPasswordRow(password, row);
    return ok ? { accountId: row.id, created: false } : null;
  }
  if (name.length < 2 || name.length > 40 || String(password).length < 6) return null;
  const { hash, salt } = hashPassword(password);
  const id = db
    .prepare(`INSERT INTO accounts (username, password_hash, password_salt) VALUES (?, ?, ?)`)
    .run(name, hash, salt).lastInsertRowid;
  return { accountId: id, created: true };
}

function verifyPasswordRow(password, row) {
  return verifyPassword(String(password), row.password_hash, row.password_salt);
}

export function publishEntry(accountId, text, tags) {
  const sentences = JSON.stringify(splitSentences(text));
  const chips = JSON.stringify(tags);
  const updated = db
    .prepare(
      `UPDATE entries
          SET text = ?, sentences = ?, tags = ?, published_at = datetime('now')
        WHERE account_id = ?`
    )
    .run(String(text).trim(), sentences, chips, accountId);
  if (updated.changes > 0) {
    return db.prepare(`SELECT id FROM entries WHERE account_id = ?`).get(accountId).id;
  }
  return db
    .prepare(`INSERT INTO entries (account_id, text, sentences, tags) VALUES (?, ?, ?, ?)`)
    .run(accountId, String(text).trim(), sentences, chips).lastInsertRowid;
}
