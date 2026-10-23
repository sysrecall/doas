// Reactions: sentence hearts + short comments, both login-gated (PRD rule:
// reading open, reacting through the door). Comments: ≤140 chars, banned-word
// checked, rendered with time and no name anywhere.

import { getEntryFull, heartSentence, heartCount, addComment } from "../db.js";
import { findBannedWord, refusalLine } from "../lib/banned.js";
import { renderPeek } from "../views/peek.js";

const MAX_COMMENT = 140;

export function mountReactions(app) {
  app.post("/hearts", (req, res) => {
    if (!req.account) {
      // The soft invite: land right back where they were after logging in.
      res.redirect(303, "/login?next=/");
      return;
    }
    const entryId = Number(req.body?.entryId);
    const sentenceIndex = Number(req.body?.sentenceIndex);
    const entry = Number.isInteger(entryId) ? getEntryFull(entryId) : null;
    if (!entry || entry.hidden || !Number.isInteger(sentenceIndex) || sentenceIndex < 0 || sentenceIndex >= entry.sentences.length) {
      res.status(404).send("That sentence isn't in the pool.");
      return;
    }
    heartSentence(entryId, sentenceIndex, req.account.id); // idempotent by primary key
    res.redirect(303, `/?entry=${entryId}`);
  });

  app.post("/comments", (req, res) => {
    if (!req.account) {
      res.redirect(303, "/login?next=/");
      return;
    }
    const entryId = Number(req.body?.entryId);
    const text = String(req.body?.text ?? "").replace(/\s+/g, " ").trim();
    const entry = Number.isInteger(entryId) ? getEntryFull(entryId) : null;
    if (!entry || entry.hidden) {
      // Voting on (or under) a reported page is closed.
      res.status(404).send("That entry isn't in the pool.");
      return;
    }
    if (text.length > MAX_COMMENT) {
      res.status(422).send(
        renderPeek(entry, { account: req.account, commentError: `That's longer than 140 characters — the pool keeps comments small.` })
      );
      return;
    }
    const banned = findBannedWord(text);
    if (banned) {
      res.status(422).send(
        renderPeek(entry, { account: req.account, commentError: refusalLine(banned) })
      );
      return;
    }
    if (text.length === 0) {
      res.redirect(303, `/?entry=${entryId}`);
      return;
    }
    addComment(entryId, req.account.id, text);
    res.redirect(303, `/?entry=${entryId}`);
  });
}
