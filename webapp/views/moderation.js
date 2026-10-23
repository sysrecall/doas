// The moderation review list — unadvertised (no link anywhere), warm but plain.
// Every report ever is on it; nothing disappears (spec > Components > Moderation).

import { layout, esc, relativeTime } from "./layout.js";

export function renderModeration({ reports }) {
  const rows = reports
    .map((r) => {
      const what = r.type === "comment" ? "a comment" : "a page";
      const now =
        r.type === "entry"
          ? "out of the draws"
          : r.hidden
            ? "out of the entry"
            : `still on entry ${r.entry_id} (hidden flag missing)`;
      return `<li class="mod-row">
        <div class="mod-meta">reported ${esc(relativeTime(r.created_at))} · ${what} · ${esc(now)}</div>
        <div class="mod-text">${esc(String(r.text ?? "").slice(0, 400))}</div>
      </li>`;
    })
    .join("");

  const body = `
  <div class="mod-header">the review desk</div>
  ${
    reports.length
      ? `<ul class="mod-list">${rows}</ul>`
      : `<div class="empty-whisper">no reports yet — the pool is quiet and clean tonight.</div>`
  }
  <nav class="next"><a class="next-link" href="/">← back to peeking</a></nav>`;

  return layout({ body, extraClass: "page-moderation" });
}
