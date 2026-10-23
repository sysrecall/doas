// GET /mine — the payoff page, login-gated with the ?next return.
// Implements `prd.md > The writer's payoff`.

import { getEntryForAccount } from "../db.js";
import { renderMine } from "../views/mine.js";

export function mountMine(app) {
  app.get("/mine", (req, res) => {
    if (!req.account) {
      res.redirect(303, "/login?next=/mine");
      return;
    }
    const entry = getEntryForAccount(req.account.id); // newest-only by structure: one row per account
    res.send(renderMine({ entry, account: req.account }));
  });
}
