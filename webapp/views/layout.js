// Server-rendered templates: tiny functions returning HTML strings.
// All dynamically rendered text passes through esc() — anonymity and
// safety both live here: no username ever reaches these functions.

export function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function layout({ body, extraClass = "" }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Diary of a Stranger</title>
  <link rel="stylesheet" href="/style.css" />
</head>
<body class="${esc(extraClass)}">
  <header class="masthead">
    <a class="masthead-title" href="/">Diary of a Stranger</a>
    <span class="masthead-sub">you are reading someone's latest page</span>
  </header>
  <main>${body}</main>
  <footer class="colophon">entries are anonymous by design · the pool is small tonight</footer>
</body>
</html>`;
}

export function relativeTime(pubAt) {
  // pubAt is "YYYY-MM-DD HH:MM:SS" UTC from SQLite; display a warm human line.
  const t = new Date(pubAt.replace(" ", "T") + "Z");
  if (Number.isNaN(t.getTime())) return String(pubAt);
  const diff = Date.now() - t.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  const hours = Math.round(mins / 60);
  if (hours < 1) return `${mins} minutes ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return String(pubAt).slice(0, 10);
}
