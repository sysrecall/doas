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
