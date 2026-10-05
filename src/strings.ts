/*
 * UI strings.
 *
 * English is the default. Chinese and Japanese are selectable in the
 * settings; the choice is remembered in the vault's data.json.
 *
 * Note for contributors: keep examples generic. Do not put real vault
 * paths, note names or project names in placeholder text — this file
 * ships inside a public release.
 *
 * Chinese granularity names stay accepted in frontmatter regardless of
 * the UI language (see readFocusOverride in engine.ts).
 */

export type Lang = "en" | "zh" | "ja";

export const LANGUAGES: Array<{ id: Lang; label: string; flag: string }> = [
  { id: "en", label: "English", flag: "🇬🇧" },
  { id: "zh", label: "中文", flag: "🇨🇳" },
  { id: "ja", label: "日本語", flag: "🇯🇵" },
];

export const DEFAULT_LANG: Lang = "en";

const en = {
  pluginName: "Desk Lamp",

  languageName: "Language",
  languageDesc:
    "Language for the settings and the status bar. Frontmatter accepts the English names (line / sentence / paragraph / section) in any language; the Chinese and Japanese ones work too.",
  tagline: "Room lights off, one lamp left on.",

  sectionScope: "Scope",
  sectionStatusBar: "Status bar",

  cmdToggle: "Turn the lamp on / off",
  cmdCycle: "Cycle granularity: line → sentence → paragraph → section",
  cmdDiagnose: "Diagnose: why is nothing dimmed",

  toggleName: "Lamp",
  toggleDesc: "Master switch. Off stops the engine entirely.",

  granularityName: "Granularity",
  granularityDesc:
    "Line lights the caret's own line. Sentence lights the lines holding the current sentence. Paragraph is the whole soft-wrapped paragraph. Section runs to the next heading of the same level.",

  opacityName: "Opacity of unfocused text",
  opacityDesc: "0 = black, 1 = no dimming.",

  sectionLevelName: "Heading level that starts a section",
  sectionLevelDesc: "A heading at or above this level opens a new section.",

  keepHeadingName: "Keep the current heading lit",
  keepHeadingDesc: "The heading that governs the caret stays undimmed.",

  exemptRichName: "Never dim: embeds, math, tables",
  exemptRichDesc: "Lines holding an embed, formula or table stay legible.",

  transitionName: "Transition (ms)",
  transitionDesc: "0 disables the fade.",

  dimTitleName: "Dim the note title",
  dimTitleDesc: "Dims the note title and the tab title as well.",

  onlyPathsName: "Only these paths",
  onlyPathsDesc:
    "One folder or file per line; empty means every note. Example: novels/ drafts/",

  exceptPathsName: "Never dim these paths",
  exceptPathsDesc: "Takes priority over the list above.",

  frontmatterKeyName: "Frontmatter key",
  frontmatterKeyDesc:
    "Per-note override. focus: false switches a note off; focus: section pins its granularity. Blank ignores the key.",

  showStatusBar: "Show the status bar item",
  statusTextName: "Status bar text",

  gLine: "line",
  gSentence: "sentence",
  gParagraph: "paragraph",
  gSection: "section",

  on: "on",
  off: "off",
  perNote: "(this note)",
  notOn: "not on",

  noticeMigrated:
    "Desk Lamp: kept the opacity from your previous focus plugin. Change it in settings.",
  ribbonOn: "Desk Lamp: on — click to switch off",
  ribbonOff: "Desk Lamp: off — click to switch on",
};

type Dict = typeof en;

const zh: Dict = {
  pluginName: "Desk Lamp",

  languageName: "界面语言",
  languageDesc:
    "设置页和状态栏使用的语言。frontmatter 里的中文粒度名（行 / 句 / 段落 / 小节）在任何语言下都有效。",
  tagline: "房间大灯关掉，只留一盏。",

  sectionScope: "范围",
  sectionStatusBar: "状态栏",

  cmdToggle: "开 / 关台灯",
  cmdCycle: "切换粒度：行 → 句 → 段落 → 小节",
  cmdDiagnose: "诊断：为什么没有变暗",

  toggleName: "台灯开关",
  toggleDesc: "总开关。关闭时引擎完全停止计算。",

  granularityName: "聚焦粒度",
  granularityDesc:
    "行只点亮光标所在行；句会点亮当前句子所在的行；段落是软换行的整段；小节延伸到下一个同级标题。",

  opacityName: "未聚焦文字的透明度",
  opacityDesc: "0 = 全黑，1 = 不变暗。",

  sectionLevelName: "开启小节的标题级别",
  sectionLevelDesc: "级别小于等于此值的标题会开启新的一节。",

  keepHeadingName: "保留当前标题",
  keepHeadingDesc: "管辖光标的那个标题行不会被变暗。",

  exemptRichName: "始终清晰：嵌入 / 公式 / 表格",
  exemptRichDesc: "含嵌入块、公式或表格的行不会被变暗。",

  transitionName: "过渡时长（毫秒）",
  transitionDesc: "0 表示不做淡入淡出。",

  dimTitleName: "同时暗掉标题",
  dimTitleDesc: "笔记标题与标签页标题一并变暗。",

  onlyPathsName: "只对这些路径生效",
  onlyPathsDesc: "每行一个文件夹或文件，留空表示全部笔记。例：novels/ drafts/",

  exceptPathsName: "这些路径永不生效",
  exceptPathsDesc: "优先级高于上面的列表。",

  frontmatterKeyName: "Frontmatter 字段名",
  frontmatterKeyDesc:
    "单篇覆盖。focus: false 关闭这一篇；focus: section 固定这一篇的粒度。留空则忽略该字段。",

  showStatusBar: "显示状态栏",
  statusTextName: "状态栏文字",

  gLine: "行",
  gSentence: "句",
  gParagraph: "段落",
  gSection: "小节",

  on: "开",
  off: "关",
  perNote: "（本篇）",
  notOn: "未开启",

  noticeMigrated: "Desk Lamp：已沿用你原来使用的透明度设置，可在设置中调整。",
  ribbonOn: "Desk Lamp：已开启，点击关闭",
  ribbonOff: "Desk Lamp：已关闭，点击开启",
};

const ja: Dict = {
  pluginName: "Desk Lamp",

  languageName: "表示言語",
  languageDesc:
    "設定画面とステータスバーで使う言語。frontmatter には英語名（line / sentence / paragraph / section）か中国語名を書けます。",
  tagline: "主灯を消して、小灯を一つだけ。",

  sectionScope: "適用範囲",
  sectionStatusBar: "ステータスバー",

  cmdToggle: "ランプをオン / オフ",
  cmdCycle: "粒度を切替：行 → センテンス → 段落 → 小節",
  cmdDiagnose: "診断：なぜ暗くならないのか",

  toggleName: "ランプ",
  toggleDesc: "メインスイッチ。オフならエンジンはまったく計算しません。",

  granularityName: "粒度",
  granularityDesc:
    "行はカーソルのある行だけ。センテンスは現在の文のある行を点けます。段落はソフトラップされた段落全体。小節は同レベルの見出しまで。",

  opacityName: "非フォーカス部分の不透明度",
  opacityDesc: "0 は真っ黒、1 は暗くしません。",

  sectionLevelName: "小節を始める見出しレベル",
  sectionLevelDesc: "このレベル以下の見出しが新しい小節を開きます。",

  keepHeadingName: "現在の見出しを明るく保つ",
  keepHeadingDesc: "カーソル位置を管轄する見出し行は暗くしません。",

  exemptRichName: "暗くしない：埋め込み / 数式 / 表",
  exemptRichDesc: "埋め込み・数式・表を含む行は読みやすく保ちます。",

  transitionName: "遷移時間（ミリ秒）",
  transitionDesc: "0 でフェードなし。",

  dimTitleName: "ノートタイトルも暗くする",
  dimTitleDesc: "ノートタイトルとタブタイトルも暗くします。",

  onlyPathsName: "このパスだけに適用",
  onlyPathsDesc:
    "1 行につき 1 つのフォルダまたはファイル。空なら全ノート。例：novels/ drafts/",

  exceptPathsName: "このパスは絶対に暗くしない",
  exceptPathsDesc: "上のリストより優先されます。",

  frontmatterKeyName: "frontmatter のキー",
  frontmatterKeyDesc:
    "ノートごとの上書き。focus: false でそのノートを無効に、focus: section で粒度を固定。空なら無視。",

  showStatusBar: "ステータスバーに表示",
  statusTextName: "ステータスバーの文字",

  gLine: "行",
  gSentence: "センテンス",
  gParagraph: "段落",
  gSection: "小節",

  on: "オン",
  off: "オフ",
  perNote: "（このノート）",
  notOn: "消灯",

  noticeMigrated:
    "Desk Lamp：以前のフォーカスプラグインの不透明度を引き継ぎました。設定で変更できます。",
  ribbonOn: "Desk Lamp：オン（クリックでオフ）",
  ribbonOff: "Desk Lamp：オフ（クリックでオン）",
};

export const DICTS: Record<Lang, Dict> = { en, zh, ja };

export function dict(lang: Lang): Dict {
  return DICTS[lang] ?? DICTS[DEFAULT_LANG];
}
