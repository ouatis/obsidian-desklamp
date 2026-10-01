// Loads the shipped bundle with "obsidian" stubbed, then runs the checks.
// Kept as CJS because the resolution hook only fires on the CJS path.
const path = require("node:path");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const Module = require("node:module");

// Read the id from manifest.json so a rename cannot leave this test
// pointing at a stale directory — the same reason install-vault.mjs does.
// JY_VAULT lets CI (and anyone with the vault elsewhere) redirect both the
// vault location and, via JY_BUNDLE, the artifact under test.
const manifest = JSON.parse(
	fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8")
);
const VAULT = process.env.JY_VAULT ?? "D:/JARDIN";
// path.resolve normalises the separators so the same value works whether
// it arrived as D:/x, D:\x or a POSIX path from CI.
const BUNDLE =
	process.env.JY_BUNDLE ??
	path.resolve(VAULT, ".obsidian", "plugins", manifest.id, "main.js");
const src = fs.readFileSync(BUNDLE, "utf8");

// The bundle lives in the vault, so it cannot reach this project's
// node_modules for the CodeMirror externals. Resolve them explicitly.
const PROJECT = path.join(__dirname, "..");
const externals = {
	obsidian: path.join(__dirname, "stubs", "obsidian.js"),
	"@codemirror/state": require.resolve("@codemirror/state", {
		paths: [PROJECT],
	}),
	"@codemirror/view": require.resolve("@codemirror/view", { paths: [PROJECT] }),
	"@codemirror/language": require.resolve("@codemirror/language", {
		paths: [PROJECT],
	}),
};

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
	if (externals[request]) return externals[request];
	return origResolve.call(this, request, ...rest);
};

const mod = require(BUNDLE);
const PluginClass = mod.default ?? mod;

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

console.log("静一点 — shipped-bundle smoke test");
console.log("artifact: " + BUNDLE + "\n");

t("bundle loads and exports a class", () => {
	assert.equal(typeof PluginClass, "function");
});

t("exports the plugin with onload / onunload", () => {
	assert.equal(typeof PluginClass.prototype.onload, "function");
	assert.equal(typeof PluginClass.prototype.onunload, "function");
});

t("emits only the dl-dim decoration class", () => {
	const classes = [...src.matchAll(/class:\s*"([^"]+)"/g)].map((m) => m[1]);
	assert.deepEqual(classes, ["dl-dim"]);
});

t("heading detection survives minification", () => {
	assert.ok(src.includes("Setext"), "Setext heading support present");
});

t("does not reuse Stille's global body classes", () => {
	assert.ok(!src.includes("StilleStyle"));
	assert.ok(!src.includes("StilleUnfocusTitle"));
});

t("never writes CSS variables onto document.body", () => {
	assert.ok(!/document\.body\.style\.setProperty/.test(src));
});

t("keeps CodeMirror external rather than inlining it", () => {
	for (const m of [
		"@codemirror/state",
		"@codemirror/view",
		"@codemirror/language",
	]) {
		assert.ok(src.includes(`require("${m}")`), `${m} must stay external`);
	}
});

t("the shipped bundle declares decorations in its plugin spec", () => {
	// Minification must not drop the spec. Without it the plugin renders
	// nothing and reports itself healthy — the worst failure mode, and the
	// one that actually happened once.
	// After minification this looks like: {decorations:s=>s.decorations}
	const hasSpec = /decorations\s*:\s*\w+\s*=>\s*\w+\s*\.\s*decorations/.test(
		src
	);
	assert.ok(hasSpec, "bundle must contain a decorations spec for the ViewPlugin");
	assert.ok(
		/ViewPlugin\s*\.\s*fromClass\s*\(/.test(src),
		"bundle must build the engine via ViewPlugin.fromClass"
	);
});

t("registers both lamp icons for the ribbon", () => {
	// A missing icon means a blank square with no error, so assert both
	// the off and on variants are embedded in the bundle.
	assert.ok(src.includes("dl-lamp-off"), "off icon must be registered");
	assert.ok(src.includes("dl-lamp-on"), "on icon must be registered");
	// Both glyphs share a viewBox, so swapping cannot shift the ribbon.
	const viewBoxes = [...src.matchAll(/viewBox="0 0 256 256"/g)];
	assert.ok(viewBoxes.length >= 2, "both SVGs must share the 256 viewBox");
});

t("swaps the ribbon icon through Obsidian's setIcon", () => {
	assert.ok(src.includes("setIcon"), "must use the public setIcon helper");
	// After minification the ternary survives as `X?"dl-lamp-on":"dl-lamp-off"`
	// with the strings intact, so match on the adjacent pair directly.
	const ternary =
		/"dl-lamp-on"\s*:\s*"dl-lamp-off"|"dl-lamp-off"\s*:\s*"dl-lamp-on"/.test(
			src
		);
	assert.ok(
		ternary,
		"toggle must choose between the two icon ids, e.g. on ? 'dl-lamp-on' : 'dl-lamp-off'"
	);
});

t("the Stille migration is guarded by an explicit flag", () => {
	// Regression guard. The old guard was
	//   if (settings.dimOpacity !== DEFAULTS.dimOpacity) return;
	// which cannot tell "never touched" from "deliberately set to 0.3",
	// so the migration ran on every launch and reset the user's settings.
	assert.ok(
		src.includes("migratedFromStille"),
		"migration must be gated on a persisted flag, not a value comparison"
	);
	assert.ok(
		!/dimOpacity\s*!==\s*\w*DEFAULTS\w*\.dimOpacity/.test(src),
		"must not gate migration on comparing dimOpacity to the default"
	);
});

t("re-syncs when a note is opened, not only when edited", () => {
	// Regression guard. Only editor-change, onLayoutReady and window
	// focus/blur used to trigger a sync, so opening a note left it lit
	// until the first edit — and if focus: false was in that note's
	// frontmatter, it stayed dimmed for the wrong reason.
	for (const evt of ["file-open", "active-leaf-change", "layout-change"]) {
		assert.ok(
			src.includes(`"${evt}"`),
			`must sync on ${evt} so opening a note is not left unsynced`
		);
	}
});

t("clears the debounce timer on unload", () => {
	// Everything else is cleaned up via registerEvent / register, so the
	// debounce timer must not outlive the plugin.
	assert.ok(src.includes("clearTimeout"), "must clear the debounce timer");
});

t("ships no real vault paths or project names", () => {
  // The strings file went out with "03-OUATIS" in an example once. The
  // placeholder text ships inside a public release, so it stays generic.
  for (const leak of ["OUATIS", "JARDIN", "LOULOULOU", "笼城", "感应石"]) {
    assert.ok(!src.includes(leak), `must not mention ${leak}`);
  }
  for (const generic of ["novels/", "drafts/"]) {
    assert.ok(src.includes(generic), `examples should use ${generic}`);
  }
});

t("bundle is reasonably small", () => {
	const kb = Buffer.byteLength(src) / 1024;
	assert.ok(kb < 60, `bundle is ${kb.toFixed(1)}KB, expected < 60KB`);
	console.log(`       (${kb.toFixed(1)}KB)`);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
