import express from "express";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate, db } from "./db.js";
import { seedIfEmpty } from "./seed.js";
import { sessionMiddleware } from "./lib/auth.js";
import { mountPeek } from "./routes/peek.js";
import { mountAuth } from "./routes/auth.js";
import { mountReactions } from "./routes/reactions.js";
import { mountPublish } from "./routes/publish.js";
import { mountMine } from "./routes/mine.js";
import { mountReports } from "./routes/reports.js";
import { mountModeration } from "./routes/moderation.js";

const here = dirname(fileURLToPath(import.meta.url));

migrate();
seedIfEmpty(db);

const app = express();
app.use(express.urlencoded({ extended: false })); // form posts (slices 4+)
app.use(express.json()); // the plugin's publish contract (slice 5+)

// Desktop/mobile app sandboxes (including Obsidian's renderer) treat a plain
// http://localhost pool as cross-origin and preflight non-simple POSTs (CORS).
// Echo the caller's origin and answer preflights for /api only — the pages
// themselves stay same-origin; no cookies are ever granted cross-site.
app.use("/api", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Vary", "Origin");
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST");
    res.setHeader(
      "Access-Control-Allow-Headers",
      String(req.headers["access-control-request-headers"] || "Content-Type")
    );
    res.setHeader("Access-Control-Max-Age", "600");
    res.status(204).end();
    return;
  }
  next();
});
app.use(express.static(join(here, "public")));
app.use(sessionMiddleware(db)); // reads the session cookie into req.account

mountPeek(app);
mountAuth(app);
mountReactions(app);
mountPublish(app);
mountMine(app);
mountReports(app);
mountModeration(app);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Diary of a Stranger — pool running at http://localhost:${PORT}`);
});
