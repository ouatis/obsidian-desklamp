<div align="center">

# Desk Lamp

_Room lights off, one lamp left on._

[Chinese](./README.zh-CN.md) | [Japanese](./README.ja.md)

<a href="https://community.obsidian.md/plugins/desklamp"><img src="img/open-in-obsidian-button.svg" alt="Open Desk Lamp in Obsidian" width="150"></a>

<p>
  <img src="https://img.shields.io/github/v/release/ouatis/obsidian-desklamp?style=flat-square&label=version&color=ad3e32" alt="Latest release">
  <img src="https://img.shields.io/github/downloads/ouatis/obsidian-desklamp/total?style=flat-square&logo=obsidian&logoColor=white&label=downloads&color=d0a85c" alt="Downloads">
  <img src="https://img.shields.io/github/license/ouatis/obsidian-desklamp?style=flat-square&label=license&color=2f6754" alt="MIT License">
</p>

</div>

An Obsidian plugin that dims everything except the line, sentence, paragraph,
or section you are working on.

The rest of the note falls back at an opacity you set. Granularity can be
pinned per note through frontmatter, scoped to folders, and lines holding an
embed, a formula, or a table always stay lit. The on/off state is remembered
across restarts, and the ribbon icon shows it.

> [!NOTE]
> Reading view is deliberately not supported. There is no caret there, so the
> focus has to be guessed from where you last were, and dimming most of a
> document while you are reading it makes the document harder to read. The
> feature was built, tried, and removed.

## Install

Requires Obsidian 1.5.0 or newer.

**From Obsidian:** enable community plugins, then open
**Settings → Community plugins → Browse** and search for **Desk Lamp**. The
listing lives at
[community.obsidian.md/plugins/desklamp](https://community.obsidian.md/plugins/desklamp).

Manual, if you prefer: download `main.js`, `manifest.json` and `styles.css`
from the
[latest release](https://github.com/ouatis/obsidian-desklamp/releases) and put
them in `<vault>/.obsidian/plugins/desklamp/`, then enable it under
**Settings → Community plugins**.

With [BRAT](https://github.com/thesephist/brats): add `ouatis/obsidian-desklamp`
as a plugin source (only useful for trying unreleased versions).

## Features

- **Four granularities** — line, sentence, paragraph (the whole
  soft-wrapped paragraph), section (up to the next heading of the same level)
- **Per-note overrides** — frontmatter `focus: false` switches a note off;
  `focus: section` pins its granularity without touching anything else.
  Chinese granularity names work too: `行` / `句` / `段落` / `小节`
- **Scope rules** — limit to certain folders, exclude others
- **Never dims** lines holding an embed, a formula or a table
- **Multi-caret** — every caret computes its own lit range
- **Opacity slider** 0–1, and a 0–500 ms transition that respects
  `prefers-reduced-motion`
- **Ribbon icon** shows the state: outline when off, filled when on
- Adopts the opacity from a previously installed focus plugin, so switching over is not a jump

### Where it stops

CodeMirror's line decorations are **line-granular**, so sentence granularity
lights the lines a sentence occupies — a line holding three sentences lights
all three. Splitting inside a line needs mark decorations, which reads oddly
for a focus tool (half a sentence bright, half dim).

Sentence splitting handles CJK and Western punctuation and avoids the usual
traps: the dot in `3.14`, abbreviations like `Mr.` and `e.g.`, single initials
like `J. R.`, and treating `...` as one boundary rather than three.

## Commands

- **Turn the lamp on / off**
- **Cycle granularity**
- **Diagnose: why is nothing dimmed**

All three live in the command palette. The plugin ships without default
hotkeys so it cannot collide with yours — assign shortcuts in Obsidian's
keyboard settings if you want them.

If the lamp seems to do nothing, run **Diagnose: why is nothing dimmed** — it
reports the whole chain (switch, granularity, note, scope, editors attached,
lines actually carrying the decoration class) onto the clipboard and shows the
verdict in a notice.

## How it works

Desk Lamp uses a CodeMirror 6 `ViewPlugin` with line decorations. The lit set
is computed from `EditorState` on every selection change, and only the
*visible* lines outside it get a decoration class.

That means no global `<body>` class, no injected `<style>` element, and no DOM
walking — each editor instance owns its own state, so split panes and multiple
windows are handled per editor rather than globally.

## Development

```bash
npm install
npm run dev         # watch build
npm run typecheck
npm test            # 49 engine tests
npm run build       # production build
npm run test:bundle # 17 smoke tests against the built artifact
npm run verify      # all of the above, then install into the vault
```

The engine tests import the real functions from `src/engine.ts` and run them
against real CodeMirror state and the real markdown parser, so they cannot
drift from the source. `test/perf.mjs` measures the per-keystroke cost.

Created by [@ouatis](https://github.com/ouatis). Inspired by
[Stille](https://github.com/michaellee/stille) by Michael Lee. Ribbon icon from
[Phosphor Icons](https://phosphoricons.com). Third-party notices:
[NOTICE.md](NOTICE.md).
