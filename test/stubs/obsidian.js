// Minimal stand-in for the obsidian module, used only by the bundle smoke
// test so the shipped main.js can be loaded outside the Obsidian app.
class Plugin {
	constructor(app, manifest) {
		this.app = app;
		this.manifest = manifest;
	}
	addRibbonIcon() {}
	addStatusBarItem() {
		return { setText() {}, toggleClass() {}, remove() {} };
	}
	addCommand() {}
	addSettingTab() {}
	registerEditorExtension() {}
	registerEvent() {}
	register() {}
	async loadData() {
		return null;
	}
	async saveData() {}
}

class PluginSettingTab {
	constructor(app, plugin) {
		this.app = app;
		this.plugin = plugin;
	}
	display() {}
}

module.exports = {
	Plugin,
	PluginSettingTab,
	Setting: class {},
	MarkdownView: class {},
	Notice: class {},
	Modal: class {},
	addIcon() {},
	normalizePath: (p) => p,
};
