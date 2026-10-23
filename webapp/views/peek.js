// The Peek page: one stranger's latest entry, warm and anonymous.
// Implements `prd.md > The peek (reading a stranger)` and `prd.md > Screens and Layout` (Peek page).

import { layout, esc, relativeTime } from "./layout.js";

function entryBody(entry, { account = null, commentError = null } = {}) {
  const tags = entry.tags.map((t) => `<span class="tag-chip">${esc(t)}</span>`).join("");
  const sentences = entry.sentences
    .map((s, i) => {
      const n = entry.heartCounts.get(i) || 0;
      const count = n > 0 ? `<span class="heart-count">♥ ${n}</span>` : "";
      // The kernel: hearts attach to sentences, offered only through the permission door.
      const heart = account
        ? `<form class="heart-form" method="post" action="/hearts"><input type="hidden" name="entryId" value="${entry.id}" /><input type="hidden" name="sentenceIndex" value="${i}" /><button class="heart-button" type="submit" title="heart this sentence" aria-label="heart this sentence">♥</button></form>`
        : "";
      return `<span class="sentence">${esc(s)}${count}${heart}</span> `;
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
    : `<ol class="comments"></ol>`;

  const commentForm = account
    ? `<form class="comment-form" method="post" action="/comments">
        <input type="hidden" name="entryId" value="${entry.id}" />
        <input class="comment-input" name="text" maxlength="140" placeholder="say one small thing — 140 characters, no name attached" required />
        <button class="comment-button" type="submit">leave it</button>
      </form>`
    : `<p class="comment-invite"><a href="/login?next=${encodeURIComponent(`/?entry=${entry.id}`)}">log in</a> to heart a sentence or leave a note.</p>`;

  const err = commentError
    ? `<p class="comment-error">${esc(commentError)}</p>`
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
      ${err}
      ${commentForm}
    </div>
    <nav class="next">
      <a class="next-link" href="/?after=${entry.id}">turn to another stranger →</a>
    </nav>
  </article>`;
}

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

export { entryBody as _entryBodyForTests };
