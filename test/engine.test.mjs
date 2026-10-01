/*
 * Engine tests — exercise the REAL functions exported from src/engine.ts
 * against real CodeMirror state and the real markdown parser, outside
 * Obsidian. Nothing is re-implemented here, so the tests cannot drift.
 *
 * Run with:  npm test
 */
import assert from "node:assert/strict";
import { EditorSelection, EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { Decoration } from "@codemirror/view";
import {
	buildForTest,
	focusedLinesForTest as focusedLines,
	focusEngineSpec,
	pathInScope,
	readFocusOverride,
	sentenceBoundaries,
} from "../src/engine.ts";

const DOC = [
	"preamble line one", // 1
	"preamble line two", // 2
	"", // 3
	"# Title", // 4
	"intro para A", // 5
	"intro para A cont", // 6
	"", // 7
	"## Section One", // 8
	"body of one", // 9
	"body of one cont", // 10
	"", // 11
	"### Sub", // 12
	"sub body", // 13
	"", // 14
	"## Section Two", // 15
	"body of two", // 16
].join("\n");

function at(s, line) {
	return EditorSelection.cursor(s.doc.line(line).from);
}

function withCaret(line) {
	return (s) => at(s, line);
}

function lit(cfg, line) {
	const s0 = EditorState.create({ doc: DOC, extensions: [markdown()] });
	const s = EditorState.create({
		doc: DOC,
		extensions: [markdown()],
		selection: EditorSelection.create([withCaret(line)(s0)]),
	});
	return [...focusedLines(s, cfg)].sort((a, b) => a - b);
}

let pass = 0;
let fail = 0;
function t(name, fn) {
	try {
		fn();
		pass++;
		console.log("  ok   " + name);
	} catch (e) {
		fail++;
		console.log("  FAIL " + name + "\n       " + String(e.message).split("\n")[0]);
	}
}

console.log("静一点 — engine tests\n");

/* ----------------------------- granularity ----------------------------- */

t("line: lights exactly the caret line", () => {
	assert.deepEqual(lit({ granularity: "line" }, 16), [16]);
});

t("paragraph: spans soft-wrapped lines", () => {
	assert.deepEqual(lit({ granularity: "paragraph" }, 10), [9, 10]);
});

t("paragraph: stops at a heading", () => {
	assert.deepEqual(lit({ granularity: "paragraph" }, 6), [5, 6]);
});

t("paragraph: does not cross a blank line", () => {
	assert.ok(!lit({ granularity: "paragraph" }, 5).includes(4));
});

t("section L2: heading + body, stops before the next H2", () => {
	assert.deepEqual(
		lit({ granularity: "section", sectionLevel: 2, keepHeading: true }, 9),
		[8, 9, 10, 11, 12, 13, 14]
	);
});

t("section: keepHeading=false drops the heading line", () => {
	const r = lit({ granularity: "section", sectionLevel: 2, keepHeading: false }, 9);
	assert.ok(!r.includes(8), "heading should be dimmed");
	assert.ok(r.includes(9), "body still lit");
});

t("sectionLevel=1: the H1 owns everything to EOF", () => {
	const r = lit({ granularity: "section", sectionLevel: 1, keepHeading: true }, 13);
	assert.ok(r.includes(4) && r.includes(13) && r.includes(16));
});

t("sectionLevel=3: the H3 owns its own subsection", () => {
	assert.deepEqual(
		lit({ granularity: "section", sectionLevel: 3, keepHeading: true }, 13),
		[12, 13, 14]
	);
});

t("section: caret above the first heading lights the preamble", () => {
	const r = lit({ granularity: "section", sectionLevel: 2, keepHeading: true }, 1);
	assert.ok(r.includes(1) && r.includes(2));
});

t("section: a different section is not lit", () => {
	const r = lit({ granularity: "section", sectionLevel: 2, keepHeading: true }, 16);
	assert.ok(r.includes(16));
	assert.ok(!r.includes(9), "line 9 belongs to Section One");
});

t("paragraph does not swallow a fenced code block", () => {
	const doc = ["before", "```js", "const a = 1;", "const b = 2;", "```", "after"].join(
		"\n"
	);
	const s0 = EditorState.create({ doc, extensions: [markdown()] });
	const s = EditorState.create({
		doc,
		extensions: [markdown()],
		selection: EditorSelection.create([at(s0, 3)]),
	});
	assert.deepEqual([...focusedLines(s, { granularity: "paragraph" })], [3]);
});

/* ------------------------------ selection ------------------------------ */

/**
 * Two cursors on one editor. CodeMirror drops extra ranges unless the
 * allowMultipleSelections facet is set — Obsidian enables it, so the test
 * must too, otherwise every multi-caret assertion would pass vacuously.
 */
function twoCaretState() {
	const s0 = EditorState.create({ doc: DOC, extensions: [markdown()] });
	const s = EditorState.create({
		doc: DOC,
		extensions: [markdown(), EditorState.allowMultipleSelections.of(true)],
		selection: EditorSelection.create([at(s0, 9), at(s0, 16)], 0),
	});
	assert.equal(
		s.selection.ranges.length,
		2,
		"harness: state must actually carry 2 ranges"
	);
	return s;
}

t("multi-caret: both lines lit", () => {
	const s = twoCaretState();
	assert.equal(s.selection.ranges.length, 2, "state really has 2 ranges");
	const got = [...focusedLines(s, { granularity: "line" })].sort((a, b) => a - b);
	assert.deepEqual(got, [9, 16], `got ${JSON.stringify(got)}`);
});

t("multi-caret + section: both sections and both headings lit", () => {
	const s = twoCaretState();
	assert.equal(s.selection.ranges.length, 2, "state really has 2 ranges");
	const l = focusedLines(s, {
		granularity: "section",
		sectionLevel: 2,
		keepHeading: true,
	});
	assert.ok(l.has(9) && l.has(16), `carets, got ${JSON.stringify([...l])}`);
	assert.ok(l.has(8) && l.has(15), `headings, got ${JSON.stringify([...l])}`);
});

t("a non-empty selection lights every line it spans", () => {
	const s0 = EditorState.create({ doc: DOC, extensions: [markdown()] });
	const s = EditorState.create({
		doc: DOC,
		extensions: [markdown()],
		selection: EditorSelection.single(
			s0.doc.line(9).from,
			s0.doc.line(10).to
		),
	});
	const l = focusedLines(s, { granularity: "line" });
	assert.ok(l.has(9) && l.has(10));
});

t("an empty document does not throw", () => {
	focusedLines(EditorState.create({ doc: "", extensions: [markdown()] }), {
		granularity: "section",
		sectionLevel: 2,
		keepHeading: true,
	});
});

/* ------------------------------ scope rules ---------------------------- */

const RULES = { onlyPaths: [], exceptPaths: [], frontmatterKey: "focus" };

t("scope: empty only-list means everything is in scope", () => {
	assert.equal(pathInScope("any/note.md", RULES), true);
});

t("scope: only-list restricts to that folder", () => {
	const r = { ...RULES, onlyPaths: ["10-创作"] };
	assert.equal(pathInScope("10-创作/a.md", r), true);
	assert.equal(pathInScope("00-MEMORTE/a.md", r), false);
});

t("scope: a bare folder name matches at any depth", () => {
	const r = { ...RULES, onlyPaths: ["novels"] };
	assert.equal(pathInScope("a/b/novels/c.md", r), true);
	assert.equal(pathInScope("a/b/other/c.md", r), false);
});

t("scope: except beats only", () => {
	const r = { ...RULES, onlyPaths: ["10-创作"], exceptPaths: ["10-创作/草稿"] };
	assert.equal(pathInScope("10-创作/a.md", r), true);
	assert.equal(pathInScope("10-创作/草稿/b.md", r), false);
});

t("scope: frontmatter focus:false wins over only-list", () => {
	const r = { ...RULES, onlyPaths: ["10-创作"] };
	assert.equal(pathInScope("10-创作/a.md", r, false), false);
	assert.equal(pathInScope("10-创作/a.md", r, "off"), false);
});

t("scope: a granularity override does NOT bypass the only-list", () => {
	// Earlier behaviour let `focus: true` force a note into scope, which
	// meant one frontmatter key could sidestep the user's folder rules.
	// Now only `false` has any scope effect.
	const r = { ...RULES, onlyPaths: ["10-创作"] };
	assert.equal(pathInScope("00-MEMORTE/a.md", r, true), false);
	assert.equal(pathInScope("00-MEMORTE/a.md", r, "section"), false);
	assert.equal(pathInScope("10-创作/a.md", r, "section"), true);
});

t("scope: paths match case-insensitively and slash-normalised", () => {
	const r = { ...RULES, onlyPaths: ["10-Creative"] };
	assert.equal(pathInScope("10-creative\\sub\\a.md", r), true);
});

/* ------------------------------ extension ------------------------------ */

t("the ViewPlugin spec exposes decorations", () => {
	// Regression guard: assigning this.decorations inside the class is not
	// enough. CodeMirror only reads it when the spec says so, and when it
	// does not the plugin renders nothing with no error at all.
	const spec = focusEngineSpec();
	assert.ok(spec, "the extension must be a ViewPlugin with a spec");
	assert.equal(typeof spec.decorations, "function");
});

t("the spec's decorations getter returns a DecorationSet", () => {
	const spec = focusEngineSpec();
	const stub = { decorations: Decoration.none };
	const out = spec.decorations(stub);
	// DecorationSet exposes .size; anything else means we returned junk.
	assert.equal(typeof out.size, "number");
	assert.equal(out.size, 0);
});

t("a disabled config produces no decorations", () => {
	const s = EditorState.create({ doc: "a\nb\nc", extensions: [markdown()] });
	const set = buildForTest(s, { enabled: false }, [
		{ from: 0, to: s.doc.length },
	]);
	assert.equal(set.size, 0, "must be empty while disabled");
});

t("an enabled config produces one decoration per unfocused line", () => {
	const doc = "one\ntwo\nthree";
	const s0 = EditorState.create({ doc, extensions: [markdown()] });
	const s = EditorState.create({
		doc,
		extensions: [markdown()],
		selection: EditorSelection.create([at(s0, 2)]),
	});
	const set = buildForTest(s, { enabled: true, granularity: "line" }, [
		{ from: 0, to: s.doc.length },
	]);
	// 3 lines, caret on line 2 -> lines 1 and 3 dimmed.
	assert.equal(set.size, 2, `expected 2 dimmed lines, got ${set.size}`);
});

/* ----------------------------- sentence ----------------------------- */

t("sentence: splits on a full stop", () => {
	// "One.[4] Two.[9] Three.[16]" — the final period ends a sentence too.
	assert.deepEqual(sentenceBoundaries("One. Two. Three."), [4, 9, 16]);
});

t("sentence: splits on ! and ?", () => {
	assert.deepEqual(sentenceBoundaries("Hi! Ok? Yes."), [3, 7, 12]);
});

t("sentence: splits on CJK terminators", () => {
	assert.deepEqual(sentenceBoundaries("第一句。第二句！第三句？"), [4, 8, 12]);
});

t("sentence: a CJK terminator needs no trailing space", () => {
	// "。后面" — no whitespace, but the period still ends the sentence.
	assert.deepEqual(sentenceBoundaries("结束。后面"), [3]);
});

t("sentence: does not split on a decimal", () => {
	// The dot in 3.14 is rejected; the two real boundaries are at 19 and 25.
	assert.deepEqual(sentenceBoundaries("Pi is 3.14 exactly. Done."), [19, 25]);
});

t("sentence: does not split on an abbreviation", () => {
	assert.deepEqual(sentenceBoundaries("Mr. Smith left. He stayed."), [15, 26]);
});

t("sentence: does not split on e.g.", () => {
	assert.deepEqual(sentenceBoundaries("Use e.g. this one. Not that."), [18, 28]);
});

t("sentence: does not split on a single initial", () => {
	assert.deepEqual(sentenceBoundaries("J. R. Smith wrote it. Yes."), [21, 26]);
});

t("sentence: an ellipsis is one boundary", () => {
	assert.deepEqual(sentenceBoundaries("Wait... what? Yes."), [7, 13, 18]);
});

t("sentence: no terminator means one sentence", () => {
	assert.deepEqual(sentenceBoundaries("no terminator here"), []);
});

t("sentence: empty text does not throw", () => {
	assert.deepEqual(sentenceBoundaries(""), []);
});

t("sentence: lights only the caret's sentence", () => {
	// Each sentence is on its own line inside one paragraph, so the line
	// granularity has something real to distinguish: only the caret's line
	// stays lit even though the paragraph spans three.
	const doc = ["First one.", "Second one.", "Third one."].join("\n");
	const s0 = EditorState.create({ doc, extensions: [markdown()] });
	const caret = s0.doc.line(2).from + 2; // inside "Second"
	const s = EditorState.create({
		doc,
		extensions: [markdown()],
		selection: EditorSelection.create([EditorSelection.cursor(caret)]),
	});
	const r = [...focusedLines(s, { granularity: "sentence" })].sort(
		(a, b) => a - b
	);
	assert.deepEqual(r, [2], "only the sentence's own line is lit");
});

t("sentence: paragraph granularity would light all three lines", () => {
	// The contrast that proves sentence granularity actually does something.
	const doc = ["First one.", "Second one.", "Third one."].join("\n");
	const s0 = EditorState.create({ doc, extensions: [markdown()] });
	const caret = s0.doc.line(2).from + 2;
	const s = EditorState.create({
		doc,
		extensions: [markdown()],
		selection: EditorSelection.create([EditorSelection.cursor(caret)]),
	});
	const r = [...focusedLines(s, { granularity: "paragraph" })].sort(
		(a, b) => a - b
	);
	assert.deepEqual(r, [1, 2, 3]);
});

t("sentence: two sentences on one line both light that line", () => {
	// The honest limit: decorations are line-granular, so an intra-line
	// sentence boundary cannot dim part of a line.
	const doc = "First one. Second one.";
	const s0 = EditorState.create({ doc, extensions: [markdown()] });
	const s = EditorState.create({
		doc,
		extensions: [markdown()],
		selection: EditorSelection.create([EditorSelection.cursor(s0.doc.line(1).from)]),
	});
	const r = [...focusedLines(s, { granularity: "sentence" })].sort(
		(a, b) => a - b
	);
	assert.deepEqual(r, [1]);
});

t("sentence: does not spill into the next paragraph", () => {
	const doc = "One. Two.\n\nThree. Four.";
	const s0 = EditorState.create({ doc, extensions: [markdown()] });
	const caret = s0.doc.line(3).from + 2;
	const s = EditorState.create({
		doc,
		extensions: [markdown()],
		selection: EditorSelection.create([EditorSelection.cursor(caret)]),
	});
	const r = [...focusedLines(s, { granularity: "sentence" })].sort(
		(a, b) => a - b
	);
	assert.deepEqual(r, [3], "must not light the earlier paragraph");
});

t("sentence: multi-line sentence keeps every line it spans", () => {
	const doc = ["First sentence starts here", "and continues here. Next one."].join(
		"\n"
	);
	const s0 = EditorState.create({ doc, extensions: [markdown()] });
	const caret = s0.doc.line(2).from + 2;
	const s = EditorState.create({
		doc,
		extensions: [markdown()],
		selection: EditorSelection.create([EditorSelection.cursor(caret)]),
	});
	const r = [...focusedLines(s, { granularity: "sentence" })].sort(
		(a, b) => a - b
	);
	// "and continues here." ends on line 2, so the sentence covers both.
	assert.deepEqual(r, [1, 2]);
});

/* ------------------------- frontmatter override ------------------------ */

t("override: false / off / no turns focus off", () => {
	for (const v of [false, 0, "off", "false", "no", "OFF", " off "]) {
		assert.equal(
			readFocusOverride(v),
			false,
			`${JSON.stringify(v)} should turn focus off`
		);
	}
});

t("override: an English granularity pins the granularity", () => {
	assert.equal(readFocusOverride("line"), "line");
	assert.equal(readFocusOverride("sentence"), "sentence");
	assert.equal(readFocusOverride("paragraph"), "paragraph");
	assert.equal(readFocusOverride("section"), "section");
	assert.equal(readFocusOverride("Section"), "section", "case-insensitive");
	assert.equal(readFocusOverride(" section "), "section", "trims");
});

t("override: a Chinese granularity is accepted", () => {
	assert.equal(readFocusOverride("行"), "line");
	assert.equal(readFocusOverride("句"), "sentence");
	assert.equal(readFocusOverride("段落"), "paragraph");
	assert.equal(readFocusOverride("段"), "paragraph");
	assert.equal(readFocusOverride("小节"), "section");
	assert.equal(readFocusOverride("节"), "section");
});

t("override: bare true means on but no granularity opinion", () => {
	for (const v of [true, 1, "on", "true"]) {
		assert.equal(readFocusOverride(v), null, `${JSON.stringify(v)} -> null`);
	}
});

t("override: absent or unrecognised falls through to the global setting", () => {
	for (const v of [undefined, null, "", "nonsense", {}, 42]) {
		assert.equal(readFocusOverride(v), null, `${JSON.stringify(v)} -> null`);
	}
});

t("scope: a granularity override does not remove the note from scope", () => {
	const r = { onlyPaths: [], exceptPaths: [], frontmatterKey: "focus" };
	assert.equal(pathInScope("a.md", r, "section"), true);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
