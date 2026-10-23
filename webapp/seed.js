// Seed strangers — SIMULATED TEST DATA, clearly labeled in the database (is_seed = 1).
// These entries exist so the first reader has somewhere alive to land. They are not
// real people; their diary lines are written for the proof of concept.

import { randomBytes } from "node:crypto";
import { hashPassword, newSessionToken } from "./lib/auth.js";
import { splitSentences } from "./lib/sentences.js";

const CHIPS_SEEDS = [
  {
    username: "seed-wren",
    date: "2026-10-19 22:14:00",
    tags: ["melancholy", "late night"],
    text: `Today I watched my grandfather's old chair get carried out. It left a rectangle of cleaner carpet behind, like a photograph of where it sat for forty years. I keep walking past the empty space and my body still moves to avoid it.
I know it's just a chair. I know that nobody besides me will notice the rectangle. But tonight the house feels like it's holding its breath, and so am I. Maybe the rectangle is where I put the years I didn't visit. I'll vacuum around it anyway, out of respect.`,
  },
  {
    username: "seed-verity",
    date: "2026-10-20 07:52:00",
    tags: ["hopeful", "small joys"],
    text: `There is a man at the bus stop who brings a thermos and pours a cup for whoever shivers next to him. He never asks names. This morning it was my turn, black with one sugar, exactly right.
I don't know how to describe the hope I get from being guessed at by a stranger. The world has more quiet caretakers than the internet says. I want to be one of them on purpose now, not by accident.`,
  },
  {
    username: "seed-marrow",
    date: "2026-10-20 23:59:00",
    tags: ["tired"],
    text: `Third double shift this week. My legs ache like borrowed laundry, and my name badge says the wrong name again and I just let it.
A customer tonight said "you look like you've seen a whole winter." I almost cried at how chosen that sentence was, for my face, from a stranger. I am more tired than my answers let on. That's all. Good night, me.`,
  },
  {
    username: "seed-ollar",
    date: "2026-10-21 06:37:00",
    tags: ["family", "small joys"],
    text: `My sister taught my mother to send voice notes, and now 7am arrives with three minutes of yelling and a score update about a garden. My mother ends every message the same way: "okay, love, the kettle's calling me."
I used to roll my eyes at the kettle line. Today I saved the last one. The kettle line is how she says I love you, apparently. It only took the third continent and a few skipped calls to hear it.`,
  },
  {
    username: "seed-quillight",
    date: "2026-10-22 00:31:00",
    tags: ["work", "hopeful", "late night"],
    text: `I rewrote a resignation letter nine times tonight and deleted it nine times, which is more honesty than last year allowed me.
The office lights stay on all night in this part of the city, and I used to think that was ambition. Now I think half of them are people rewriting letters. Tomorrow I will not send it. The day after, maybe I will. Interesting how "no" is mostly a scheduling problem. Walking home now, 12:31, the bakery is already lifting shutters for people I will always admire slightly.`,
  },
];

export function seedIfEmpty(db) {
  const count = db.prepare("SELECT COUNT(*) AS n FROM accounts").get().n;
  if (count > 0) return;

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

  const tx = db.transaction(() => {
    const ids = CHIPS_SEEDS.map((s) => {
      // Seeds aren't meant to log in; give them unusable passwords.
      const { hash, salt } = hashPassword(randomBytes(24).toString("hex"));
      return { chip: s, id: insertAccount.run(s.username, hash, salt).lastInsertRowid };
    });

    for (const { chip, id } of ids) {
      const sentences = JSON.stringify(splitSentences(chip.text));
      insertEntry.run(id, chip.text, sentences, JSON.stringify(chip.tags), chip.date);
    }

    // A few warm anonymous comments between seeds (entry_id renders without names).
    insertComment.run(1, 2, "The rectangle. I know that rectangle. Holding you gently, stranger.", "2026-10-20 10:05:00");
    insertComment.run(1, 4, "Vacuum around it. Grief keeps its own small furniture.", "2026-10-20 12:41:00");
    insertComment.run(2, 5, "One sugar, exactly right? That's a person paying attention with a spoon.", "2026-10-20 08:30:00");
    insertComment.run(2, 1, "Be the thermos. Stealing this.", "2026-10-20 09:12:00");
    insertComment.run(3, 3, "a whole winter, seen and still standing. respect.", "2026-10-21 01:02:00");
    insertComment.run(4, 2, "The kettle line undid me. Saving it too.", "2026-10-21 11:47:00");
    insertComment.run(5, 3, "12:31. The bakery people see everything first. Rooting for letter number ten.", "2026-10-22 02:15:00");

    // Sprinkled sentence hearts so counts look alive.
    insertHeart.run(1, 0, 3);
    insertHeart.run(1, 2, 2);
    insertHeart.run(1, 2, 5);
    insertHeart.run(2, 1, 4);
    insertHeart.run(2, 3, 1);
    insertHeart.run(2, 3, 3);
    insertHeart.run(3, 0, 1);
    insertHeart.run(4, 2, 5);
    insertHeart.run(5, 3, 2);
    insertHeart.run(5, 4, 4);
    insertHeart.run(5, 4, 1);
  });
  tx();
}
