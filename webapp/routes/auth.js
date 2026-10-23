// Login/sign-up/logout routes. Implements `prd.md > Accounts and login`:
// username + password, no email, same generic failure for unknown-user and
// wrong-password, `?next=` returns you to what you were reading.

import { db } from "../db.js";
import {
  hashPassword,
  verifyPassword,
  newSessionToken,
  credentialFailureLine,
} from "../lib/auth.js";
import { renderLoginPage } from "../views/login.js";

const GENERIC = credentialFailureLine();

function safeNext(next) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

function setSessionCookie(res, token) {
  res.setHeader("Set-Cookie", `sess=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", "sess=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
}

export function mountAuth(app) {
  app.get("/login", (req, res) => {
    res.send(renderLoginPage({ next: safeNext(req.query.next) }));
  });

  app.post("/login", (req, res) => {
    const { username = "", password = "", next = "/" } = req.body || {};
    const row = db.prepare(`SELECT id, password_hash, password_salt FROM accounts WHERE username = ?`).get(String(username).trim());
    const ok = row && verifyPassword(String(password), row.password_hash, row.password_salt);
    if (!ok) {
      res.status(401).send(renderLoginPage({ next, error: GENERIC }));
      return;
    }
    const token = newSessionToken();
    db.prepare(`INSERT INTO sessions (token, account_id) VALUES (?, ?)`).run(token, row.id);
    setSessionCookie(res, token);
    res.redirect(303, safeNext(next));
  });

  app.post("/signup", (req, res) => {
    const { username = "", password = "", next = "/" } = req.body || {};
    const name = String(username).trim();
    // Plugin flow can also create accounts (slice 5); the web door is just as patient.
    if (name.length < 2 || name.length > 40) {
      res.status(422).send(renderLoginPage({ next, signUpError: "Usernames live between 2 and 40 characters." }));
      return;
    }
    if (String(password).length < 6) {
      res.status(422).send(renderLoginPage({ next, signUpError: "Passwords need at least 6 characters — this door has no reset, so choose something you'll remember." }));
      return;
    }
    const exists = db.prepare(`SELECT id FROM accounts WHERE username = ?`).get(name);
    if (exists) {
      res.status(409).send(renderLoginPage({ next, signUpError: "That name is already in the pool. Try logging in instead." }));
      return;
    }
    const { hash, salt } = hashPassword(password);
    const id = db
      .prepare(`INSERT INTO accounts (username, password_hash, password_salt) VALUES (?, ?, ?)`)
      .run(name, hash, salt).lastInsertRowid;
    const token = newSessionToken();
    db.prepare(`INSERT INTO sessions (token, account_id) VALUES (?, ?)`).run(token, id);
    setSessionCookie(res, token);
    res.redirect(303, safeNext(next));
  });

  app.post("/logout", (req, res) => {
    if (req.cookies?.sess) {
      db.prepare(`DELETE FROM sessions WHERE token = ?`).run(req.cookies.sess);
    }
    clearSessionCookie(res);
    res.redirect(303, "/");
  });
}
