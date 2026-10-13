# Changelog

## 0.4.3 — 2026-10-14

### Changed

- Refined the settings header and spacing, with narrow-panel layouts and visible keyboard focus. Fonts and colors still follow the active Obsidian theme.
- Simplified the ribbon's lit state and kept reduced-motion support.
- Added a shared concept cover and updated the English, Chinese and Japanese READMEs. The illustration is not a plugin screenshot.

### Fixed

- Scoped the active status-bar color to Desk Lamp's own indicator, so other plugins' active indicators are no longer recolored.

### Maintenance

- Updated build and development dependencies to resolve the esbuild and Moment dependency advisories. These changes do not update Obsidian's own application dependencies.
- Added dependency auditing to local verification and the release workflow, plus checks for the scoped interface styles and multilingual layouts.

### Compatibility

- Existing settings, including the chosen interface language and lamp state, are preserved. No settings migration is required.
- Focus behavior and the minimum Obsidian version (1.5.0) are unchanged. Reading view remains deliberately unsupported.

[Full comparison](https://github.com/ouatis/obsidian-desklamp/compare/0.4.2...0.4.3)
