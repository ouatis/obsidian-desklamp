# Desk Lamp

**Room lights off, one lamp left on.**

An Obsidian plugin that dims everything except the line, sentence, paragraph,
or section you are working on.

> 中文：把注意力收回到你正在写的那一段。详细说明见[文末](#中文说明)。

## Why not just Stille?

Stille inserts a `<style>` element, puts a class on `<body>`, and dims every
line that is not `.cm-active`. That works, but the approach caps what the
plugin can ever do:

1. **Line granularity only.** `.cm-active` is CodeMirror's marker for the
   caret's line; there is no way to express "paragraph" or "section" with it.
2. **The CSS variable is written on `<body>`**, so it leaks into every other
   plugin and theme in the vault.
3. **The class is global**, so split panes, multiple windows and reading view
   are all out of reach — and disabling the plugin can leave it behind.

Desk Lamp uses a CodeMirror 6 `ViewPlugin` with line decorations instead: the
lit set is computed from `EditorState`, and only the *visible* lines outside it
get a decoration class. No global body class, no injected `<style>`, no DOM
walking.

| | Stille 1.3.4 | Desk Lamp |
|---|---|---|
| Granularity | line | line / sentence / paragraph / section |
| Scope control | none | folders, path exclusion, per-note frontmatter |
| Reading view | broken | not supported (by choice, see below) |
| Multi-caret | no | each caret lights its own range |
| Multi-window | everything dims | optionally only the focused window |
| Embeds / math / tables | dimmed by mistake | exempt by default |
| Opacity input | free text, accepts `NaN` | slider |
| State on restart | always reset | remembered |
| Engine | CSS + `.cm-active` | CM6 decorations |

## Features

- **Four granularities** — line (as Stille does it), sentence, paragraph (the
  whole soft-wrapped paragraph), section (up to the next heading of the same
  level)
- **Per-note overrides** — frontmatter `focus: false` switches a note off;
  `focus: section` pins its granularity without touching anything else.
  Chinese granularity names work too: `行` / `句` / `段落` / `小节`
- **Scope rules** — limit to certain folders, exclude others
- **Never dims** lines holding an embed, a formula or a table
- **Multi-caret** — every caret computes its own lit range
- **Opacity slider** 0–1, and a 0–500 ms transition that respects
  `prefers-reduced-motion`
- **Ribbon icon** shows the state: outline when off, filled when on
- Migrates the opacity you had in Stille, so switching over is not a jump

### Where it stops

CodeMirror's line decorations are **line-granular**, so sentence granularity
lights the lines a sentence occupies — a line holding three sentences lights
all three. Splitting inside a line needs mark decorations, which reads oddly
for a focus tool (half a sentence bright, half dim).

Sentence splitting handles CJK and Western punctuation and avoids the usual
traps: the dot in `3.14`, abbreviations like `Mr.` and `e.g.`, single initials
like `J. R.`, and treating `...` as one boundary rather than three.

**Reading view is deliberately not supported.** There is no caret there, so the
focus has to be guessed from where you last were, and dimming most of a
document while you are reading it makes the document harder to read. The
feature was built, tried, and removed.

## Commands

| Command | Default |
|---|---|
| Turn the lamp on / off | `Ctrl/Cmd + Shift + S` |
| Cycle granularity | `Ctrl/Cmd + Alt + G` |
| Only dim the focused window | `Ctrl/Cmd + Alt + W` |
| Diagnose | command palette |

Every hotkey is rebindable in Obsidian's keyboard settings. The on/off state is
remembered across restarts.

If the lamp seems to do nothing, run **Diagnose: why is nothing dimmed** — it
reports the whole chain (switch, granularity, note, scope, editors attached,
lines actually carrying the decoration class) to the console.

## Install

Requires Obsidian 1.5.0 or newer.

Download `main.js`, `manifest.json` and `styles.css` from the
[latest release](https://github.com/ouatis/obsidian-desklamp/releases) and put
them in `<vault>/.obsidian/plugins/desklamp/`, then enable it under
**Settings → Community plugins**.

With [BRAT](https://github.com/thesephist/brats): add `ouatis/obsidian-desklamp`
as a plugin source.

## Development

```bash
npm install
npm run dev         # watch build
npm run typecheck
npm test            # 48 engine tests
npm run build       # production build
npm run test:bundle # 14 smoke tests against the built artifact
npm run verify      # all of the above, then install into the vault
```

The engine tests import the real functions from `src/engine.ts` and run them
against real CodeMirror state and the real markdown parser, so they cannot
drift from the source. `test/perf.mjs` measures the per-keystroke cost.

## Credits

MIT licensed. Inspired by [Stille](https://github.com/michaellee/stille) by
Michael Lee (MIT, no source reused). The ribbon icon is "Lamp" and "Lamp-fill"
from [Phosphor Icons](https://github.com/phosphor-icons/core) (MIT). See
[LICENSE](LICENSE).

---

## 中文说明

**小台灯**：房间大灯关掉，只留一盏。

- **四档粒度**：行（同 Stille）、句、段落、小节
- **单篇覆盖**：frontmatter 写 `focus: false` 关闭这一篇；写 `focus: section`
  或 `focus: 小节` 为这一篇单独指定粒度，不影响其他笔记
- **范围规则**：按文件夹限定、排除指定路径
- **不暗**：含嵌入块、公式、表格的行始终清晰
- **快捷键**：`Ctrl/Cmd + Shift + S` 开 / 关，`Ctrl/Cmd + Alt + G` 切换粒度

界面是英文的，这是 Obsidian 插件的惯例。想要某个功能没有，可以自己加——
插件很小，没有构建负担。