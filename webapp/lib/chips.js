// The pool's whole filter vocabulary (learner-confirmed set of seven).
// One shared authority: imported by the webapp (routes, publish normalization)
// AND bundled into the Obsidian plugin (plugin/main.ts imports this file), so
// chip spelling can never drift between the two sides.
export const CHIPS = ["melancholy", "hopeful", "tired", "late night", "family", "work", "small joys"];

// Accepts writer-ish input and Obsidian's native tag forms:
//   exact:  "tired", "Tired", "#Tired", "late night"
//   native: "#small-joys", "late-night", "small_joys" — Obsidian inline tags
//           can't contain spaces, so hyphens/underscores stand in for them
// Anything not resolvable to one of the seven chips returns null and stays
// unknown (no fuzzy guessing — spec decision).
export function normalizeTag(raw) {
  const cleaned = String(raw ?? "")
    .trim()
    .replace(/^#/, "")
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");
  return CHIPS.includes(cleaned) ? cleaned : null;
}
