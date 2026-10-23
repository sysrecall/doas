// Naive sentence splitting, documented in the spec as a proof-of-concept tradeoff:
// split on newlines (paragraph breaks), then after . ! ? … followed by whitespace.
// Odd punctuation only miscounts a heart, never breaks the page.

export function splitSentences(text) {
  const clean = String(text).replace(/\r\n/g, "\n").trim();
  const out = [];
  for (const para of clean.split(/\n+/)) {
    const trimmed = para.replace(/\s+/g, " ").trim();
    if (!trimmed) continue;
    const pieces = trimmed
      .split(/(?<=[.!?…])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    out.push(...pieces);
  }
  return out;
}
