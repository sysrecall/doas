import { chooseEntry, getEntryFull } from "../db.js";
import { renderPeek } from "../views/peek.js";

export function mountPeek(app) {
  app.get("/", (req, res) => {
    const excludeId = req.query.after != null ? Number(req.query.after) : null;
    const rawTag = typeof req.query.tag === "string" ? req.query.tag.trim().toLowerCase() : null;
    const activeTag = rawTag || null;
    // Direct return after hearting/commenting: show the SAME entry again.
    const pinnedId = req.query.entry != null ? Number(req.query.entry) : null;
    const pinned = pinnedId != null && Number.isInteger(pinnedId) ? getEntryFull(pinnedId) : null;
    if (pinned) {
      res.send(renderPeek(pinned, { account: req.account }));
      return;
    }
    let entry = chooseEntry({ tag: activeTag, excludeId });
    const whisperTag = activeTag && !entry ? activeTag : null;
    // Empty match falls back to random AND the whisper — both, never one alone (PRD rule).
    if (!entry && whisperTag) entry = chooseEntry({ excludeId });
    res.send(renderPeek(entry, { activeTag, whisperTag, account: req.account }));
  });
}
