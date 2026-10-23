// Password hashing (crypto.scrypt + per-account salt) and session-token helpers.
// Deliberately dependency-free — plain Node stdlib, per the spec.

import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(password), salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password, hash, salt) {
  const candidate = scryptSync(String(password), salt, 64);
  const stored = Buffer.from(hash, "hex");
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}

export function newSessionToken() {
  return randomUUID().replace(/-/g, "") + randomBytes(8).toString("hex");
}

// ---- cookie helpers (tiny, on purpose) ----

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    const name = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    out[name] = decodeURIComponent(value);
  }
  return out;
}

// Express middleware: attaches `req.cookies` and `req.account` (or null).
export function sessionMiddleware(db) {
  const findSession = db.prepare(
    `SELECT s.token, a.id, a.username
       FROM sessions s JOIN accounts a ON a.id = s.account_id
      WHERE s.token = ?`
  );
  return (req, res, next) => {
    const cookies = parseCookies(req.headers.cookie);
    req.cookies = cookies;
    req.account = null;
    if (cookies.sess) {
      const hit = findSession.get(cookies.sess);
      if (hit) req.account = { id: hit.id, username: hit.username };
    }
    next();
  };
}

// Same generic failure for unknown username and wrong password (PRD rule).
export function credentialFailureLine() {
  return "That username and password don't match anything in the pool.";
}
