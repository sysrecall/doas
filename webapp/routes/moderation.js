// GET /moderation — the review desk. Unadvertised: nothing links here; you have
// to know the address. Lists every report ever, content beside it.

import { listReports } from "../db.js";
import { renderModeration } from "../views/moderation.js";

export function mountModeration(app) {
  app.get("/moderation", (req, res) => {
    res.send(renderModeration({ reports: listReports() }));
  });
}
