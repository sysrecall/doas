import { chooseEntry } from "../db.js";
import { renderPeek } from "../views/peek.js";

export function mountPeek(app) {
  app.get("/", (req, res) => {
    const excludeId = req.query.after != null ? Number(req.query.after) : null;
    const rawTag = typeof req.query.tag === "string" ? req.query.tag.trim().toLowerCase() : null;
    const activeTag = rawTag || null;
    let entry = chooseEntry({ tag: activeTag, excludeId });
    const whisperTag = activeTag && !entry ? activeTag : null;
    // Empty match falls back to random AND the whisper — both, never one alone (PRD rule).
    if (!entry && whisperTag) entry = chooseEntry({ excludeId });
    res.send(renderPeek(entry, { activeTag, whisperTag }));
  });
}
