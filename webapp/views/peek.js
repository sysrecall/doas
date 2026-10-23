// The Peek page: one stranger's latest entry, warm and anonymous.
// Implements `prd.md > The peek (reading a stranger)` and `prd.md > Screens and Layout` (Peek page).

import { layout, esc } from "./layout.js";
import { entryBody } from "./entry.js";

export function renderPeek(entry, opts = {}) {
  const { activeTag = null, whisperTag = null, account = null, commentError = null } = opts;
  const body = `${chipRow(activeTag)}${
    entry
      ? entryBody(entry, { account, commentError })
      : `<div class="empty-whisper">the library ran out for tonight — nobody's latest page remains. come back when someone writes.</div>`
  }${whisperTag ? whisper(whisperTag) : ""}`;
  return layout({ body, extraClass: "page-peek", account });
}

function chipRow(activeTag) {
  // Learner-confirmed starter set (prd.md > The peek, resolved at review).
  // Chips are plain links — no SPA magic; the active chip links back to unfiltered random.
  const CHIPS = ["melancholy", "hopeful", "tired", "late night", "family", "work", "small joys"];
  const chips = CHIPS.map((c) => {
    const active = activeTag === c;
    const href = active ? "/" : `/?tag=${encodeURIComponent(c)}`;
    const cls = active ? "filter-chip active" : "filter-chip";
    return `<a class="${cls}" href="${href}">${esc(c)}</a>`;
  }).join("\n      ");
  return `
  <nav class="filter-row" aria-label="filter the pool by mood">
      ${chips}
  </nav>`;
}

function whisper(tag) {
  return `<div class="fallback-whisper">nobody's written ${esc(tag)} today — so here's someone anyhow.</div>`;
}
