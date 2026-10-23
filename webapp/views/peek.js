// The Peek page: one stranger's latest entry, warm and anonymous.
// Implements `prd.md > The peek (reading a stranger)` and `prd.md > Screens and Layout` (Peek page).

import { layout, esc, relativeTime } from "./layout.js";

function entryBody(entry) {
  const tags = entry.tags.map((t) => `<span class="tag-chip">${esc(t)}</span>`).join("");
  const sentences = entry.sentences
    .map((s, i) => {
      const n = entry.heartCounts.get(i) || 0;
      const count = n > 0 ? `<span class="heart-count">♥ ${n}</span>` : "";
      return `<span class="sentence">${esc(s)}${count}</span> `;
    })
    .join("");

  const comments = entry.comments.length
    ? `<ol class="comments">` +
      entry.comments
        .map(
          (c) =>
            `<li class="comment"><span class="comment-meta">a stranger, ${esc(
              relativeTime(c.created_at)
            )}</span><span class="comment-text">${esc(c.text)}</span></li>`
        )
        .join("") +
      `</ol>`
    : "";

  return `
  <article class="entry" data-entry-id="${entry.id}">
    <div class="entry-meta">
      <span class="entry-tags">${tags}</span>
      <span class="entry-date">${esc(relativeTime(entry.published_at))}</span>
    </div>
    <div class="entry-text">${sentences}</div>
    <div class="entry-footnotes">
      ${comments}
    </div>
    <nav class="next">
      <a class="next-link" href="/?after=${entry.id}">turn to another stranger →</a>
    </nav>
  </article>`;
}

export function renderPeek(entry) {
  const body = entry
    ? entryBody(entry)
    : `<div class="empty-whisper">the library ran out for tonight — nobody's latest page remains. come back when someone writes.</div>`;
  return layout({ body, extraClass: "page-peek" });
}
