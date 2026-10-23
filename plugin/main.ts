// Diary of a Stranger — Obsidian publish plugin.
// One command: "Publish to Diary of a Stranger". Four settings.
// Newest note discovery: date-prefixed filename (YYYY-MM-DD…) first, else
// most recently modified inside the configured diary folder (spec decision).

import {
  App,
  Modal,
  Notice,
  PluginSettingTab,
  Setting,
  Vault,
  TFile,
  TFolder,
  Plugin,
  requestUrl,
  RequestUrlResponse,
} from "obsidian";

// Chip vocabulary and normalization come from ONE shared file the pool server
// uses too (webapp/lib/chips.js) — bundled in here so both sides spell the
// seven chips identically and refuse the same unknowns. This plugin never
// edits that source of truth; unchecking a mood checkbox is final everywhere.
import { CHIPS, normalizeTag } from "../webapp/lib/chips.js";

// Windows/desktop builds: manifest and bundle are versioned together; the
// Community plugins panel shows this, so a stale copy is immediately visible.
const VERSION = "0.3.1";

// How long the writing must go quiet before an auto-publish fires. Diaries
// breathe slowly; every keystroke must not be a publish (kernel cost: each
// publish rewrites the writer's one pool row — cheap, but not free).
const AUTO_DELAY_MS = 3 * 60 * 1000;
// "Publish on save": Obsidian saves as you pause typing (there is no discrete
// save action), so "on save" means a short pause with intent — a few seconds.
const QUICK_DELAY_MS = 5 * 1000;

// Chips are runtime-validated through normalizeTag / the modal's labels, so
// typing stays honest at the data boundary.
type Chip = string;

interface DiaryOfAStrangerSettings {
  poolAddress: string;
  diaryFolder: string;
  username: string;
  password: string;
  autoPublish: boolean;
  autoPublishQuick: boolean;
}

const DEFAULT_SETTINGS: DiaryOfAStrangerSettings = {
  poolAddress: "http://localhost:3000",
  diaryFolder: "Diary",
  username: "",
  password: "",
  autoPublish: false,
  autoPublishQuick: false,
};

// ---------- tag extraction (plain markdown mechanics) ----------

function stripFrontmatter(content: string): { body: string; fmTags: string[] } {
  if (!content.startsWith("---")) return { body: content, fmTags: [] };
  const end = content.indexOf("\n---", 3);
  if (end === -1) return { body: content, fmTags: [] };
  const fm = content.slice(3, end);
  const body = content.slice(end + 4);
  const tags: string[] = [];

  // frontmatter forms: `tags: a, b` or a YAML list `tags:` + `- item` lines
  const lines = fm.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^tags\s*:\s*(.*)$/);
    if (!m) continue;
    const inline = m[1].trim();
    if (inline) {
      for (const t of inline.replace(/^\[|\]$/g, "").split(",")) {
        const clean = t.trim().replace(/^#/, "");
        if (clean) tags.push(clean);
      }
    }
    for (let j = i + 1; j < lines.length; j++) {
      const li = lines[j].match(/^\s*-\s*(.+)$/);
      if (!li) break;
      const clean = li[1].trim().replace(/^#/, "");
      if (clean) tags.push(clean);
    }
    break;
  }
  return { body, fmTags: tags };
}

// Anything the note marks (frontmatter `tags:`, inline `#tags`) that speaks the
// pool's language becomes a chip; obsidian-native spellings like "#small-joys"
// normalize like the server would. Unknown tags stay unknown — never guessed.
function inlineHashtags(body: string): string[] {
  const out: string[] = [];
  const re = /(^|[\s(])#([\p{L}\p{N}_/-]+)/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) out.push(m[2]);
  return out;
}

export function chipsFromNote(content: string): Chip[] {
  const { body, fmTags } = stripFrontmatter(content);
  const raw = [...fmTags, ...inlineHashtags(body)];
  const hit = new Set<Chip>();
  for (const t of raw) {
    const chip = normalizeTag(t);
    if (chip) hit.add(chip as Chip);
  }
  return [...hit];
}

// ---------- newest-note discovery ----------

function datePrefix(name: string): string | null {
  const m = name.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

// Obsidian paths are relative to the vault root and reject leading/trailing
// slashes and "." — people type exactly those (real-world publish feedback).
function normalizeFolderPath(raw: string): string {
  const cleaned = (raw || "").trim().replace(/^\/+/, "").replace(/\/+$/, "");
  return cleaned === "." ? "" : cleaned;
}

// Recursive: markdown notes in subfolders of the diary folder count too.
function collectMarkdown(folder: TFolder, out: TFile[]): void {
  folder.children.forEach((f) => {
    if (f instanceof TFile && f.extension === "md") out.push(f);
    else if (f instanceof TFolder) collectMarkdown(f, out);
  });
}

// Date-prefixed notes win by their purposed name; otherwise mtime decides.
function chooseNewest(files: TFile[]): TFile | null {
  if (files.length === 0) return null;
  let dated: TFile | null = null;
  let bestDate: string | null = null;
  for (const f of files) {
    const d = datePrefix(f.name);
    if (d && (bestDate === null || d > bestDate)) {
      bestDate = d;
      dated = f;
    }
  }
  if (dated) return dated;
  return [...files].sort((a, b) => b.stat.mtime - a.stat.mtime)[0];
}

// ---------- the publish preview modal (the only place identity is visible: nobody's) ----------

class PublishModal extends Modal {
  private note: TFile;
  private text: string;
  private native: Chip[];
  private poolAddress: string;
  private onPublish: (tags: Chip[]) => void;

  constructor(
    app: App,
    opts: { note: TFile; text: string; native: Chip[]; poolAddress: string; onPublish: (tags: Chip[]) => void }
  ) {
    super(app);
    this.note = opts.note;
    this.text = opts.text;
    this.native = opts.native;
    this.poolAddress = opts.poolAddress;
    this.onPublish = opts.onPublish;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("div", { cls: "das-source", text: `from: ${this.note.name}` });
    const preview = contentEl.createEl("div", { cls: "das-preview" });
    const trimmed = this.text.length > 1400 ? this.text.slice(0, 1400) + " …" : this.text;
    preview.textContent = trimmed;
    //The writer approves exactly what goes out — the private things never leave.

    const nativeLine =
      this.native.length > 0 ? ` — pre-checked, found in your note: ${this.native.join(", ")}` : "";
    contentEl.createEl("div", { cls: "das-source", text: `moods for the pool${nativeLine}` });

    const checks = contentEl.createEl("div", { cls: "das-checks" });
    const boxes: HTMLInputElement[] = CHIPS.map((chip) => {
      const label = checks.createEl("label", { cls: "das-check" });
      const input = label.createEl("input", { type: "checkbox" }) as HTMLInputElement;
      label.createEl("span", { text: chip });
      input.value = chip;
      input.checked = this.native.includes(chip);
      input.addEventListener("change", () => label.classList.toggle("is-active", input.checked));
      if (input.checked) label.classList.add("is-active");
      return input;
    });

    const actions = contentEl.createEl("div", { cls: "das-actions" });
    const cancel = actions.createEl("button", { text: "not tonight" });
    cancel.addEventListener("click", () => this.close());
    actions.createEl("span", { cls: "spacer" });
    const go = actions.createEl("button", { text: "publish", cls: "mod-cta" });
    go.addEventListener("click", () => {
      const picked = boxes.filter((b) => b.checked).map((b) => b.value as Chip);
      console.log(`[DoaS v${VERSION}] preview confirmed, closing (tags picked: ${picked.join(", ") || "none"})`);
      this.close();
      // Never let the send path fail silently — the writer gets a Notice for
      // network failures, refusals, AND crashes (real-world lesson).
      Promise.resolve(this.onPublish(picked)).catch((e: any) => {
        console.log(`[DoaS v${VERSION}] send path CRASHED: ${e?.message ?? e}`);
        new Notice("Publishing didn't happen this time — try again in a moment.");
      });
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

// ---------- the plugin ----------

export default class DiaryOfAStrangerPlugin extends Plugin {
  settings: DiaryOfAStrangerSettings = DEFAULT_SETTINGS;
  private autoTimer: number | null = null;
  private lastAutoText: string | null = null;

  async onload() {
    await this.loadSettings();
    console.log(`[DoaS v${VERSION}] plugin loaded (pool: ${this.settings.poolAddress})`);

    this.addCommand({
      id: "publish-latest",
      name: "Publish to Diary of a Stranger",
      callback: () => {
        // Any crash inside the flow becomes a visible Notice, never a mystery —
        // and never raw technical text: the console keeps the cause.
        this.publishFlow().catch((e: any) => {
          console.log(`[DoaS v${VERSION}] flow CRASHED: ${e?.message ?? e}`);
          new Notice("Publish didn't happen this time — try again in a moment.");
        });
      },
    });

    this.addSettingTab(new DiarySettingTab(this.app, this));

    // Auto mode (opt-in): the sweep listens while the writer types; the settle
    // timer decides when a publish is actually worth sending (auto priority
    // re-checked at fire time, so toggling off mid-window cancels the send).
    this.registerEvent(
      this.app.vault.on("modify", (f) => {
        if (!this.settings.autoPublish) return;
        if (!(f instanceof TFile) || f.extension !== "md") return;
        if (!this.isInDiaryArea(f.path)) return;
        this.queueAutoPublish();
      })
    );

    // "The latest entry should be up" also at fresh eyes: one attempt per launch.
    if (this.settings.autoPublish) this.queueAutoPublishSoon(8000); // let Obsidian settle first
  }

  private runAutoPublishGraceful() {
    this.runAutoPublish().catch((e) => console.log(`[DoaS v${VERSION}] auto-publish crashed: ${e?.message ?? e}`));
  }

  // --- auto-publish (opt-in; learner-requested during kick-the-tires) ---

  private isInDiaryArea(path: string): boolean {
    const folder = normalizeFolderPath(this.settings.diaryFolder);
    if (!folder) return true; // "/" = the whole vault
    return path === folder || path.startsWith(folder + "/");
  }

  queueAutoPublish() {
    // The settle window: diary-calm (3 min), or save-driven (seconds) when the
    // writer opts into publishing on save.
    this.queueAutoPublishSoon(this.settings.autoPublishQuick ? QUICK_DELAY_MS : AUTO_DELAY_MS);
  }

  queueAutoPublishSoon(ms: number) {
    if (this.autoTimer != null) window.clearTimeout(this.autoTimer);
    // The timer checks autoPublish again at fire time — toggling off mid-window cancels the send.
    this.autoTimer = window.setTimeout(() => {
      this.autoTimer = null;
      this.runAutoPublishGraceful();
    }, ms);
    console.log(`[DoaS v${VERSION}] auto-publish queued (~${Math.round(ms / 1000)}s from now)`);
  }

  cancelAutoPublish() {
    if (this.autoTimer != null) {
      window.clearTimeout(this.autoTimer);
      this.autoTimer = null;
      console.log(`[DoaS v${VERSION}] auto-publish timer cancelled`);
    }
  }

  private async runAutoPublish() {
    if (!this.settings.autoPublish) return;
    const missing = this.configured();
    if (missing.length > 0) {
      console.log(`[DoaS v${VERSION}] auto-publish skipped, missing settings: ${missing.join(", ")}`);
      return;
    }
    const folderPath = normalizeFolderPath(this.settings.diaryFolder);
    const target = folderPath ? this.app.vault.getAbstractFileByPath(folderPath) : this.app.vault.getRoot();
    if (!target || !(target instanceof TFolder)) {
      // Auto stays quiet about missing folders (the manual command's Notices are
      // the discovery tools) — only the console keeps the trail.
      console.log(`[DoaS v${VERSION}] auto-publish skipped: folder "${folderPath}" not found`);
      return;
    }
    const files: TFile[] = [];
    collectMarkdown(target, files);
    const note = chooseNewest(files);
    if (!note) {
      console.log(`[DoaS v${VERSION}] auto-publish skipped: no markdown notes found`);
      return;
    }
    const content = await this.app.vault.read(note);
    const { body } = stripFrontmatter(content);
    const plain = body.trim();
    if (!plain) return;
    // Identical content skips the send (no re-publish churn while idle).
    if (plain === this.lastAutoText) {
      console.log(`[DoaS v${VERSION}] auto-publish skipped: unchanged since last publish`);
      return;
    }
    const tags = chipsFromNote(content);
    const ok = await this.sendToPool(note, plain, tags, true);
    if (ok) this.lastAutoText = plain; // only remember successes, so failures retry
  }

  private async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  // public: the settings tab writes through this after each field edit.
  async saveSettings() {
    await this.saveData(this.settings);
  }

  private configured(): string[] {
    const missing: string[] = [];
    if (!this.settings.poolAddress.trim()) missing.push("pool address");
    if (!this.settings.diaryFolder.trim()) missing.push("diary folder");
    if (!this.settings.username.trim()) missing.push("username");
    if (!this.settings.password) missing.push("password");
    return missing;
  }

  private async publishFlow() {
    console.log(`[DoaS v${VERSION}] publish flow started`);
    // Plugin-not-configured state (prd.md > States and Boundaries): say what's missing, try nothing.
    const missing = this.configured();
    if (missing.length > 0) {
      new Notice(`Publish needs its settings first: ${missing.join(", ")}. (Settings → Diary of a Stranger.)`);
      return;
    }

    const folderPath = normalizeFolderPath(this.settings.diaryFolder);
    // "" after normalization (they typed "/" or ".") means: search the whole vault.
    const target = folderPath ? this.app.vault.getAbstractFileByPath(folderPath) : this.app.vault.getRoot();
    if (!target || !(target instanceof TFolder)) {
      const tops = this.app.vault
        .getRoot()
        .children.filter((f) => f instanceof TFolder)
        .map((f) => f.name);
      new Notice(
        `There is no folder "${folderPath}" in this vault. Top-level folders: ${
          tops.length ? tops.join(", ") : "(none)"
        }. If the note is loose in the vault root, set the diary folder to "/".`
      );
      return;
    }
    const found: TFile[] = [];
    collectMarkdown(target, found);
    console.log(`[DoaS v${VERSION}] diary folder "${folderPath || "/"}" → ${found.length} markdown note(s) found`);
    const note = chooseNewest(found);
    if (!note) {
      new Notice(
        `"${folderPath || "the vault root"}" holds no markdown notes yet (subfolders included). Move today's note into it, or set the diary folder to "/" to search the whole vault.`
      );
      return;
    }

    const content = await this.app.vault.read(note);
    const { body } = stripFrontmatter(content);
    if (!body.trim()) {
      new Notice("That note is empty — nothing to publish yet.");
      return;
    }

    const native = chipsFromNote(content);

    // Modal.open() is required — constructing alone shows nothing (the real-world
    // silent-publish bug: the preview existed as an object but never as a window).
    console.log(`[DoaS v${VERSION}] opening publish preview…`);
    new PublishModal(this.app, {
      note,
      text: body.trim(),
      native,
      poolAddress: this.settings.poolAddress,
      // The checkboxes are the FINAL word: native tags pre-check themselves,
      // but unchecking one means it truly doesn't go out. No merge behind the
      // writer's back — the writer approves exactly what leaves.
      onPublish: (picked) => this.sendToPool(note, body.trim(), picked),
    }).open();
  }

  private async sendToPool(note: TFile, text: string, tags: Chip[], auto = false): Promise<boolean> {
    const pool = this.settings.poolAddress.trim().replace(/\/+$/, "");
    console.log(`[DoaS v${VERSION}] ${auto ? "AUTO " : ""}sending ${text.length} chars to ${pool}/api/publish (tags: ${tags.join(", ") || "none"})`);
    let resp: RequestUrlResponse;
    try {
      // requestUrl rides Obsidian's own network stack — no CORS preflight,
      // no renderer sandbox. `fetch` from app:// could be blocked silently.
      resp = await requestUrl({
        url: `${pool}/api/publish`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: this.settings.username,
          password: this.settings.password,
          text,
          tags,
          sourceNote: note.name,
        }),
        throw: false, // HTTP error statuses come back as responses, not exceptions
      });
      console.log(`[DoaS v${VERSION}] pool answered: status ${resp.status}`);
    } catch (e: any) {
      // The only throw here is the network itself. Technical detail lives in
      // the console; the writer gets calm words (production polish).
      console.log(`[DoaS v${VERSION}] request to pool REJECTED: ${e?.message ?? e}`);
      new Notice(`Is the diary pool running? The request didn't get through.`);
      return false;
    }

    let data: any = null;
    try {
      data = resp.json;
    } catch (e) {
      data = null;
    }

    if (resp.status === 200 && data?.ok) {
      new Notice(
        auto
          ? "Auto-published. Your page holds your newest entry."
          : `Published. Your newest entry is in the pool${data.createdAccount ? " — your account just came into being" : ""}, and 'your page' shows the hearts as they arrive.`
      );
      return true;
    }
    if (data?.error && (resp.status === 401 || resp.status === 422 || resp.status === 400)) {
      new Notice(data.error);
      return false;
    }
    console.log(`[DoaS v${VERSION}] pool answered ${resp.status} without an ok`);
    new Notice("The pool couldn't publish that this time. Try again in a moment.");
    return false;
  }
}

class DiarySettingTab extends PluginSettingTab {
  plugin: DiaryOfAStrangerPlugin;

  constructor(app: App, plugin: DiaryOfAStrangerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Pool address")
      .setDesc("Where the diary pool runs, e.g. http://localhost:3000")
      .addText((t) => t.setValue(this.plugin.settings.poolAddress).onChange(async (v) => {
        this.plugin.settings.poolAddress = v;
        await this.plugin.saveSettings();
      }));

    new Setting(containerEl)
      .setName("Diary folder")
      .setDesc('Vault folder that holds your diary notes, e.g. Diary ("/" to search the whole vault)')
      .addText((t) => t.setValue(this.plugin.settings.diaryFolder).onChange(async (v) => {
        this.plugin.settings.diaryFolder = v;
        await this.plugin.saveSettings();
      }));

    new Setting(containerEl)
      .setName("Username")
      .setDesc("The account the site knows — the same one you use to see your page. Never shown to anyone.")
      .addText((t) => t.setValue(this.plugin.settings.username).onChange(async (v) => {
        this.plugin.settings.username = v;
        await this.plugin.saveSettings();
      }));

    new Setting(containerEl)
      .setName("Password")
      .setDesc("Kept in this vault's plugin settings — it's your machine, your vault.")
      .addText((t) => {
        t.inputEl.type = "password";
        t.setValue(this.plugin.settings.password).onChange(async (v) => {
          this.plugin.settings.password = v;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Auto publish")
      .setDesc(
        "Publish your newest diary entry automatically — once when Obsidian starts, and ~3 minutes after you stop editing a note in the diary folder. Sends directly, without the preview. The pool keeps only one entry of yours (each publish replaces it), and the word guard still applies."
      )
      .addToggle((t) =>
        t.setValue(this.plugin.settings.autoPublish).onChange(async (v) => {
          this.plugin.settings.autoPublish = v;
          if (v) {
            // First auto send comes quickly (~10s) — toggle it on, watch it work.
            this.plugin.queueAutoPublishSoon(10000);
          } else {
            this.plugin.cancelAutoPublish();
          }
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Publish on save")
      .setDesc(
        "Needs auto publish. Skips the 3-minute breathing pause and sends ~5 seconds after the last save instead. Obsidian saves as you pause typing — there is no separate save action — so this is effectively 'on pause'."
      )
      .addToggle((t) =>
        t.setValue(this.plugin.settings.autoPublishQuick).onChange(async (v) => {
          this.plugin.settings.autoPublishQuick = v;
          await this.plugin.saveSettings();
          if (v && this.plugin.settings.autoPublish) this.plugin.queueAutoPublish();
        })
      );
  }
}
