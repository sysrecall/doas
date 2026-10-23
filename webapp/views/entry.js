// The shared entry renderer: one rendering truth for the Peek page and the
// My Entry payoff page ("as the world sees it" — per prd.md > The writer's payoff).

import { esc, relativeTime } from "./layout.js";

export function entryBody(entry, { account = null, commentError = null, mineView = false } = {}) {
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

  const commentLines = entry.comments.map(
    (c) =>
      `<li class="comment"><span class="comment-meta">a stranger, ${esc(
        relativeTime(c.created_at)
      )}</span><span class="comment-text">${esc(c.text)}</span></li>`
  );

  const comments = commentLines.length
    ? `<ol class="comments">${commentLines.join("")}</ol>`
    : `<ol class="comments"></ol>`;

  const commentForm = account
    ? `<form class="comment-form" method="post" action="/comments">
        <input type="hidden" name="entryId" value="${entry.id}" />
        <input class="comment-input" name="text" maxlength="140" placeholder="say one small thing — 140 characters, no name attached" required />
        <button class="comment-button" type="submit">leave it</button>
      </form>`
    : `<p class="comment-invite"><a href="/login?next=${encodeURIComponent(
        mineView ? "/mine" : `/?entry=${entry.id}`
      )}">log in</a> to heart a sentence or leave a note.</p>`;

  const err = commentError ? `<p class="comment-error">${esc(commentError)}</p>` : "";

  return `
  <article class="entry${mineView ? " entry-mine" : ""}" data-entry-id="${entry.id}">
    <div class="entry-meta">
      <span class="entry-tags">${tags}</span>
      <span class="entry-date">${esc(relativeTime(entry.published_at))}</span>
    </div>
    <div class="entry-text">${sentences}</div>
    <div class="entry-footnotes">${comments}${err}${commentForm}</div>
    ${
      mineView
        ? ""
        : `<nav class="next"><a class="next-link" href="/?after=${entry.id}">turn to another stranger →</a></nav>`
    }
  </article>`;
}
