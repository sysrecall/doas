# Diary of a Stranger

A quiet pool of strangers' latest diary pages. Read anonymously, heart the sentences
that land, and if you write in Obsidian, publish your newest entry with one command —
watching hearts come back to your lines.

The rules of the room (all enforced in code):

- **Anonymity to the pixel** — usernames are stored for login and never rendered
  anywhere: not on entries, not on comments, not even to you. Comments read as
  *"a stranger, 2 hours ago"*.
- **Only your newest entry is public** — the database holds one row per account and
  publishing *replaces* it. Yesterday's page comes down by itself.
- **Reading is open; reacting passes a small door** — hearts and comments need a
  username+password login, and the wrong-password and unknown-user failures are
  deliberately indistinguishable.
- **Hearts attach to sentences, not entries** — one per account per sentence,
  click again and nothing changes.
- **Comments stay small** — 140 characters, no name, time only.
- **A shared warm-mood vocabulary** — seven filter chips: melancholy, hopeful,
  tired, late night, family, work, small joys. Obsidian tags outside those seven
  are ignored, not guessed at.
- **A word-boundary ban list** checks comments and published entries alike;
  banned text is refused with a plain reason, and nothing is written.
- If a chip matches nobody's page tonight, the pool draws a random stranger
  *and* shows a dim whisper saying so — both, never one alone.

## Run the pool

```bash
npm install
npm start            # http://localhost:3000
```

The database is SQLite, created at `webapp/data/diary_pool.db`; five seeded
strangers (covering all seven chips, with seed hearts and comments) appear the
first time so the pool is never empty.

## See the payoff

- Peek around: `http://localhost:3000` — try the chips, or a nonsense one like
  `?tag=zebra` to meet the fallback.
- Create an account via **log in → create account**, heart a sentence, leave a note.
- Publish (next section), then visit **your page** (header) or `/mine`:
  your current public entry, heart counts and comments exactly as strangers see them.

## The Obsidian plugin

Build and install:

```bash
npm run build:plugin           # produces plugin/main.js (gitignored build artifact)
```

1. In your vault, create `.obsidian/plugins/diary-of-a-stranger/`
2. Copy `plugin/manifest.json`, `plugin/styles.css`, and `plugin/main.js` into it
3. Reload Obsidian → Settings → Community plugins → enable **Diary of a Stranger**
4. Fill the four settings: **pool address** (e.g. http://localhost:3000),
   **diary folder** (the vault folder holding your diary notes, e.g. `Diary` —
   subfolders are searched too; `/` searches the whole vault), **username**,
   **password**
5. Run the command palette → **Diary of a Stranger: Publish to Diary of a Stranger**

The plugin picks your newest note by date-prefixed filename (`YYYY-MM-DD…`)
when present, otherwise by most recently modified. Frontmatter/inline tags that
match the seven chips come pre-checked in the preview; the preview shows exactly
what will be sent. Nothing is published until you confirm.

A note on trust: usernames and passwords live in the plugin's settings inside
your vault — it's your machine and your config file; the pool only ever stores
the account record.

## The plugin's contract, machine-checked

```bash
npm test
```

Spawns a **scratch pool** (own port, own database — your learning pool stays
untouched) and replays the plugin's exact POST payloads: first publish creates
the account, republish replaces the same entry row, tags normalize to the seven
chips, wrong passwords and banned words are refused as designed. Ten checks, all
against `POST /api/publish`.

## Demo script

The two-minute tour, for the demo video or your own kick-the-tires pass:

1. `npm start` → open `http://localhost:3000` — read a stranger, click **turn to
   another stranger →** a few times, try a chip row entry.
2. Try a nonsense filter (`?tag=zebra`): random stranger + the dim whisper.
3. **log in → create account** (ten seconds, no email) → heart two different
   sentences, post one comment, reload — counts stick, everything nameless.
4. In Obsidian: palette → **Publish to Diary of a Stranger** → confirm the preview
   → visit **your page**: your entry, as strangers see it, hearts on the lines that
   landed.
5. Report a comment (quiet `report` link) — watch it vanish; visit
   `http://localhost:3000/moderation` — the review desk lists it with content and
   time. Report a whole page and it's gone from the draws instantly.

## Layout

```
webapp/                the pool server (no client-side JS — form posts, SSR views)
  server.js            Express wiring
  db.js                schema + queries (accounts, entries, hearts, comments, reports, sessions)
  seed.js              five initial strangers
  lib/                 auth, moderation, sentence splitting
  routes/              peek, auth, reactions, publish, mine
  views/               SSR page templates + shared entry renderer
  public/style.css     the nostalgic-warm theme
plugin/                the Obsidian plugin (TypeScript; esbuild → main.js)
devpost/               planning documents + checks/
```
