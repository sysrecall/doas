// The shared entry renderer: one rendering truth for the Peek page and the
// My Entry payoff page ("as the world sees it" — per prd.md > The writer's payoff).

import { esc, relativeTime } from "./layout.js";

export function entryBody(entry, { account = null, commentError = null, mineView = false, activeTag = null } = {}) {
  // The active chip rides along: next-link keeps the filter, and hidden form
  // fields carry it through heart/comment posts so the return view stays filtered.
  const tagQ = activeTag ? `&tag=${encodeURIComponent(activeTag)}` : "";
  const tagHidden = activeTag
    ? `<input type="hidden" name="tag" value="${esc(activeTag)}" />`
    : "";
  const nextHref = `/?after=${entry.id}${tagQ}`;
  const tags = entry.tags.map((t) => `<span class="tag-chip">${esc(t)}</span>`).join("");
  const sentences = entry.sentences
    .map((s, i) => {
      const n = entry.heartCounts.get(i) || 0;
      const count = n > 0 ? `<span class="heart-count">♥ ${n}</span>` : "";
      // The kernel: hearts attach to sentences, offered only through the permission door.
      const heart = account
        ? `<form class="heart-form" method="post" action="/hearts"><input type="hidden" name="entryId" value="${entry.id}" /><input type="hidden" name="sentenceIndex" value="${i}" />${tagHidden}<button class="heart-button" type="submit" title="heart this sentence" aria-label="heart this sentence">♥</button></form>`
        : "";
      return `<span class="sentence">${esc(s)}${count}${heart}</span> `;
    })
    .join("");

  const commentLines = entry.comments.map(
    (c) =>
      `<li class="comment"><span class="comment-meta">a stranger, ${esc(
        relativeTime(c.created_at)
      )}</span><span class="comment-text">${esc(c.text)}</span><span class="report-link"><form method="post" action="/report" class="report-form"><input type="hidden" name="type" value="comment" /><input type="hidden" name="id" value="${c.id}" /><button class="report-button" type="submit" title="report this comment">report</button></form></span></li>`
  );

  const commentForm = account
    ? `<form class="comment-form" method="post" action="/comments">
        <input type="hidden" name="entryId" value="${entry.id}" />${tagHidden}
        <input class="comment-input" name="text" maxlength="140" placeholder="say one small thing — 140 characters, no name attached" required />
        <button class="comment-button" type="submit">leave a note</button>
      </form>`
    : `<p class="comment-invite"><a href="/login?next=${encodeURIComponent(
        mineView ? "/mine" : `/?entry=${entry.id}`
      )}">log in</a> to heart a sentence or leave a note.</p>`;

  const err = commentError ? `<p class="comment-error">${esc(commentError)}</p>` : "";

  // The report door (PRD > Moderation): quiet, unshouted, open to any reader.
  const reportEntryForm = `<div class="entry-actions"><form method="post" action="/report" class="report-form"><input type="hidden" name="type" value="entry" /><input type="hidden" name="id" value="${entry.id}" /><button class="report-button" type="submit">report this page</button></form></div>`;

  return `
  <article class="entry${mineView ? " entry-mine" : ""}" data-entry-id="${entry.id}">
    <div class="entry-meta">
      <span class="entry-tags">${tags}</span>
      <span class="entry-date">${esc(relativeTime(entry.published_at))}</span>
    </div>
    <div class="entry-text">${sentences}</div>
    <div class="entry-footnotes">${commentsLine(commentLines)}${err}${commentForm}</div>
    ${reportEntryForm}
    ${
      mineView
        ? ""
        : `<nav class="next"><a class="next-link" href="${nextHref}">turn to another stranger →</a></nav>`
    }
  </article>`;
}

function commentsLine(lines) {
  return lines.length ? `<ol class="comments">${lines.join("")}</ol>` : '<ol class="comments"></ol>';
}
