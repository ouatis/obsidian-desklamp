/*
 * Performance probe: how long does focusedLines() take on a long note?
 * Run with:  node --experimental-strip-types test/perf.mjs
 */
import { EditorSelection, EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { focusedLinesForTest as focusedLines } from "../src/engine.ts";

function makeDoc(sections, linesPerSection) {
	const out = [];
	for (let s = 1; s <= sections; s++) {
		out.push(`## Section ${s}`);
		for (let i = 0; i < linesPerSection; i++) {
			out.push(`Line ${i + 1} of section ${s}, with some prose to parse.`);
		}
		out.push("");
	}
	return out.join("\n");
}

function bench(doc, line, granularity, label) {
	const s0 = EditorState.create({ doc, extensions: [markdown()] });
	const caret = s0.doc.line(line).from;
	const s = EditorState.create({
		doc,
		extensions: [markdown()],
		selection: EditorSelection.create([EditorSelection.cursor(caret)]),
	});
	const cfg = { granularity, sectionLevel: 2, keepHeading: true };

	// Warm up so we time the steady state, not first-parse cost.
	for (let i = 0; i < 3; i++) focusedLines(s, cfg);

	const runs = 50;
	const t0 = process.hrtime.bigint();
	for (let i = 0; i < runs; i++) focusedLines(s, cfg);
	const t1 = process.hrtime.bigint();
	const per = Number(t1 - t0) / 1e6 / runs;

	const target = s0.doc.line(line).number;
	const total = s0.doc.lines;
	const mid = Math.floor(total / 2);
	const tMid = process.hrtime.bigint();
	for (let i = 0; i < runs; i++) {
		const m = EditorState.create({
			doc,
			extensions: [markdown()],
			selection: EditorSelection.create([
				EditorSelection.cursor(s0.doc.line(mid).from),
			]),
		});
		focusedLines(m, cfg);
	}
	const perMid = Number(process.hrtime.bigint() - tMid) / 1e6 / runs;

	console.log(
		`  ${label.padEnd(34)} lines=${String(total).padStart(5)}  ` +
			`line ${String(target).padStart(5)}: ${per.toFixed(2)}ms   ` +
			`mid: ${perMid.toFixed(2)}ms`
	);
	return Math.max(per, perMid);
}

console.log("静一点 — focusedLines() cost per keystroke\n");
console.log("  (budget: CM6 must finish a keystroke in < 4ms)\n");

const doc = makeDoc(200, 24); // 200 sections x ~25 lines = ~5000 lines
let worst = 0;
for (const g of ["line", "sentence", "paragraph", "section"]) {
	worst = Math.max(worst, bench(doc, 2500, g, `5000-line note, ${g}`));
}

console.log("\n  -- scaling (section granularity) --");
for (const n of [50, 100, 200, 400]) {
	const d = makeDoc(n, 24);
	worst = Math.max(worst, bench(d, Math.floor(d.split("\n").length / 2), "section", `${d.split("\n").length} lines`));
}

console.log(`\n  worst case: ${worst.toFixed(2)}ms`);
if (worst > 4) {
	console.log("  VERDICT: over budget — typing would stutter on long notes");
	process.exitCode = 1;
} else {
	console.log("  VERDICT: within budget");
}
