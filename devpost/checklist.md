---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast (chosen at first build session; can be changed any time)

## Slices

- [x] **1. Read a stranger — Peek page with seeded pool**
  Becomes usable: `npm start` brings up the pool; opening `localhost:3000` shows one seeded stranger's entry rendered warm and anonymous (split into sentences, per-sentence heart counts showing, no name anywhere), and a "next" control draws another.
  Why now: Proves the entire read path end to end — scaffold, database, seed data, view, styling — and the kernel's *display* half exists from step one; every later slice lands on this.
  PRD ref: `prd.md > The Core Journey` (step 1), `prd.md > Screens and Layout` (Peek page), `prd.md > The seed pool (first use)`
  Spec ref: `spec.md > Components > The pool (data + rules)`, `spec.md > Components > Pool server`, `spec.md > Components > Seed strangers`, `spec.md > File Structure`
  Build: Root scaffold (package.json, Express, better-sqlite3, gitignore for the .db), schema and seed strangers (five, covering all seven chips, sentences pre-split), layout + peek views, the nostalgic-warm stylesheet, random draw with "different from the one shown".
  Verify (mechanical): server starts clean; `curl /` returns HTML containing the entry sentences and zero usernames; two consecutive `curl /` runs draw valid entries.
  Learner check: Open `localhost:3000`, read a stranger, click "next" a few times — does the reading experience feel the way you pictured it?
  Commit: `Scaffold pool and Peek page with seeded strangers`

- [x] **2. Filter chips and the fallback whisper**
  Becomes usable: The seven mood/keyword chips sit in one quiet row; clicking one narrows the draw to matching entries; and when nothing matches, you get a random entry *plus* the dim warm whisper line.
  Why now: Completes the reading experience — the demoable "diverse set" principle becomes visible, and it's still cheap to reshape the look and feel since nothing else exists yet.
  PRD ref: `prd.md > The Core Journey` (step 2), `prd.md > The peek (reading a stranger)` (chip list)
  Spec ref: `spec.md > Components > The pool (data + rules)`, `spec.md > Components > Pool server`
  Build: Chip row as links; `GET /?tag=…` filtering on entry tags; fallback-to-random + whisper render for empty matches.
  Verify (mechanical): `curl /?tag=melancholy` returns an entry tagged melancholy; `curl /?tag=nonexistent` returns a valid entry *and* the whisper markup.
  Learner check: Try each chip, then try to break one — does the fallback feel like the mood the PRD described?
  Commit: `Add mood filter chips with fallback whisper`

- [x] **3. Accounts, login, the permission door**
  Becomes usable: Sign-up and login work; a session cookie lets you in; reading stays fully open; wrong credentials get the same generic message whether the username exists or not.
  Why now: Hearts and comments are login-gated by an approved product decision (accounts as a door, not a face), so the gate has to exist before the kernel's *interaction* half can.
  PRD ref: `prd.md > Accounts and login`, `prd.md > States and Boundaries` (wrong password)
  Spec ref: `spec.md > Components > Accounts and sessions`, `spec.md > File Structure` (lib/auth.js), `spec.md > Data Model` (accounts, sessions)
  Build: Auth lib (scrypt + salt, session token cookie middleware), login/signup/logout routes and small page, the `?next=` return, sessions table.
  Verify (mechanical): signup → login by captured cookie works; wrong password and unknown username return identical messages; logged-out users are still able to read.
  Learner check: Sign up in the browser, log out, log in again, and try the wrong password on purpose.
  Commit: `Add accounts and session login`

- [x] **4. The kernel: sentence hearts and short comments**
  Becomes usable: Clicking a heart on a *sentence* (only while logged in) increments its count, clicks are idempotent, and a comment of ≤140 characters appears under the entry with time and no name. This is the product's distinctive behavior, live.
  Why now: The kernel lands early — not last — and by stacking it directly after the login slice, one leg of the core journey (read → react) is complete.
  PRD ref: `prd.md > The peek (reading a stranger)`, `prd.md > The Unique Kernel`
  Spec ref: `spec.md > Components > Reactions (hearts + comments)`, `spec.md > Data Model` (hearts, comments), `spec.md > File Structure` (lib/sentences.js)
  Build: Sentence-split helper, per-sentence heart forms with counts, comment form with server-side 140 limit and banned-word check, idempotent heart upserts.
  Verify (mechanical): with a cookie: heart → count +1, heart again → still +1; comment posts, 141-char blocked, banned word blocked; logged-out heart redirects to `/login?next=…`.
  Learner check: Heart two sentences, post a comment, then reload — do the counts stick and does the anonymity hold?
  Commit: `Add sentence hearts and short comments, login-gated`

- [x] **5. Publish endpoint — newest-entry replacement**
  Becomes usable: A real writer can send their latest entry + tags + credentials to the pool; a new username becomes an account; a re-publish **replaces** the old entry; banned words refuse with a plain-language reason. (Verified here with curl standing in as the plugin.)
  Why now: The writing half of "read a stranger / be one" starts here, and the plugin (slice 7) is only a UI for this contract — the contract should be true before the UI exists.
  PRD ref: `prd.md > Publishing from Obsidian (the plugin)`, `prd.md > States and Boundaries` (publish replaces)
  Spec ref: `spec.md > Components > Publishing`, `spec.md > Data Model` (entries UPSERT), `spec.md > File Structure` (routes/publish.js)
  Build: `POST /api/publish` (verify-or-create account, ban check, sentence split, tag normalization, UPSERT + replacement-of-old), tags from Obsidian inline/frontmatter sources matched to the seven chips.
  Verify (mechanical): curl-publish v1 → shows in draws; curl-publish v2 → v2 present and v1 gone; password-fail → generic message; banned word → refused with reason.
  Learner check: The payoff comes in slice 6 — here I show you one exact curl-equivalent of the plugin and what it changed in the pool.
  Commit: `Add publish endpoint with newest-entry replacement`

- [x] **6. The payoff page — My Entry**
  Becomes usable: Log in, visit `/mine`, see your own current public entry exactly as strangers see it — every sentence's heart count and every comment, still anonymous.
  Why now: The emotional payoff of the loop ("appreciation flows back") becomes real, which makes the full core journey demoable one step before the plugin arrives.
  PRD ref: `prd.md > The writer's payoff`, `prd.md > Screens and Layout` (My Entry)
  Spec ref: `spec.md > Components > Pool server` (routes), `prd.md > What "Working" Looks Like`
  Build: `/mine` route (login-gated with `next`), payoff view reusing the peek rendering with per-sentence counts emphasized.
  Verify (mechanical): as a throwaway user: publish two entries via curl (slice 5's endpoint) to prove only the latest one is shown on `/mine`, with counts + comments matching.
  Learner check: Publish your own test entry with the curl I hand you, log in, and see hearts on your sentences.
  Commit: `Add My Entry payoff page`

- [x] **7. The Obsidian plugin**
  Becomes usable: A buildable, contract-tested Obsidian plugin exists: command + four settings (pool address, diary folder, username, password), newest-note discovery, preview modal with chip toggles, ban-check before sending. Its real-world proof stays with you and Obsidian, as agreed in the spec.
  Why now: The riskiest and most distinctive piece — built as late as deps allow but right after its contract is live, so this build sends it to a working pool.
  PRD ref: `prd.md > Publishing from Obsidian (the plugin)`, `prd.md > States and Boundaries` (plugin states)
  Spec ref: `spec.md > Components > The Obsidian plugin`, `spec.md > Stack` (sample plugin), `spec.md > Decisions and Open Issues` (newest-note choice)
  Build: manifest + esbuild + tsconfig + main.ts (settings, newest-note-by-date-prefix-then-mtime, tag extraction, preview, POST), plus the README install steps.
  Verify (mechanical): clean build to `main.js`; contract test node script that mimics the plugin's exact POST payloads (success, banned-word refusal, wrong password).
  Learner check: (Deferred, per spec) — I'll show you exactly where the built plugin goes in your vault, and your first real publish is the check we agreed on; meanwhile you watch the contract test pass.
  Commit: `Add Obsidian publish plugin (buildable, contract-tested)`

- [x] **8. Moderation — report and review**
  Becomes usable: Any reader can report a comment or entry; reported content stops appearing in draws immediately; the unadvertised `/moderation` page lists everything flagged with content and time. The README gets its final demo steps. The loop is closed.
  Why now: The last PRD behavior; reporting is the learner-decided safety answer to anonymous content, and it closes the final open edge of the approved loop.
  PRD ref: `prd.md > Moderation`, `prd.md > States and Boundaries` (report)
  Spec ref: `spec.md > Components > Moderation`, `spec.md > File Structure` (routes/reports.js, routes/moderation.js)
  Build: Report forms on comments and entries, reports table + hidden flags, `/moderation` view, README run/install/demo sections.
  Verify (mechanical): report a seeded comment → it stops drawing and shows on `/moderation`; report an entry → same; nothing disappears from the review list.
  Learner check: Report a comment, watch it vanish, then visit `/moderation` and confirm the record is there.
  Commit: `Add report and moderation review page`

## Hands-on Checkpoints

- [x] Early usable behavior explored — after slice 2 (full reading experience: look, vibe, chips, fallback)
- [x] Core-journey integrated check — after slice 7 (publish → payoff loop end to end in the browser, with the plugin's real contract passing; real-Obsidian publish stays with you, per spec agreement) — **done: learner's real plugin publish (0.1.3) landed in the pool and showed on /mine; curl publish, read/react loop, and contract test passed alongside it; two real-world plugin bugs found and fixed en route**
- [x] Final kick-the-tires exploration and feedback completed — toured during the plugin debugging rounds and after; feedback: publish-on-save requested and built (0.2.1, both toggles confirmed wanted), everything else fine; no further changes wanted

## Final Review

- [x] Final review complete — feedback resolved and learner confirms ready to ship (confirmed after: the copy tweaks, tag continuity, scrollbar-gutter fix, and the production pass; pool-side publish failure root-caused to a stale running process and resolved)

## Code Tour and App Map

- [x] Learning activity complete — guided route (publish, the action the learner had already proven from real Obsidian, traced through its three owners)
- [x] Optional edit and transfer reflection addressed — footer-string edit offered; learner kept a change of their own ("Isn't everything amazing?") — verified and committed; reflection question offered, pending answer
- [x] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: guided route after final review on `localhost:3000` live; stops: (1) `plugin/main.ts` → `sendToPool` (2) `webapp/routes/publish.js` → `normalizeTags` topping into `webapp/db.js` → `publishEntry` (3) `webapp/routes/mine.js` + `webapp/views/entry.js` → `entryBody`; anchor strings verified by grep against current source; map's 18-checks claim cross-checked against the contract test.
Route and stops: completed interactively by the learner (guided route above); the map repeats the same route labeled for reference.
Edit outcome: kept by the learner (footer string in `webapp/views/layout.js`), syntax-checked and verified live; committed as their edit.
Reflection: offered once — "What would you do differently next time you start with an agent?"; answer optional.
Activity mode: live app + editor (learner's machine; pool running at `localhost:3000`).

## Revisions

<!-- Leave this section empty when you write the checklist — no placeholder bullet.
     `5-build` appends a bullet here when implementation contradicts an assumption
     in the plan, in the form:

       - [What changed] — [what the build discovered that made the original plan wrong].

     One bullet per revision, no dates. This is how plan adaptation gets recorded,
     and it replaces any separate log. -->

- Plugin note discovery rebuilt (subfolders searched recursively, `/` = whole vault, leading/trailing slashes and dots normalized, diagnostic Notices listing the vault's actual folders) — the first real Obsidian publish stopped at "no markdown files in Diary": real note setups don't all match one direct-children-only scan of one exactly-typed folder name.
- The plugin's send switched from renderer `fetch` to Obsidian's `requestUrl`, the modal's send path got a catch that Notices on any crash, and the pool now serves CORS preflights for `/api` (contract test asserts both) — the second real publish died with no Notice at all: a sandboxed renderer's cross-origin POST to plain http://localhost can be blocked before it ever produces an error the old code could surface; the loss of every failure notice was the tell.

- The publish preview modal is now `.open()`ed after construction (`new PublishModal(...)` alone shows nothing in Obsidian and fails silently) — your console trail (`publish flow started` → `diary folder … found` → nothing) pinned every attempted publish to exactly the modal step with no error, because the preview was never opened and the send path was never reached.

- Added an opt-in **Auto publish** setting (off by default; manual preview path untouched) — learner requested during kick-the-tires: publish the newest diary note once at Obsidian startup and after a quiet period post-editing, no preview, identical-content skips, refusals still surfaced. Deliberate tradeoff recorded rather than hidden in code: auto-publish intentionally bypasses the "writer approves what goes out" preview, and the writer opts into that.
- The seed pool was rebuilt (7 strangers for 7 chips, relative timestamps computed at seed time, all texts rewritten as lived-in diary voices) — hardcoded dates would have made the demo pool read "stale entries from last week", and one-writer chips meant several filters could draw the same entry repeatedly.
- Republish now clears a stale report-hiding flag — publishing replaces the row's text in place, so a report against the OLD text would have kept the writer's genuinely republished note invisible in draws forever.
- Native Obsidian tags now flow into publication and the writer's checkboxes became the final word on the payload — real publishing revealed two defects: Obsidian's inline tags can't contain spaces (writers use hyphens, `#small-joys`), so exact-match chip detection silently missed them; and the send path merged the note's found tags back in even after the writer unchecked them. Fix: one shared chip-vocabulary module (imported by both the pool and the plugin bundle), and the preview's checkboxes are the single source of the sent tags. (0.3.1)

## Ship

- [x] GitHub repository created and pushed by the learner — `git@github.com:sysrecall/doas.git`; `main` synced at `8ef8094` (seed-pool refresh, hidden-flag fix, native-tag fixes all included)
- [x] Privacy verification before publish — whole-history scan finds no database, no backups, no `learner-profile.md`, no bundle artifact, no secrets anywhere in the pushed tree; real user data (`john`, session rows, password hashes) lives only in the gitignored local db
- [ ] **Repository visible without auth** — learner verified it exists on github.com while logged in; visibility flip to public pending (24.10 record: unauthenticated web + API both 404, i.e. currently private). MUST be public before the Devpost submission links it
- [x] MIT license added (`LICENSE`, 2026 sysrecall; reviewer's earlier offer accepted) + README License section — pushed with the same push as the ship log
- [ ] Demo video recorded and linked
- [ ] Devpost submission fields authored by the learner; exit survey answered; submission sent

- Note: the three planning docs (`devpost/scope.md`, `prd.md`, `spec.md`) remain deliberately untracked; staging them for the repo is the learner's call at publish time (privacy-reviewed and safe).
