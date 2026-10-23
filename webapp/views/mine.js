// The writer's payoff: your current public entry, exactly as a stranger sees it,
// with per-sentence heart counts and anonymous comments underneath.
// Implements `prd.md > The writer's payoff`, `prd.md > Screens and Layout` (My Entry).

import { layout } from "./layout.js";
import { entryBody } from "./entry.js";

export function renderMine({ entry, account = null }) {
  if (!account) {
    // Defensive render — the route guards with /login?next=/mine first.
    return layout({
      extraClass: "page-mine",
      body: `<div class="empty-whisper">the door is locked from your side — <a href="/login?next=/mine">log in</a> to see your page.</div>`,
    });
  }
  if (!entry) {
    return layout({
      extraClass: "page-mine",
      account,
      body: `
      <div class="mine-empty">
        <p class="empty-whisper">your page is kept for you, but no latest entry sits in the pool yet.</p>
        <p class="mine-empty-hint">publish from Obsidian with the <em>Publish to Diary of a Stranger</em> command — the newest written page becomes your public one.</p>
      </div>`,
    });
  }
  const body = `
    <div class="mine-greeting">your page, as a stranger would see it — hearts on the lines that landed</div>
    ${entryBody(entry, { account, mineView: true })}
    <nav class="next"><a class="next-link" href="/">← back to peeking</a></nav>`;
  return layout({ body, extraClass: "page-mine", account });
}
