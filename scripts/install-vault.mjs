/*
 * Copy the built plugin into a vault's .obsidian/plugins/<id>/.
 * Kept as a script so `npm run verify` can never again test a build that
 * differs from the one sitting in the vault.
 *
 * The plugin id is read from manifest.json rather than hard-coded, so a
 * rename cannot leave this script installing to the old directory.
 *
 * Usage:  node scripts/install-vault.mjs [vaultPath]
 *         JY_VAULT=/path/to/vault node scripts/install-vault.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.join(here, "..");
const vault = process.argv[2] ?? process.env.JY_VAULT ?? "D:/JARDIN";

const manifestPath = path.join(project, "manifest.json");
if (!fs.existsSync(manifestPath)) {
	console.error("  MISSING manifest.json — run \"npm run build\" first");
	process.exit(1);
}
const { id } = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const dest = path.join(vault, ".obsidian", "plugins", id);

const FILES = ["main.js", "manifest.json", "styles.css"];

fs.mkdirSync(dest, { recursive: true });

let ok = true;
for (const f of FILES) {
	const from = path.join(project, f);
	if (!fs.existsSync(from)) {
		console.error(`  MISSING ${f} — run "npm run build" first`);
		ok = false;
		continue;
	}
	fs.copyFileSync(from, path.join(dest, f));
	const a = fs.readFileSync(from);
	const b = fs.readFileSync(path.join(dest, f));
	const same = a.equals(b);
	console.log(
		`  ${same ? "ok  " : "FAIL"} ${f}  ${(a.length / 1024).toFixed(1)}KB -> ${dest}`
	);
	if (!same) ok = false;
}

process.exit(ok ? 0 : 1);
