// Seed strangers — SIMULATED TEST DATA, clearly labeled in the database (is_seed = 1).
// These entries exist so the first reader has somewhere alive to land. They are not
// real people; their diary lines are written for the proof of concept.
//
// Timestamps are RELATIVE (computed at seed time, UTC strings as SQLite
// datetime('now') would store them): every usable pool starts with strangers who
// wrote yesterday and this morning, no matter when it's installed. relativeTime
// (views/layout.js) renders "Z"-suffixed UTC correctly.
//
// Chip coverage: all seven chips, each claimed by at least one writer.
// Seed mechanics: seeding is by-identity and idempotent; missing strangers are
// born, existing writers (including any real publish) are never touched. Hearts
// are specified as sentence substrings and resolved to real indexes at seed time,
// so a count can never point at a sentence that doesn't exist.

import { randomBytes } from "node:crypto";
import { hashPassword } from "./lib/auth.js";
import { splitSentences } from "./lib/sentences.js";

function dt(hoursAgo) {
  return new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString().slice(0, 19).replace("T", " ");
}

// { byUsername, snippet } — snippet must appear in exactly one sentence.
const heartShouts = new Map([
  [
    "seed-wren",
    [
      { byUsername: "seed-fernway", snippet: "the longest distance was between the drawer" },
      { byUsername: "seed-marrow", snippet: "The late bus is warm and nobody is looking at me" },
    ],
  ],
  [
    "seed-verity",
    [
      { byUsername: "seed-fernway", snippet: "a rabbit watching me work from behind the compost" },
      { byUsername: "seed-wren", snippet: "at roundabouts, at telephones, at telling people what I want" },
    ],
  ],
  [
    "seed-marrow",
    [
      { byUsername: "seed-sallow", snippet: "setting it down by choice" },
      { byUsername: "seed-quillight", snippet: "the correct blessing for people like us" },
    ],
  ],
  [
    "seed-ollar",
    [
      { byUsername: "seed-sallow", snippet: "someone who underlined your sentences before you did" },
      { byUsername: "seed-wren", snippet: "laughing, and then not laughing" },
    ],
  ],
  [
    "seed-quillight",
    [
      { byUsername: "seed-marrow", snippet: "I think I might be allowed to like work" },
      { byUsername: "seed-fernway", snippet: "The night bus hums like it agrees" },
    ],
  ],
  [
    "seed-fernway",
    [
      { byUsername: "seed-verity", snippet: "it tastes like being expected" },
      { byUsername: "seed-wren", snippet: "Small joys are the ones that never made it into the plan" },
    ],
  ],
  [
    "seed-sallow",
    [
      { byUsername: "seed-ollar", snippet: "one hand open like a question mark" },
      { byUsername: "seed-marrow", snippet: "New strangers don't get endings, only pauses" },
    ],
  ],
]);

// { byUsername, ageHoursAfterEntry, text } — ≤140 chars, said by another stranger.
const noteDrafts = new Map([
  [
    "seed-wren",
    [
      { byUsername: "seed-verity", afterHours: 20, text: "a decade-long errand finding its counter. i'm rooting for the envelope." },
      { byUsername: "seed-ollar", afterHours: 20, text: "she left you the errand on purpose. finish it for the both of you." },
    ],
  ],
  [
    "seed-verity",
    [
      { byUsername: "seed-fernway", afterHours: 15, text: "the rabbit is doing inspection rounds. report back when the flag stands." },
      { byUsername: "seed-marrow", afterHours: 26, text: "hesitation is real. so is roundabout number twelve. keep going." },
    ],
  ],
  [
    "seed-marrow",
    [
      { byUsername: "seed-quillight", afterHours: 19, text: "the correct blessing for the correct people. thank you for holding things up." },
      { byUsername: "seed-sallow", afterHours: 4, text: "3am corridor-setter-down. respect." },
    ],
  ],
  [
    "seed-ollar",
    [
      { byUsername: "seed-sallow", afterHours: 12, text: "underlined sentences run in blood, apparently. keep the atlas of everything else." },
      { byUsername: "seed-wren", afterHours: 9, text: "same handwriting, twenty years apart. i have no words. hold this gently." },
    ],
  ],
  [
    "seed-quillight",
    [
      { byUsername: "seed-marrow", afterHours: 13, text: "cake when the lights were on too late for too long — you'll do great there." },
      { byUsername: "seed-fernway", afterHours: 6, text: "allowed to like work. what a sentence. frame the badge." },
    ],
  ],
  [
    "seed-fernway",
    [
      { byUsername: "seed-verity", afterHours: 5, text: "being awaited somewhere is the whole economy. collecting mine next to yours." },
      { byUsername: "seed-wren", afterHours: 3, text: "come back when it has a story. meanwhile, stitched and warm." },
    ],
  ],
  [
    "seed-sallow",
    [
      { byUsername: "seed-ollar", afterHours: 2, text: "one thumb at 3:14am. a full report from the far side of tired." },
      { byUsername: "seed-quillight", afterHours: 1, text: "pauses are endings in training. hi, small stranger." },
    ],
  ],
]);

const CHIPS_SEEDS = [
  {
    username: "seed-wren",
    ageHours: 52, // wrote the night before last, when the lab let out
    tags: ["melancholy", "late night"],
    text: `The photo lab closes at midnight, and last week I finally dropped off my grandmother's rolls of film, ten years after her funeral. The clerk apologized for the four-day wait, as if for me it hadn't already been much longer than that.
Year after year I meant to do it, and it turns out the longest distance was between the drawer where she kept the rolls and the counter where I finally stood. Tomorrow I'll see her photograph a hotel courtyard in 1998 for the very first time. I've carried this errand for a decade, I think, because finishing it would mean the story is over. The late bus is warm and nobody is looking at me. I'll collect them anyway.`,
  },
  {
    username: "seed-verity",
    ageHours: 46,
    tags: ["hopeful", "small joys"],
    text: `I failed my driving test for the second time on Tuesday, which means I'm finally allowed to be funny about it. The examiner said "you hesitate at roundabouts," and I said thank you — I hesitate at roundabouts, at telephones, at telling people what I want.
This morning the community garden gave me the plot nobody wanted, all thistles and yesterday's plastic forks. I pulled the first thistle bare-handed, like a person who has decided something. There is a rabbit watching me work from behind the compost with professional interest. The first sunflower went in crooked; I left it crooked on purpose, its own little crooked flag.`,
  },
  {
    username: "seed-marrow",
    ageHours: 40,
    tags: ["tired", "work"],
    text: `Hospital housekeeping, night rotation. I have mopped the same hallway for eleven years, and every night it tells me something different. Tonight a man in room 9 held my wrist while I changed the bin and said, "you people held everything up." I think he meant a much bigger year, but I'll take it personally, in the good way.
My feet have opinions by 3am. Down the corridor someone's TV laughs the same game-show laugh every twenty minutes, and I know that episode by heart. I used to think tired would feel like defeat. At this hour it feels more like having carried something heavy a long way and setting it down by choice. The bus driver wished me a quiet morning, which is the correct blessing for people like us.`,
  },
  {
    username: "seed-ollar",
    ageHours: 34,
    tags: ["family", "melancholy"],
    text: `My brother and I split the childhood bookshelf today, down the middle, like a border treaty between two adults who once shared a bunk bed. In one of my old novels there is our father's handwriting — he underlined the same three sentences that I underlined, unknowingly, twenty years later.
We sat on the floor of my old room, laughing, and then not laughing. He took the atlas; I took the atlas of everything else. I don't know what to do with proof that we were once the same person. Maybe that's what family is for: someone who underlined your sentences before you did.`,
  },
  {
    username: "seed-quillight",
    ageHours: 28,
    tags: ["work", "hopeful", "late night"],
    text: `Day four at the new place. I sent the letter, eleven months after writing the first draft on my phone in a parking garage. Nobody shouted. Somebody brought cake, because somebody in every workplace brings cake when the lights have been on too late for too long.
Here the lights go off at six and everyone actually leaves. I keep catching myself standing up the way I used to stand up — like an escape, not like a lunch break. My badge has my name spelled right this time, which sounds small and isn't. Tonight I stayed late only because a paragraph was walking around in me looking for paper. I think I might be allowed to like work. The night bus hums like it agrees.`,
  },
  {
    username: "seed-fernway",
    ageHours: 20,
    tags: ["small joys"],
    text: `The man at the corner shop keeps my usual loaf and two eggs set aside behind the counter on Thursdays, because by my second week he had learned my rhythm without asking. He calls it a reservation. It costs exactly the same as any other loaf, and it tastes like being expected.
The umbrella maker returned the repair stitched, and wouldn't charge: "bring it back when it has a story." I laughed the whole way to the tram. Small joys are the ones that never made it into the plan. I've started a collection — warm doors, paper bags, being awaited somewhere.`,
  },
  {
    username: "seed-sallow",
    ageHours: 7,
    tags: ["family", "tired"],
    text: `3:14am. Fed her at 3:14 and 7:02 — she sleeps with one hand open like a question mark. Writing this with one thumb, her whole weight asleep on my chest, both of us breathing each other in.
My partner sleeps through the small alarms; ten years of night shifts earn that, and somebody in this family deserves the sleep even if tonight it isn't me. People say the nights are long. They are, and they'll be long again, and the pillow smells like her head, so I'm not filing a complaint. I don't have an ending for this entry. We're new here. New strangers don't get endings, only pauses.`,
  },
];

export function seedIfEmpty(db) {
  const insertAccount = db.prepare(
    `INSERT INTO accounts (username, password_hash, password_salt, is_seed) VALUES (?, ?, ?, 1)`
  );
  const insertEntry = db.prepare(
    `INSERT INTO entries (account_id, text, sentences, tags, published_at) VALUES (?, ?, ?, ?, ?)`
  );
  const insertComment = db.prepare(
    `INSERT INTO comments (entry_id, account_id, text, created_at) VALUES (?, ?, ?, ?)`
  );
  const insertHeart = db.prepare(
    `INSERT INTO hearts (entry_id, sentence_index, account_id) VALUES (?, ?, ?)`
  );
  const findAccount = db.prepare(`SELECT id FROM accounts WHERE username = ?`);
  const findEntryFor = db.prepare(`SELECT id FROM entries WHERE account_id = ?`);

  const tx = db.transaction(() => {
    // — pass 1: birth any missing stranger (unusable passwords: seeds don't log in) —
    const ids = new Map();
    for (const chip of CHIPS_SEEDS) {
      const row = findAccount.get(chip.username);
      if (row) {
        ids.set(chip.username, row.id);
        continue;
      }
      const { hash, salt } = hashPassword(randomBytes(24).toString("hex"));
      ids.set(chip.username, insertAccount.run(chip.username, hash, salt).lastInsertRowid);
    }

    // — pass 2: entries for any seed writer who has none; collate reactions —
    const heartPlans = []; // { entryId, sentenceIndex, byAccountId }
    const notePlans = []; // { entryId, byAccountId, text, created_at }

    for (const chip of CHIPS_SEEDS) {
      const accountId = ids.get(chip.username);
      if (findEntryFor.get(accountId)) continue;

      const sentences = splitSentences(chip.text);
      const entryId = insertEntry.run(
        accountId,
        chip.text,
        JSON.stringify(sentences),
        JSON.stringify(chip.tags),
        dt(chip.ageHours)
      ).lastInsertRowid;

      const notes = noteDrafts.get(chip.username) || [];
      for (const n of notes) {
        notePlans.push({
          entryId,
          byAccountId: ids.get(n.byUsername),
          text: n.text,
          created_at: dt(chip.ageHours - n.afterHours), // younger than the entry
        });
      }

      for (const h of heartShouts.get(chip.username) || []) {
        const idx = sentences.findIndex((s) => s.includes(h.snippet));
        if (idx === -1) {
          throw new Error(`seed heart snippet not found in ${chip.username}'s entry: "${h.snippet}"`);
        }
        heartPlans.push({ entryId, sentenceIndex: idx, byAccountId: ids.get(h.byUsername) });
      }
    }

    // — pass 3: commit collated reactions —
    for (const n of notePlans) {
      insertComment.run(n.entryId, n.byAccountId, n.text, n.created_at);
    }
    for (const h of heartPlans) {
      insertHeart.run(h.entryId, h.sentenceIndex, h.byAccountId);
    }

    return { heartPlans: heartPlans.length, notePlans: notePlans.length };
  });

  return tx();
}
