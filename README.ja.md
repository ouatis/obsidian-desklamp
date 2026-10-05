<div align="center">

# Desk Lamp

_部屋の灯りを消して、一つだけ残す。_

[English](./README.md) | [中文](./README.zh-CN.md)

<a href="https://community.obsidian.md/plugins/desklamp"><img src="img/open-in-obsidian-button.svg" alt="Obsidian で Desk Lamp を開く" width="150"></a>

<p>
  <img src="https://img.shields.io/github/v/release/ouatis/obsidian-desklamp?style=flat-square&label=version&color=c24e24" alt="Latest release">
  <img src="https://img.shields.io/github/downloads/ouatis/obsidian-desklamp/total?style=flat-square&logo=obsidian&logoColor=white&label=downloads&color=e3a33b" alt="Downloads">
  <img src="https://img.shields.io/github/license/ouatis/obsidian-desklamp?style=flat-square&label=license&color=406e40" alt="MIT License">
</p>

</div>

書いている行・文・段落・節だけを残し、それ以外はすべて薄暗くする Obsidian プラグイン。

それ以外の部分は設定した不透明度に沈みます。粒度は frontmatter でノート単位に固定でき、適用範囲はフォルダで絞り込めます。埋め込み・数式・表を含む行は決して暗くなりません。オン/オフの状態は再起動後も保持され、リボンのアイコンがそれを示します。

> [!NOTE]
> 閲覧ビューは意図的に非対応です。閲覧時にはカーソルがないため、フォーカスは前回の位置からの推測になりますし、読んでいる文書の大部分を暗くしては読みにくくなるだけです。この機能は実装し、試し、削除しました。

## インストール

Obsidian 1.5.0 以降が必要です。

**Obsidian から**：コミュニティプラグインを有効にし、**設定 → コミュニティプラグイン → 参照**で「Desk Lamp」を検索。掲載ページは
[community.obsidian.md/plugins/desklamp](https://community.obsidian.md/plugins/desklamp)。

手動の場合：[最新リリース](https://github.com/ouatis/obsidian-desklamp/releases)から
`main.js`・`manifest.json`・`styles.css` をダウンロードし、
`<vault>/.obsidian/plugins/desklamp/` に入れて、**設定 → コミュニティプラグイン**で有効化します。

[BRAT](https://github.com/thesephist/brats) を使う場合：`ouatis/obsidian-desklamp`
をプラグインソースに追加してください（未リリース版の試用専用です）。

## 特徴

- **4 段階の粒度**——行、センテンス、段落（ソフトラップ全体）、小節（同レベルの次の見出しまで）
- **ノート単位の上書き**——frontmatter の `focus: false` でそのノートをオフ。`focus: section`
  や `focus: 小節` でそのノートだけ粒度を固定。中国語の粒度名もそのまま使えます：
  `行` / `句` / `段落` / `小节`
- **適用範囲ルール**——特定フォルダに限定、特定パスを除外
- **決して暗くしない**——埋め込み・数式・表を含む行
- **マルチカーソル**——カーソルごとに独立して点灯範囲を計算
- **不透明度スライダー** 0–1、0–500 ms の遷移は `prefers-reduced-motion` を尊重
- **リボンアイコン**が状態を示す：オフでアウトライン、オンで塗りつぶし
- 以前使っていたフォーカス系プラグインから不透明度を引き継ぐので、乗り換えが段差になりません

### 限界

CodeMirror の行デコレーションは**行単位**です。センテンス粒度では、文がまたぐ行全体が点灯します——1 行に 3 文あれば 3 行とも点灯。行内で分割するには mark デコレーションが必要ですが、フォーカスツールで「半分だけ明るい行」は読みにくいため採用していません。

文の分割は CJK と西洋の句読点を扱い、よくある落とし穴を避けます：`3.14` のピリオド、`Mr.` や `e.g.` の略称、`J. R.` のような頭文字、そして `...` は 3 つのピリオドではなく 1 つの省略符として扱います。

## コマンド

- **ランプをオン / オフ**
- **粒度を切替**
- **診断：なぜ暗くならないのか**

3 つすべてコマンドパレットにあります。デフォルトのホットキーは設定していません——既存のホットキーとの衝突を避けるためです。必要なら Obsidian のホットキー設定で割り当ててください。

ランプが何もしないように見えるときは **診断：なぜ暗くならないのか** を実行してください——スイッチ・粒度・ノート・適用範囲・接続中のエディタ・実際に装飾クラスの付いた行数という判定の連鎖をクリップボードにコピーし、通知で結論を示します。

## 仕組み

Desk Lamp は CodeMirror 6 の `ViewPlugin` で行デコレーションを行います。点灯範囲は選択範囲が変わるたびに `EditorState` から計算され、装飾クラスが付くのは*可視範囲内*の点灯範囲外の行だけです。

つまり、グローバルな `<body>` クラスも、注入された `<style>` 要素も、DOM 走査もありません——各エディタが自分の状態を持つため、分割ペインや複数ウィンドウでもエディタ単位で正しく動きます。

## 開発

```bash
npm install
npm run dev         # ウォッチビルド
npm run typecheck
npm test            # 49 個のエンジン テスト
npm run build       # 本番ビルド
npm run test:bundle # ビルド成果物に対する 17 個のスモークテスト
npm run verify      # 以上すべて、その後に vault へインストール
```

エンジンのテストは `src/engine.ts` から実際の関数をインポートし、実際の CodeMirror
の状態と実際の markdown パーサーに対して実行します。そのためテストがソースから逸脱することはありません。`test/perf.mjs` は 1 キーストロークあたりのコストを測ります。

作者 [@ouatis](https://github.com/ouatis)。インスピレーション:
[Stille](https://github.com/michaellee/stille)。リボンアイコン:
[Phosphor Icons](https://phosphoricons.com)。サードパーティ表記:
[NOTICE.md](NOTICE.md)。

この日本語 README は機械翻訳を整えたものです。母語話者による修正を歓迎します。
