// Starter banned-word list — deliberately small and hardcoded (spec decision).
// Matcher uses word boundaries so ordinary words never trip it by accident.

const BANNED = [
  "fuck",
  "fucking",
  "shit",
  "bitch",
  "bastard",
  "asshole",
  "cunt",
  "dickhead",
  "piss",
  "whore",
  "slut",
  "retard",
  "faggot",
  "kill yourself",
  "kys",
];

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const MATCHERS = BANNED.map((w) => ({
  word: w,
  re: new RegExp(`\\b${escapeRegExp(w)}\\b`, "i"),
}));

// Returns the matching banned word (first hit), or null when clean.
export function findBannedWord(text) {
  const s = String(text);
  for (const { word, re } of MATCHERS) {
    if (re.test(s)) return word;
  }
  return null;
}

// The friendly, plain-language reason shown to a writer/reader.
export function refusalLine(word) {
  return `That includes a word we keep out of the pool ("${word}"). Please soften it and try again — strangers read these at their most honest moments.`;
}
