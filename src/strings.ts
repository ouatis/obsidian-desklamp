/*
 * UI strings.
 *
 * English is the primary language: it is what the plugin was written in,
 * what the README leads with, and what the overwhelming majority of
 * Obsidian plugins ship. Chinese granularity names are still accepted in
 * frontmatter (see readFocusOverride in engine.ts), so a Chinese note can
 * say `focus: 小节` and get the same result.
 */

export const STRINGS = {
  pluginName: "Desk Lamp",

  // Commands
  cmdToggle: "Turn the lamp on / off",
  cmdCycleGranularity:
    "Cycle granularity: line → sentence → paragraph → section",
  cmdFocusedWindow: "Toggle “only dim the focused window”",
  cmdDiagnose: "Diagnose: why is nothing dimmed",

  // Settings — sections
  settingTitle: "Desk Lamp",
  settingTagline: "Room lights off, one lamp left on.",
  sectionScope: "Scope",
  sectionStatusBar: "Status bar",

  // Settings — controls
  toggleName: "Lamp",
  toggleDesc: "Master switch. Off stops the engine entirely.",

  granularityName: "Granularity",
  granularityDesc:
    "Line behaves like Stille. Sentence lights the lines holding the current sentence. Paragraph is the whole soft-wrapped paragraph. Section runs to the next heading of the same level.",

  opacityName: "Opacity of unfocused text",
  opacityDesc: "0 = black, 1 = no dimming.",

  sectionLevelName: "Heading level that starts a section",
  sectionLevelDesc: "A heading at or above this level opens a new section.",

  keepHeadingName: "Keep the current heading lit",
  keepHeadingDesc: "The heading that governs the caret stays undimmed.",

  exemptRichName: "Never dim: embeds, math, tables",
  exemptRichDesc: "Lines containing an embed, formula or table stay legible.",

  transitionName: "Transition (ms)",
  transitionDesc: "0 disables the fade.",

  dimTitleName: "Dim the note title",
  dimTitleDesc: "Dims the note title and the tab title as well.",

  focusedWindowName: "Only dim the focused window",
  focusedWindowDesc:
    "Off by default. Obsidian has no reliable per-window focus API, and a wrong guess makes the plugin look broken.",

  onlyPathsName: "Only these paths",
  onlyPathsDesc:
    "One folder or file per line; empty means everything. Example: 03-OUATIS",

  exceptPathsName: "Never dim these paths",
  exceptPathsDesc: "Takes priority over the list above.",

  frontmatterKeyName: "Frontmatter key",
  frontmatterKeyDesc:
    "Per-note override. Set focus: false to switch focus off for that note, or focus: section to pin its granularity. 行 / 句 / 段落 / 小节 also work.",

  showStatusBarName: "Show the status bar item",
  statusTextName: "Status bar text",

  // Granularity labels
  gLine: "line",
  gSentence: "sentence",
  gParagraph: "paragraph",
  gSection: "section",

  // Diagnostics
  statusOff: "off",
  statusPerNote: "(this note)",
  statusNotEnabled: "not on",
  statusWindowBlurred: "window not focused",

  noticeMigrated:
    "Desk Lamp: kept the opacity you had in Stille. Change it in settings.",
  logPrefix: "[Desk Lamp]",
  ribbonOn: "Desk Lamp: on — click to switch off",
  ribbonOff: "Desk Lamp: off — click to switch on",
} as const;

export type Strings = typeof STRINGS;
