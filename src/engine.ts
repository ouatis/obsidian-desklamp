import { syntaxTree } from "@codemirror/language";
import {
  Compartment,
  EditorState,
  Facet,
  RangeSetBuilder,
  type Extension,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";

/* ------------------------------------------------------------------ *
 * 静一点 — focus engine
 *
 * Everything is derived from EditorState (document + selection) and
 * expressed as CodeMirror line decorations. No DOM walking, no global
 * body classes, no injected <style> element.
 * ------------------------------------------------------------------ */

export type Granularity = "line" | "sentence" | "paragraph" | "section";

export interface EngineConfig {
  /** Master switch for the decoration engine. */
  enabled: boolean;
  granularity: Granularity;
  /** Opacity applied to unfocused lines (0..1). */
  dimOpacity: number;
  /** Heading level that starts a new "section" (1 = H1 only). */
  sectionLevel: number;
  /** Keep the heading governing the caret lit along with its body. */
  keepHeading: boolean;
  /** Never dim a line that renders an embed, image, math or a table. */
  exemptRich: boolean;
  /** Animate opacity changes (ms; 0 = off). */
  transitionMs: number;
  /** Dim the file name / tab title as well. */
  dimTitle: boolean;
}

export const DEFAULT_CONFIG: EngineConfig = {
  enabled: false,
  granularity: "paragraph",
  dimOpacity: 0.3,
  sectionLevel: 2,
  keepHeading: true,
  exemptRich: true,
  transitionMs: 140,
  dimTitle: true,
};

/**
 * Config travels in a Facet so every editor instance carries its own copy
 * and a settings change arrives as a normal CodeMirror transaction.
 */
const configFacet = Facet.define<EngineConfig, EngineConfig>({
  combine: (values) => values[0] ?? DEFAULT_CONFIG,
});

export const configCompartment = new Compartment();

function cfgOf(state: EditorState): EngineConfig {
  return state.facet(configFacet);
}

/**
 * Heading nodes as emitted by the markdown parser:
 *   "# Title"     -> ATXHeading1 .. ATXHeading6
 *   "Title\n=====" -> SetextHeading1 / SetextHeading2
 * A Setext heading spans two lines, so both of its lines report the level.
 */
const HEADING_RE = /^(?:ATX|Setext)Heading([1-6])$/;

function headingLevelAt(state: EditorState, lineNo: number): number {
  const line = state.doc.line(lineNo);
  // Resolve inside the line, biased to the end, so the underline of a
  // Setext heading resolves into the heading node rather than to the
  // following sibling.
  const node = syntaxTree(state).resolveInner(line.to, -1);
  for (let n: typeof node | null = node; n; n = n.parent) {
    const m = HEADING_RE.exec(n.name);
    if (m) return Number(m[1]);
  }
  return 0;
}

/** Lines that visually continue the paragraph containing `lineNo`. */
function isContinuation(state: EditorState, lineNo: number): boolean {
  const line = state.doc.line(lineNo);
  if (line.text.trim() === "") return false;
  if (headingLevelAt(state, lineNo) > 0) return false;
  const inner = syntaxTree(state).resolveInner(line.to, -1);
  for (let n: typeof inner | null = inner; n; n = n.parent) {
    // Code fences and block quotes own their own rhythm.
    if (n.name === "FencedCode" || n.name === "Blockquote") return false;
  }
  return true;
}

/** Lines whose content should never be dimmed (embeds, math, tables). */
function isRichLine(state: EditorState, lineNo: number): boolean {
  const text = state.doc.line(lineNo).text;
  if (/^\s*!?\[\[[^\]]+\]\]\s*$/.test(text)) return true; // embeds
  if (/^\s*\$\$/.test(text)) return true; // display math
  if (/^\s*\|.*\|\s*$/.test(text)) return true; // table row
  if (/\$[^$\n]+\$/.test(text)) return true; // inline math
  return false;
}

/**
 * Sentence terminators, CJK and Western. A terminator only ends a sentence
 * when followed by whitespace, another terminator, or end of text — this is
 * what keeps "Mr." and "3.14" from splitting.
 */
const SENTENCE_END = /[.!?。！？…]/;

/** Abbreviations after which a period does NOT end a sentence. */
const ABBREVIATIONS = new Set([
  "mr",
  "mrs",
  "ms",
  "dr",
  "prof",
  "sr",
  "jr",
  "st",
  "vs",
  "etc",
  "eg",
  "ie",
  "fig",
  "no",
  "vol",
  "pp",
  "ed",
  "eds",
  "al",
  "inc",
  "ltd",
  "co",
  "approx",
  "dept",
  "univ",
  "cf",
  "ca",
  "circa",
]);

/**
 * Offsets (indices into `text`) just past each sentence boundary. Returns
 * the empty array when the text has no terminator, meaning one sentence.
 */
export function sentenceBoundaries(text: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (!SENTENCE_END.test(ch)) continue;

    // An ellipsis is one boundary, not three.
    if (ch === "." && text[i + 1] === "." && text[i + 2] === ".") {
      i += 2;
      // Keep consuming dots in a run like "......".
      while (text[i + 1] === ".") i++;
    }

    const next = text[i + 1];
    const nextIsEnd = next === undefined || /\s/.test(next);
    // A CJK terminator ends the sentence even when the next character
    // is another terminator or a closing quote.
    const cjk = /[。！？…]/.test(ch);
    const nextIsCloser = next !== undefined && /["'”’」』）)\]】》]/.test(next);
    if (!cjk && !nextIsEnd && !nextIsCloser) continue;

    // Guard against abbreviations: "Mr." / "e.g." only count when the
    // token before the dot is a known short form.
    if (ch === ".") {
      const before = text.slice(0, i);
      const m = /([A-Za-zÀ-ÿ.]+)$/.exec(before);
      const word = (m?.[1] ?? "").replace(/\./g, "").toLowerCase();
      if (word && ABBREVIATIONS.has(word)) continue;
      // Single initial such as "J." in "J. Smith".
      if (word.length === 1 && /^[A-Z]$/.test(m?.[1] ?? "")) continue;
      // Version numbers / decimals: digit on both sides.
      if (/\d$/.test(before) && next !== undefined && /\d/.test(next)) continue;
    }

    out.push(i + 1);
  }
  return out;
}

/**
 * The lines spanned by the sentence containing `pos`, clamped to the
 * paragraph. Decorations are line-granular, so a sentence in the middle of
 * a line lights that whole line — the granularity we can actually express.
 */
function sentenceLines(state: EditorState, pos: number): Set<number> {
  const total = state.doc.lines;
  const headLine = state.doc.lineAt(pos).number;

  // Clamp to the surrounding paragraph: a sentence never crosses a blank
  // line, a heading, a fence or a blockquote boundary.
  let first = headLine;
  while (first > 1 && isContinuation(state, first - 1)) first--;
  let last = headLine;
  while (last < total && isContinuation(state, last + 1)) last++;

  const start = state.doc.line(first).from;
  const end = state.doc.line(last).to;
  const text = state.doc.sliceString(start, end);
  const rel = pos - start;

  // Walk the boundaries to find the sentence containing the caret.
  const bounds = sentenceBoundaries(text);
  let from = 0;
  let to = text.length;
  for (const b of bounds) {
    if (b > rel) {
      to = b;
      break;
    }
    from = b;
  }

  const out = new Set<number>();
  // A sentence boundary lands just past its terminator. When the previous
  // sentence ended at a line's trailing edge, that offset is the newline
  // itself, and lineAt() would report the *previous* line — lighting a line
  // the sentence never touches. Skip leading newlines before resolving.
  let startRel = from;
  while (startRel < to && text[startRel] === "\n") startRel++;

  const a = state.doc.lineAt(start + startRel).number;
  const b = state.doc.lineAt(start + Math.max(startRel, to - 1)).number;
  for (let n = a; n <= b; n++) out.add(n);
  // The line the caret sits on is always lit, even if the range maths
  // degenerated on an empty paragraph.
  out.add(headLine);
  return out;
}

/** Expand every selection range into the set of line numbers that stay lit. */
function focusedLines(state: EditorState, cfg: EngineConfig): Set<number> {
  const out = new Set<number>();
  const total = state.doc.lines;

  for (const range of state.selection.ranges) {
    const headLine = state.doc.lineAt(range.head).number;
    out.add(headLine);
    // A non-empty selection lights everything it touches.
    if (!range.empty) {
      const a = state.doc.lineAt(range.from).number;
      const b = state.doc.lineAt(range.to).number;
      for (let n = a; n <= b; n++) out.add(n);
    }

    if (cfg.granularity === "sentence") {
      for (const n of sentenceLines(state, range.head)) out.add(n);
      continue;
    }

    if (cfg.granularity === "paragraph") {
      let n = headLine;
      while (n > 1 && isContinuation(state, n - 1)) out.add(--n);
      n = headLine;
      while (n < total && isContinuation(state, n + 1)) out.add(++n);
      continue;
    }

    if (cfg.granularity !== "section") continue;

    // Walk up to the heading that owns this line. NB: headingLevelAt
    // returns 0 for ordinary text, so the level must be tested for > 0
    // as well — otherwise every plain line would look like a match.
    let owner = 0;
    for (let n = headLine; n >= 1; n--) {
      const hl = headingLevelAt(state, n);
      if (hl > 0 && hl <= cfg.sectionLevel) {
        owner = n;
        break;
      }
    }
    if (owner === 0) {
      // Above the first heading: the whole preamble is one section.
      let last = 1;
      for (let n = 1; n <= total; n++) {
        if (headingLevelAt(state, n) > 0) break;
        last = n;
      }
      for (let n = 1; n <= last; n++) out.add(n);
      continue;
    }
    if (cfg.keepHeading) out.add(owner);
    for (let n = owner + 1; n <= total; n++) {
      const hl = headingLevelAt(state, n);
      if (hl > 0 && hl <= cfg.sectionLevel) break;
      out.add(n);
    }
  }
  return out;
}

/** Test-only alias so test/engine.test.mjs can drive the real function. */
export const focusedLinesForTest = focusedLines;
/** Test-only: the real build(), so decoration counts can be asserted. */
export const buildForTest = build;

const dimmedLine = Decoration.line({ class: "dl-dim" });

/** The structural shape of EditorView.visibleRanges (a plain {from,to}). */
interface Span {
  from: number;
  to: number;
}

function build(
  state: EditorState,
  cfg: EngineConfig,
  visible: readonly Span[],
): DecorationSet {
  if (!cfg.enabled) return Decoration.none;

  const lit = focusedLines(state, cfg);
  const builder = new RangeSetBuilder<Decoration>();
  const total = state.doc.lines;

  // Decoration.line ranges must ascend and never repeat a line. A single
  // long line can straddle two visible ranges, so we dedupe as we go.
  let lastLine = -1;
  for (const range of visible) {
    const from = state.doc.lineAt(range.from).number;
    const to = state.doc.lineAt(range.to).number;
    for (let n = from; n <= to && n <= total; n++) {
      if (n === lastLine) continue;
      lastLine = n;
      if (lit.has(n)) continue;
      if (cfg.exemptRich && isRichLine(state, n)) continue;
      const line = state.doc.line(n);
      if (line.length === 0) continue; // trailing newline: no glyphs
      builder.add(line.from, line.from, dimmedLine);
    }
  }
  return builder.finish();
}

class FocusEngine {
  decorations: DecorationSet;
  readonly view: EditorView;

  constructor(view: EditorView) {
    this.view = view;
    const cfg = cfgOf(view.state);
    this.decorations = build(view.state, cfg, view.visibleRanges);
    this.applyVars(cfg);
  }

  update(update: ViewUpdate) {
    const cfg = cfgOf(update.state);
    if (
      update.docChanged ||
      update.selectionSet ||
      update.viewportChanged ||
      update.startState.facet(configFacet) !== cfg
    ) {
      this.decorations = build(
        update.view.state,
        cfg,
        update.view.visibleRanges,
      );
    }
    this.applyVars(cfg);
  }

  applyVars(cfg: EngineConfig) {
    const dom = this.view.dom;
    dom.style.setProperty("--dl-dim", String(cfg.dimOpacity));
    dom.style.setProperty("--dl-transition", `${cfg.transitionMs}ms`);
  }

  destroy() {
    const dom = this.view.dom;
    dom.style.removeProperty("--dl-dim");
    dom.style.removeProperty("--dl-transition");
  }
}

/**
 * The spec MUST declare `decorations`. CodeMirror only collects a
 * ViewPlugin's decorations when the spec says how to read them — merely
 * assigning `this.decorations` inside the class is not enough, and the
 * plugin then renders nothing at all with no error. See CM6's own
 * activeLineHighlighter, which passes { decorations: v => v.decorations }.
 */
const focusEngineSpecValue = {
  decorations: (v: FocusEngine) => v.decorations,
};

export const focusEngine: Extension = ViewPlugin.fromClass(
  FocusEngine,
  focusEngineSpecValue,
);

/** Test-only: the real spec, so a regression here cannot pass silently. */
export function focusEngineSpec() {
  return focusEngineSpecValue;
}

/** The extension installed into every markdown editor. */
export function focusExtension(): Extension {
  return [focusEngine, configCompartment.of(configFacet.of(DEFAULT_CONFIG))];
}

/** Push a new config into one editor view. */
export function applyConfigTo(view: EditorView, cfg: EngineConfig) {
  view.dispatch({
    effects: configCompartment.reconfigure(configFacet.of(cfg)),
  });
}

/* ---------------------------- scope rules ---------------------------- */

export interface ScopeRules {
  /** Only these folders/files get dimmed. Empty = everything. */
  onlyPaths: string[];
  /** Never dim these, even if inside an "only" path. */
  exceptPaths: string[];
  /** Frontmatter key that forces focus off/on for a note. */
  frontmatterKey: string;
}

export const DEFAULT_SCOPE: ScopeRules = {
  onlyPaths: [],
  exceptPaths: [],
  frontmatterKey: "focus",
};

function norm(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();
}

/**
 * Folder-aware glob. A pattern containing no slash is matched against each
 * path segment, so "novels" covers "a/novels/b.md". Otherwise "*" is the
 * only wildcard.
 */
function matchPath(path: string, pattern: string): boolean {
  if (pattern === "") return false;
  if (!pattern.includes("/")) return path.split("/").includes(pattern);
  if (!pattern.includes("*")) {
    return path === pattern || path.startsWith(pattern + "/");
  }
  const rx = pattern
    .split("*")
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${rx}$`).test(path);
}

/**
 * Read a per-note frontmatter override.
 *
 * `false` / "off" turns focus off for the note; a granularity name
 * ("line", "sentence", "paragraph", "section") keeps focus on but pins
 * the granularity for that note only; anything else (including a bare
 * "true") means "no opinion, use the global setting".
 */
export function readFocusOverride(value: unknown): Granularity | false | null {
  if (value === undefined || value === null) return null;
  if (value === false || value === 0) return false;
  if (value === "off" || value === "false" || value === "no") return false;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "off" || v === "false" || v === "no") return false;
    if (
      v === "line" ||
      v === "sentence" ||
      v === "paragraph" ||
      v === "section"
    ) {
      return v;
    }
    // A granularity spelled in Chinese. Several of these read as ordinary
    // Japanese words too (行 / 句 / 段落 / 小節), so this doubles as the
    // CJK path for frontmatter regardless of the UI language.
    if (v === "行") return "line";
    if (v === "句") return "sentence";
    if (v === "段落" || v === "段") return "paragraph";
    if (v === "小节" || v === "小節" || v === "节" || v === "節") {
      return "section";
    }
  }
  if (value === true || value === 1 || value === "on" || value === "true") {
    return null; // on, but no granularity opinion
  }
  return null;
}

/** Whether a note should be dimmed at all, given the user's scope rules. */
export function pathInScope(
  filePath: string,
  rules: ScopeRules,
  frontmatterValue?: unknown,
): boolean {
  const p = norm(filePath);
  const override = readFocusOverride(frontmatterValue);
  if (override === false) return false;

  for (const ex of rules.exceptPaths) {
    if (matchPath(p, norm(ex))) return false;
  }
  if (rules.onlyPaths.length === 0) return true;
  for (const on of rules.onlyPaths) {
    if (matchPath(p, norm(on))) return true;
  }
  return false;
}
