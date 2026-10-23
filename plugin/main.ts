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
} from "obsidian";

// The pool's whole filter language (learner-confirmed set). Kept in step with
// webapp/routes/publish.js — normalizeTags there is the authority; this copy
// only pre-lights the checkboxes the writer sees in the preview.
const CHIPS = ["melancholy", "hopeful", "tired", "late night", "family", "work", "small joys"] as const;

type Chip = (typeof CHIPS)[number];

interface DiaryOfAStrangerSettings {
  poolAddress: string;
  diaryFolder: string;
  username: string;
  password: string;
}

const DEFAULT_SETTINGS: DiaryOfAStrangerSettings = {
  poolAddress: "http://localhost:3000",
  diaryFolder: "Diary",
  username: "",
  password: "",
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
    const clean = t.trim().replace(/^#/, "").toLowerCase();
    if ((CHIPS as readonly string[]).includes(clean)) hit.add(clean as Chip);
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
      this.native.length > 0 ? ` (found in your note: ${this.native.map((t) => "#" + t).join(", ")})` : "";
    contentEl.createEl("div", { cls: "das-source", text: `moods for the pool ${nativeLine}` });

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
      this.close();
      this.onPublish(picked);
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

// ---------- the plugin ----------

export default class DiaryOfAStrangerPlugin extends Plugin {
  settings: DiaryOfAStrangerSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();

    this.addCommand({
      id: "publish-latest",
      name: "Publish to Diary of a Stranger",
      callback: () => this.publishFlow(),
    });

    this.addSettingTab(new DiarySettingTab(this.app, this));
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

    new PublishModal(this.app, {
      note,
      text: body.trim(),
      native,
      poolAddress: this.settings.poolAddress,
      onPublish: (picked) => this.sendToPool(note, body.trim(), Array.from(new Set([...native, ...picked]))),
    });
  }

  private async sendToPool(note: TFile, text: string, tags: Chip[]) {
    const pool = this.settings.poolAddress.trim().replace(/\/+$/, "");
    let resp: Response;
    try {
      resp = await fetch(`${pool}/api/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: this.settings.username,
          password: this.settings.password,
          text,
          tags,
          sourceNote: note.name,
        }),
      });
    } catch (e) {
      new Notice(`Is the diary pool running? Couldn't reach ${pool}.`);
      return;
    }

    let data: any = null;
    try {
      data = await resp.json();
    } catch (e) {
      // fall through to generic handling below
    }

    if (resp.ok && data?.ok) {
      new Notice(`Published — ${data.createdAccount ? "your account just came into being. " : ""}Peek at ${pool}${data.payoffPath ?? "/mine"} to see hearts land.`);
      return;
    }
    if (resp.status === 401 && data?.error) {
      new Notice(data.error);
      return;
    }
    if (resp.status === 422 && data?.error) {
      new Notice(data.error);
      return;
    }
    new Notice(`The pool couldn't publish that (status ${resp.status}).`);
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
  }
}
