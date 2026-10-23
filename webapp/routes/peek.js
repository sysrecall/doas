import { chooseEntry } from "../db.js";
import { renderPeek } from "../views/peek.js";

export function mountPeek(app) {
  app.get("/", (req, res) => {
    const excludeId = req.query.after != null ? Number(req.query.after) : null;
    const entry = chooseEntry({ excludeId });
    res.send(renderPeek(entry));
  });
}
