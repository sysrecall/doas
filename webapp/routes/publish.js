// The plugin's contract: POST /api/publish.
// Implements `prd.md > Publishing from Obsidian (the plugin)`.
//
// Body (JSON):
//   { username, password, text, tags: [...], sourceNote }
// Responses:
//   200 { ok: true, entryId, payoffPath }              — verified-or-created + published
//   401 { ok: false, error: genericCredentialMessage } — unknown user + wrong password indistinguishable
//   422 { ok: false, error: refusalLine }              — banned word in the entry
//   400 { ok: false, error }                           — malformed body / empty text

import { verifyOrCreateAccount, publishEntry } from "../db.js";
import { findBannedWord, refusalLine } from "../lib/banned.js";
import { credentialFailureLine } from "../lib/auth.js";

// The seven chips are the pool's whole filter language (learner-confirmed set).
// Obsidian tags matching these (case-insensitive) become chips; all other tags
// are ignored — no fuzzy guessing layer (spec decision).
const CHIPS = ["melancholy", "hopeful", "tired", "late night", "family", "work", "small joys"];

export function normalizeTags(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const hit = new Set();
  for (const t of list) {
    const cleaned = String(t)
      .trim()
      .replace(/^#/, "")
      .toLowerCase();
    if (CHIPS.includes(cleaned)) hit.add(cleaned);
  }
  return [...hit];
}

export function mountPublish(app) {
  app.post("/api/publish", (req, res) => {
    const body = req.body || {};
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    const text = String(body.text ?? "").trim();
    const tags = normalizeTags(body.tags);

    if (!username || !password || !text) {
      res.status(400).json({ ok: false, error: "The publish needs a username, a password and the entry text." });
      return;
    }

    const banned = findBannedWord(text);
    if (banned) {
      res.status(422).json({ ok: false, error: refusalLine(banned) });
      return;
    }

    const account = verifyOrCreateAccount(username, password);
    if (!account) {
      res.status(401).json({ ok: false, error: credentialFailureLine() });
      return;
    }

    const entryId = publishEntry(account.accountId, text, tags);
    res.status(200).json({
      ok: true,
      entryId,
      payoffPath: "/mine",
      replaced: !account.created,
      createdAccount: account.created,
    });
  });
}
