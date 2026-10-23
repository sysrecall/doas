// Login / sign-up — one small warm page, both doors, the ?next return.
// Reading is open; these pages only exist to grant the permission to react.
// Implements `prd.md > Accounts and login`.

import { layout, esc } from "./layout.js";

function safeNext(next) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

function doorForm({ action, heading, button, next, extra = "" }) {
  return `
    <form class="door-form" method="post" action="${action}">
      <h2 class="door-heading">${esc(heading)}</h2>
      ${extra}
      <input type="hidden" name="next" value="${esc(next)}" />
      <label class="door-label">username
        <input class="door-input" name="username" autocomplete="username" required minlength="2" maxlength="40" />
      </label>
      <label class="door-label">password
        <input class="door-input" name="password" type="password" autocomplete="current-password" required minlength="6" maxlength="128" />
      </label>
      <button class="door-button" type="submit">${esc(button)}</button>
    </form>`;
}

export function renderLoginPage({ next = "/", error = null, notice = null, signUpError = null } = {}) {
  const ret = safeNext(next);
  return layout({
    extraClass: "page-login",
    body: `
    <div class="door-card">
      <p class="door-notice">reacting asks a permission door — usernames are never shown to anyone, not even the person writing the entry.</p>
      ${notice ? `<p class="door-message door-quiet">${esc(notice)}</p>` : ""}
      ${error ? `<p class="door-message door-error">${esc(error)}</p>` : ""}
      ${signUpError ? `<p class="door-message door-error">${esc(signUpError)}</p>` : ""}
      ${doorForm({
        action: "/login",
        heading: "have a key?",
        button: "log in",
        next: ret,
      })}
      ${doorForm({
        action: "/signup",
        heading: "new stranger?",
        button: "create account",
        next: ret,
        extra: `<p class="door-fineprint">no email is collected; a lost password means a new account. that's the PoC tradeoff, on purpose.</p>`,
      })}
      <p class="door-back"><a href="/">← go back to reading instead</a></p>
    </div>`,
  });
}
