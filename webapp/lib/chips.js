// The pool's whole filter vocabulary (learner-confirmed set of seven).
// One shared copy here: views render it, routes validate against it.
// The plugin mirrors it in its own bundle (plugin/main.ts — different tree).
export const CHIPS = ["melancholy", "hopeful", "tired", "late night", "family", "work", "small joys"];

// Accepts writer-ish input ("#Tired", "Tired", "tired"); anything unknown
// returns null and stays unknown (no fuzzy guessing — spec decision).
export function normalizeTag(raw) {
  const cleaned = String(raw ?? "")
    .trim()
    .replace(/^#/, "")
    .toLowerCase();
  return CHIPS.includes(cleaned) ? cleaned : null;
}
