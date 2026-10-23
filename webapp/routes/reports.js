// Reports — any reader, logged in or not (PRD > Moderation; the learner-decided
// safety answer for anonymous content). A report hides its target immediately
// and lands on /moderation for review.
//
//   POST /report  body: type ('entry'|'comment'), id

import { findComment, reportEntry, reportComment } from "../db.js";

export function mountReports(app) {
  app.post("/report", (req, res) => {
    const type = String(req.body?.type ?? "");
    const id = Number(req.body?.id);

    if (type === "entry" && Number.isInteger(id)) {
      reportEntry(id);
      // The reported page comes out of the draw the moment it's done —
      // send the reporter on to a fresh stranger instead of back onto it.
      res.redirect(303, "/");
      return;
    }

    if (type === "comment" && Number.isInteger(id)) {
      const c = findComment(id);
      if (c) {
        reportComment(id);
        res.redirect(303, `/?entry=${c.entry_id}`); // back to that entry, comment gone
        return;
      }
    }

    res.status(404).send("Nothing to report there.");
  });
}
