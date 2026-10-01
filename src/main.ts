import {
  App,
  MarkdownView,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  addIcon,
  normalizePath,
  setIcon,
} from "obsidian";
import {
  DEFAULT_CONFIG,
  DEFAULT_SCOPE,
  EngineConfig,
  Granularity,
  ScopeRules,
  applyConfigTo,
  focusExtension,
  pathInScope,
  readFocusOverride,
} from "./engine";
import { DEFAULT_LANG, LANGUAGES, type Lang, dict } from "./strings";

/*
 * Phosphor "lamp" — MIT, (c) 2015-present Phosphor
 *
 * Two weights of the same glyph, so swapping between them changes the
 * read of the icon without any shift in size or position: outline when
 * the lamp is off, filled when it is on.
 */
/* Phosphor "lamp" (regular) */
const LAMP_OFF = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M247.35,148.85l-48-112A8,8,0,0,0,192,32H64a8,8,0,0,0-7.35,4.85l-48,112A8,8,0,0,0,16,160H120v48H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16H136V160h56v32a8,8,0,0,0,16,0V160h32a8,8,0,0,0,7.35-11.15ZM28.13,144,69.28,48H186.72l41.15,96Z"/></svg>`;

/* Phosphor "lamp-fill" */
const LAMP_ON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M246.68,156.4A8,8,0,0,1,240,160H208v32a8,8,0,0,1-16,0V160H136v48h24a8,8,0,0,1,0,16H96a8,8,0,0,1,0-16h24V160H16a8,8,0,0,1-7.35-11.15l48-112A8,8,0,0,1,64,32H192a8,8,0,0,1,7.35,4.85l48,112A8,8,0,0,1,246.68,156.4Z"/></svg>`;

interface JingyidianSettings extends EngineConfig, ScopeRules {
  showStatusBar: boolean;
  statusText: string;
  /** UI language, remembered in the vault. */
  lang: Lang;
  /** Limit dimming to the window that has OS focus. */
  onlyFocusedWindow: boolean;
  /** Set once the one-time settings hand-off has happened. */
  migratedFromStille?: boolean;
}

const DEFAULTS: JingyidianSettings = {
  ...DEFAULT_CONFIG,
  ...DEFAULT_SCOPE,
  showStatusBar: true,
  statusText: dict(DEFAULT_LANG).pluginName,
  lang: DEFAULT_LANG,
  onlyFocusedWindow: false,
};

/** Status-bar labels from before the UI moved to English. */
const LEGACY_STATUS_LABELS = new Set(["静一点", "小台灯"]);

const GRANULARITY_CYCLE: Granularity[] = [
  "line",
  "sentence",
  "paragraph",
  "section",
];

export default class JingyidianPlugin extends Plugin {
  settings: JingyidianSettings = { ...DEFAULTS };
  private statusBarEl: HTMLElement | null = null;
  private ribbonEl: HTMLElement | null = null;
  private syncTimer: number | null = null;
  private retryCount = 0;

  async onload() {
    await this.loadSettings();
    await this.migrateFromStille();

    addIcon("dl-lamp-off", LAMP_OFF);
    addIcon("dl-lamp-on", LAMP_ON);
    this.ribbonEl = this.addRibbonIcon("dl-lamp-off", this.t.cmdToggle, () =>
      this.toggle(),
    );
    this.paintRibbon();

    this.registerEditorExtension(focusExtension());

    this.addCommand({
      id: "toggle",
      name: this.t.cmdToggle,
      callback: () => this.toggle(),
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "S" }],
    });
    this.addCommand({
      id: "granularity-cycle",
      name: this.t.cmdCycle,
      callback: () => this.cycleGranularity(),
      // Alt is unused elsewhere in the plugin, and Obsidian reserves
      // few Mod+Alt chords by default, so this is unlikely to clash.
      hotkeys: [{ modifiers: ["Mod", "Alt"], key: "G" }],
    });
    this.addCommand({
      id: "focused-window-only",
      name: this.t.cmdFocusedWindow,
      callback: () => {
        void this.patch({
          onlyFocusedWindow: !this.settings.onlyFocusedWindow,
        });
      },
      hotkeys: [{ modifiers: ["Mod", "Alt"], key: "W" }],
    });

    this.addCommand({
      id: "diagnose",
      name: this.t.cmdDiagnose,
      callback: () => this.diagnose(),
    });
    this.addSettingTab(new JingyidianSettingTab(this.app, this));

    /*
     * Re-apply the config to every open editor whenever the *set of
     * editors, or the file under one of them* changes — not when the
     * text changes. The config depends on the file path (scope rules,
     * frontmatter), so anything that swaps that path needs a sync.
     *
     * editor-change is the one exception, and only because it is when
     * Obsidian refreshes the metadata cache that frontmatterFlag reads.
     * It fires per keystroke, so it is debounced rather than direct.
     */
    this.registerEvent(
      this.app.workspace.on("file-open", () => this.syncAllEditors()),
    );
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => this.syncAllEditors()),
    );
    this.registerEvent(
      this.app.workspace.on("layout-change", () => this.syncAllEditors()),
    );
    this.registerEvent(
      this.app.workspace.on("editor-change", () => this.scheduleSync()),
    );

    // Re-apply config to every open editor now and on any leaf change.
    this.app.workspace.onLayoutReady(() => this.syncAllEditors());

    window.addEventListener("focus", this.onWindowFocus);
    window.addEventListener("blur", this.onWindowBlur);
    this.register(() => {
      window.removeEventListener("focus", this.onWindowFocus);
      window.removeEventListener("blur", this.onWindowBlur);
    });

    this.renderStatusBar();
    this.syncAllEditors();
  }

  onunload() {
    this.clearStatusBar();
    if (this.syncTimer !== null) {
      window.clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    // Strip anything we put on <body> so nothing leaks after disabling.
    document.body.classList.remove("dl-title-dim", "dl-active");
  }

  private onWindowFocus = () => this.syncAllEditors();
  private onWindowBlur = () => this.syncAllEditors();

  /** Strings for the selected UI language. */
  get t() {
    return dict(this.settings.lang);
  }

  /** The granularity's display name, in the selected language. */
  private gLabel(g: Granularity): string {
    const t = this.t;
    return {
      line: t.gLine,
      sentence: t.gSentence,
      paragraph: t.gParagraph,
      section: t.gSection,
    }[g];
  }

  /* ----------------------------- settings ----------------------------- */

  private async loadSettings() {
    this.settings = Object.assign({}, DEFAULTS, await this.loadData());
    this.settings.dimOpacity = clamp01(this.settings.dimOpacity);
    this.settings.transitionMs = Math.max(0, this.settings.transitionMs || 0);
    // The status-bar label is user-editable, so only move it off the old
    // Chinese default. Anything the user typed is left alone.
    if (LEGACY_STATUS_LABELS.has(this.settings.statusText)) {
      this.settings.statusText = this.t.pluginName;
    }
  }

  async save() {
    await this.saveData(this.settings);
    this.syncAllEditors();
    this.renderStatusBar();
    this.paintRibbon();
  }

  private async patch(p: Partial<JingyidianSettings>) {
    Object.assign(this.settings, p);
    await this.save();
  }

  /**
   * Adopt the opacity from a sibling focus plugin's data.json, once, so
   * switching over is not a jump from our default.
   *
   * The explicit flag is required: comparing dimOpacity against the
   * default cannot distinguish "never touched" from "deliberately set to
   * the same value", and the second case would silently reset the user's
   * settings on every launch.
   */
  private async migrateFromStille() {
    if (this.settings.migratedFromStille) return;
    // Mark it done regardless of whether anything was found, so we do not
    // probe the disk on every start.
    this.settings.migratedFromStille = true;

    const legacy = await this.readStilleSettings();
    if (!legacy) {
      await this.save();
      return;
    }
    if (typeof legacy.unfocusedLevel === "number") {
      this.settings.dimOpacity = clamp01(legacy.unfocusedLevel);
    }
    if (typeof legacy.unfocusTitle === "boolean") {
      this.settings.dimTitle = legacy.unfocusTitle;
    }
    this.settings.granularity = "line"; // the safest default to land on
    await this.save();
    new Notice(this.t.noticeMigrated);
  }

  private async readStilleSettings(): Promise<{
    unfocusedLevel?: number;
    unfocusTitle?: boolean;
  } | null> {
    try {
      const path = `${this.app.vault.configDir}/plugins/obsidian-stille/data.json`;
      const raw = await this.app.vault.adapter.read(path);
      return JSON.parse(raw) as {
        unfocusedLevel?: number;
        unfocusTitle?: boolean;
      };
    } catch {
      return null; // nothing to inherit from
    }
  }

  /* ------------------------------ engine ------------------------------ */

  /**
   * Config for one editor. `filePath` is "" for a leaf with no file yet
   * (a fresh empty note), which has no scope rules to check.
   */
  private configFor(filePath: string): EngineConfig {
    const fmValue =
      filePath === "" ? undefined : this.frontmatterFlag(filePath);
    const override = readFocusOverride(fmValue);
    const inScope =
      filePath === ""
        ? true
        : pathInScope(
            filePath,
            {
              onlyPaths: this.settings.onlyPaths,
              exceptPaths: this.settings.exceptPaths,
              frontmatterKey: this.settings.frontmatterKey,
            },
            fmValue,
          );

    // Multi-window focus detection is not something Obsidian exposes
    // reliably (activeLeaf is shared across windows and document.
    // hasFocus() is wrong for popouts), so this is opt-in and off by
    // default rather than guessed at.
    const windowOk =
      !this.settings.onlyFocusedWindow || this.isThisWindowActive();

    // A granularity in the frontmatter wins over the global setting, so
    // one note can be pinned without changing every other note.
    const granularity =
      override !== null && override !== false
        ? override
        : this.settings.granularity;

    return {
      enabled: this.settings.enabled && inScope && windowOk,
      granularity,
      dimOpacity: clamp01(this.settings.dimOpacity),
      sectionLevel: Math.min(6, Math.max(1, this.settings.sectionLevel)),
      keepHeading: this.settings.keepHeading,
      exemptRich: this.settings.exemptRich,
      transitionMs: Math.max(0, this.settings.transitionMs),
      dimTitle: this.settings.dimTitle,
    };
  }

  /**
   * Best-effort: is this window the focused one? Obsidian does not expose
   * this, so we infer it from whether the active leaf's DOM lives in the
   * document that currently has focus. Returns true when we cannot tell —
   * dimming everything is a worse failure than dimming nothing visible.
   */
  private isThisWindowActive(): boolean {
    try {
      const el = this.app.workspace.activeLeaf?.view?.containerEl;
      if (!el) return true;
      const doc = el.ownerDocument;
      if (doc.hasFocus()) return true;
      // Another window holds focus: only treat ourselves as inactive
      // when Obsidian really did report a second window.
      // @ts-expect-error - windows is not in the public typings
      const count = this.app.workspace.windows?.length ?? 1;
      return count <= 1 ? true : false;
    } catch {
      return true;
    }
  }

  /**
   * Why the engine is currently dark, or not. Shown in the status bar.
   *
   * Scope violations are per-note, so they are deliberately not reported
   * here: the note you are looking at may be out of scope while others are
   * not, and a global "blocked" message would be wrong most of the time.
   */
  private blockedReason(): string | null {
    if (!this.settings.enabled) return this.t.notOn;
    return null;
  }

  private frontmatterFlag(filePath: string): unknown {
    if (!this.settings.frontmatterKey) return undefined;
    const file = this.app.vault.getAbstractFileByPath(normalizePath(filePath));
    if (!file || !("frontmatter" in file)) return undefined;
    const fm = (file as { frontmatter?: Record<string, unknown> }).frontmatter;
    if (!fm) return undefined;
    return fm[this.settings.frontmatterKey];
  }

  private editorViews(): Array<{ view: MarkdownView; cm: unknown }> {
    const out: Array<{ view: MarkdownView; cm: unknown }> = [];
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView)) continue;
      const cm = (view.editor as unknown as { cm?: unknown })?.cm;
      if (cm) out.push({ view, cm });
    }
    return out;
  }

  /**
   * A newly opened note's CodeMirror instance may not exist yet at the
   * moment the event fires, so a first pass can silently find nothing.
   * Retry briefly to cover that window; without it the note stays lit
   * until the next edit.
   */
  private syncAllEditors() {
    let pending = 0;
    for (const { view, cm } of this.editorViews()) {
      try {
        applyConfigTo(
          cm as Parameters<typeof applyConfigTo>[0],
          this.configFor(view.file?.path ?? ""),
        );
      } catch {
        pending++;
      }
    }
    this.paintBodyClasses();

    if (pending > 0 && this.retryCount < 4) {
      this.retryCount++;
      window.setTimeout(() => this.syncAllEditors(), 60);
      return;
    }
    this.retryCount = 0;
  }

  /**
   * Coalesce the per-keystroke editor-change into one sync. Typing cannot
   * change the config, but Obsidian refreshes the metadata cache as you
   * type, so a debounced follow-up keeps frontmatter overrides honest
   * without paying for a full pass on every character.
   */
  private scheduleSync() {
    if (this.syncTimer !== null) return;
    this.syncTimer = window.setTimeout(() => {
      this.syncTimer = null;
      this.syncAllEditors();
    }, 300);
  }

  private paintBodyClasses() {
    document.body.classList.toggle(
      "dl-title-dim",
      this.settings.enabled && this.settings.dimTitle,
    );
    document.body.classList.toggle("dl-active", this.settings.enabled);
  }

  /* ---------------------------- commands ----------------------------- */

  async toggle() {
    await this.patch({ enabled: !this.settings.enabled });
  }

  private async cycleGranularity() {
    const i = GRANULARITY_CYCLE.indexOf(this.settings.granularity);
    const next = GRANULARITY_CYCLE[(i + 1) % GRANULARITY_CYCLE.length];
    await this.patch({ granularity: next });
  }

  /**
   * Report the whole chain that decides whether a line gets dimmed. When
   * the plugin "does nothing" the cause is always in one of these steps,
   * and without this the user has no way to tell which.
   */
  private diagnose() {
    const lines: string[] = [];
    const leaf = this.app.workspace.getActiveViewOfType(MarkdownView);
    const file = leaf?.file?.path ?? "(no note open)";

    lines.push(`plugin loaded: v${this.manifest.version}`);
    lines.push(`master switch enabled: ${this.settings.enabled}`);
    lines.push(`global granularity: ${this.gLabel(this.settings.granularity)}`);
    lines.push(`opacity: ${this.settings.dimOpacity}`);
    lines.push(`current note: ${file}`);

    if (leaf?.file) {
      const fm = this.frontmatterFlag(leaf.file.path);
      lines.push(
        `frontmatter "${this.settings.frontmatterKey}"：${
          fm === undefined ? "(none)" : JSON.stringify(fm)
        }`,
      );
      const inScope = pathInScope(
        leaf.file.path,
        {
          onlyPaths: this.settings.onlyPaths,
          exceptPaths: this.settings.exceptPaths,
          frontmatterKey: this.settings.frontmatterKey,
        },
        fm,
      );
      lines.push(`in scope: ${inScope}`);
    } else {
      lines.push("no markdown note open");
    }

    lines.push(`only-dim focused window: ${this.settings.onlyFocusedWindow}`);
    lines.push(`window considered active: ${this.isThisWindowActive()}`);

    const editors = this.editorViews();
    lines.push(`editors attached: ${editors.length}`);

    // Does the DOM actually carry our class?
    let dimmed = 0;
    for (const { cm } of editors) {
      try {
        const dom = (cm as { dom?: HTMLElement }).dom;
        dimmed += dom?.querySelectorAll(".dl-dim").length ?? 0;
      } catch {
        /* ignore */
      }
    }
    lines.push(`lines currently carrying .dl-dim: ${dimmed}`);

    const reason = this.blockedReason();
    lines.push(
      reason
        ? `VERDICT: not dimming, because: ${reason}`
        : "VERDICT: engine config looks correct",
    );

    const text = lines.join("\n");
    new Notice(text.split("\n").slice(-1)[0], 8000);
    // eslint-disable-next-line no-console
    console.log(this.t.logPrefix + " diagnostic report\n" + text);
  }

  /* --------------------------- status bar ---------------------------- */

  /**
   * The ribbon icon doubles as the on/off indicator: an outline lamp when
   * off, a filled one when on. Same glyph, same viewBox, so it swaps
   * without shifting. setIcon is Obsidian's own helper for this.
   */
  private paintRibbon() {
    if (!this.ribbonEl) return;
    const on = this.settings.enabled;
    setIcon(this.ribbonEl, on ? "dl-lamp-on" : "dl-lamp-off");
    this.ribbonEl.toggleClass("dl-lamp-lit", on);
    this.ribbonEl.setAttribute(
      "aria-label",
      on ? this.t.ribbonOn : this.t.ribbonOff,
    );
  }

  /**
   * The granularity actually in force for a note: its frontmatter pin if
   * it has one, otherwise the global setting. Split out from configFor so
   * the status bar does not repeat the vault lookup and scope matching on
   * every render.
   */
  private effectiveGranularity(filePath: string): Granularity {
    if (filePath === "") return this.settings.granularity;
    const override = readFocusOverride(this.frontmatterFlag(filePath));
    return override !== null && override !== false
      ? override
      : this.settings.granularity;
  }

  private renderStatusBar() {
    if (!this.settings.showStatusBar) {
      this.clearStatusBar();
      return;
    }
    // clearStatusBar() nulls the reference, so toggling this off and on
    // re-creates exactly one item rather than stacking them.
    if (!this.statusBarEl) {
      this.statusBarEl = this.addStatusBarItem();
    }
    const reason = this.blockedReason();
    const lit = reason === null;
    // Show the granularity actually in force for the current note, which
    // may have been pinned by that note's frontmatter.
    const leaf = this.app.workspace.getActiveViewOfType(MarkdownView);
    const effective = this.effectiveGranularity(leaf?.file?.path ?? "");
    // The status bar is the diagnosis: it says whether the engine is
    // actually darking lines, and if not, why.
    this.statusBarEl.setText(
      `${this.settings.statusText} ${
        lit ? this.t.on : this.t.off
      } · ${this.gLabel(effective)}${
        effective !== this.settings.granularity ? ` ${this.t.perNote}` : ""
      }${reason ? ` · ${reason}` : ""}`,
    );
    this.statusBarEl.toggleClass("is-active", lit);
  }

  private clearStatusBar() {
    if (this.statusBarEl) {
      this.statusBarEl.remove();
      this.statusBarEl = null;
    }
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return DEFAULTS.dimOpacity;
  return Math.min(1, Math.max(0, n));
}

/* ----------------------------- settings tab ----------------------------- */

class JingyidianSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: JingyidianPlugin,
  ) {
    super(app, plugin);
  }

  private async set(p: Partial<JingyidianSettings>) {
    Object.assign(this.plugin.settings, p);
    await this.plugin.save();
    this.display();
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h3", { text: this.plugin.t.pluginName });
    containerEl.createEl("p", {
      text: this.plugin.t.tagline,
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName(this.plugin.t.languageName)
      .setDesc(this.plugin.t.languageDesc)
      .addDropdown((d) => {
        for (const l of LANGUAGES) d.addOption(l.id, `${l.flag}  ${l.label}`);
        d.setValue(this.plugin.settings.lang).onChange(async (v) => {
          await this.set({ lang: v as Lang });
        });
      });

    new Setting(containerEl)
      .setName(this.plugin.t.toggleName)
      .setDesc(this.plugin.t.toggleDesc)
      .addToggle((t) =>
        t.setValue(this.plugin.settings.enabled).onChange(async (v) => {
          await this.set({ enabled: v });
        }),
      );

    new Setting(containerEl)
      .setName(this.plugin.t.granularityName)
      .setDesc(this.plugin.t.granularityDesc)
      .addDropdown((d) =>
        d
          .addOption("line", this.plugin.t.gLine)
          .addOption("sentence", this.plugin.t.gSentence)
          .addOption("paragraph", this.plugin.t.gParagraph)
          .addOption("section", this.plugin.t.gSection)
          .setValue(this.plugin.settings.granularity)
          .onChange(async (v) => {
            await this.set({ granularity: v as Granularity });
          }),
      );

    new Setting(containerEl)
      .setName(this.plugin.t.opacityName)
      .setDesc(this.plugin.t.opacityDesc)
      .addSlider((s) =>
        s
          .setLimits(0, 1, 0.05)
          .setValue(this.plugin.settings.dimOpacity)
          .setDynamicTooltip()
          .onChange(async (v) => {
            await this.set({ dimOpacity: v });
          }),
      );

    if (this.plugin.settings.granularity === "section") {
      new Setting(containerEl)
        .setName(this.plugin.t.sectionLevelName)
        .setDesc(this.plugin.t.sectionLevelDesc)
        .addSlider((s) =>
          s
            .setLimits(1, 6, 1)
            .setValue(this.plugin.settings.sectionLevel)
            .setDynamicTooltip()
            .onChange(async (v) => {
              await this.set({ sectionLevel: v });
            }),
        );
    }

    if (this.plugin.settings.granularity === "section") {
      new Setting(containerEl)
        .setName(this.plugin.t.keepHeadingName)
        .setDesc(this.plugin.t.keepHeadingDesc)
        .addToggle((t) =>
          t.setValue(this.plugin.settings.keepHeading).onChange(async (v) => {
            await this.set({ keepHeading: v });
          }),
        );
    }

    new Setting(containerEl)
      .setName(this.plugin.t.exemptRichName)
      .setDesc(this.plugin.t.exemptRichDesc)
      .addToggle((t) =>
        t.setValue(this.plugin.settings.exemptRich).onChange(async (v) => {
          await this.set({ exemptRich: v });
        }),
      );

    new Setting(containerEl)
      .setName(this.plugin.t.transitionName)
      .setDesc(this.plugin.t.transitionDesc)
      .addSlider((s) =>
        s
          .setLimits(0, 500, 10)
          .setValue(this.plugin.settings.transitionMs)
          .setDynamicTooltip()
          .onChange(async (v) => {
            await this.set({ transitionMs: v });
          }),
      );

    new Setting(containerEl)
      .setName(this.plugin.t.dimTitleName)
      .setDesc(this.plugin.t.dimTitleDesc)
      .addToggle((t) =>
        t.setValue(this.plugin.settings.dimTitle).onChange(async (v) => {
          await this.set({ dimTitle: v });
        }),
      );

    new Setting(containerEl)
      .setName(this.plugin.t.focusedWindowName)
      .setDesc(this.plugin.t.focusedWindowDesc)
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.onlyFocusedWindow)
          .onChange(async (v) => {
            await this.set({ onlyFocusedWindow: v });
          }),
      );

    containerEl.createEl("h4", { text: this.plugin.t.sectionScope });

    new Setting(containerEl)
      .setName(this.plugin.t.onlyPathsName)
      .setDesc(this.plugin.t.onlyPathsDesc)
      .addTextArea((t) =>
        t
          .setValue(this.plugin.settings.onlyPaths.join("\n"))
          .onChange(async (v) => {
            await this.set({ onlyPaths: splitLines(v) });
          }),
      );

    new Setting(containerEl)
      .setName(this.plugin.t.exceptPathsName)
      .setDesc(this.plugin.t.exceptPathsDesc)
      .addTextArea((t) =>
        t
          .setValue(this.plugin.settings.exceptPaths.join("\n"))
          .onChange(async (v) => {
            await this.set({ exceptPaths: splitLines(v) });
          }),
      );

    new Setting(containerEl)
      .setName(this.plugin.t.frontmatterKeyName)
      .setDesc(this.plugin.t.frontmatterKeyDesc)
      .addText((t) =>
        t
          .setPlaceholder("focus")
          .setValue(this.plugin.settings.frontmatterKey)
          .onChange(async (v) => {
            await this.set({ frontmatterKey: v.trim() });
          }),
      );

    containerEl.createEl("h4", { text: this.plugin.t.sectionStatusBar });

    new Setting(containerEl)
      .setName(this.plugin.t.showStatusBar)
      .addToggle((t) =>
        t.setValue(this.plugin.settings.showStatusBar).onChange(async (v) => {
          await this.set({ showStatusBar: v });
        }),
      );

    new Setting(containerEl)
      .setName(this.plugin.t.statusTextName)
      .addText((t) =>
        t.setValue(this.plugin.settings.statusText).onChange(async (v) => {
          await this.set({ statusText: v });
        }),
      );
  }
}

function splitLines(v: string): string[] {
  return v
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
