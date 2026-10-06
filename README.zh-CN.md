<div align="center">

# Desk Lamp

_房间大灯关掉，只留一盏。_

[English](./README.md) | [日本語](./README.ja.md)

<a href="https://community.obsidian.md/plugins/desklamp"><img src="img/open-in-obsidian-button.svg" alt="在 Obsidian 中打开 Desk Lamp" width="150"></a>

<p>
  <img src="https://img.shields.io/github/v/release/ouatis/obsidian-desklamp?style=flat-square&label=version&color=ad3e32" alt="Latest release">
  <img src="https://img.shields.io/github/downloads/ouatis/obsidian-desklamp/total?style=flat-square&logo=obsidian&logoColor=white&label=downloads&color=d0a85c" alt="Downloads">
  <img src="https://img.shields.io/github/license/ouatis/obsidian-desklamp?style=flat-square&label=license&color=2f6754" alt="MIT License">
</p>

</div>

一款 Obsidian 插件：把你正在写的那一行、那一句、那一段或那一节留下，其余全部调暗。

其余内容退到你设定的不透明度。粒度可以用 frontmatter 单篇指定，范围可以按文件夹限定；含嵌入块、公式、表格的行永远清晰。开关状态跨重启记住，丝带图标随明灭。

> [!NOTE]
> 刻意不支持阅读视图。阅读时没有光标，焦点只能靠上次的位置去猜；而且读文档时把大半篇调暗，只会更难读。这个功能做过、试过、删掉了。

## 安装

需要 Obsidian 1.5.0 或更新版本。

**从 Obsidian 安装**：开启第三方插件后，设置 → 第三方插件 → 浏览，搜「Desk Lamp」即可。条目页在
[community.obsidian.md/plugins/desklamp](https://community.obsidian.md/plugins/desklamp)。

手动安装：从
[最新 release](https://github.com/ouatis/obsidian-desklamp/releases)
下载 `main.js`、`manifest.json` 和 `styles.css`，放进
`<vault>/.obsidian/plugins/desklamp/`，再到 **设置 → 第三方插件** 里启用。

用 [BRAT](https://github.com/thesephist/brats)：把 `ouatis/obsidian-desklamp`
加为插件源（仅对尝鲜未发布版本有用）。

## 特性

- **四档粒度**——行、句、段落（整个软换行段）、小节（到同级下一个标题为止）
- **单篇覆盖**——frontmatter 写 `focus: false` 关闭这一篇；写 `focus: section`
  或 `focus: 小节` 为这一篇单独指定粒度，不影响其他笔记。中文粒度名直接可用：
  `行` / `句` / `段落` / `小节`
- **范围规则**——按文件夹限定、排除指定路径
- **永不调暗**含嵌入块、公式、表格的行
- **多光标**——每个光标各算各的亮区
- **不透明度** 0–1 可调，0–500 ms 过渡尊重 `prefers-reduced-motion`
- **丝带图标**即状态：灭时描边，亮时填充
- 从你之前装过的聚焦插件继承不透明度，切换过来不是一次跳变

### 止于何处

CodeMirror 的行级装饰是**整行粒度**：句粒度点亮的是句子所在的行——一行里三句，就三行全亮。行内切分需要 mark 装饰，但对聚焦工具来说「半句亮、半句暗」读起来很怪。

句切分处理中西文标点，并避开常见的坑：`3.14` 的点、`Mr.` 和 `e.g.` 这类缩写、`J. R.` 这样的姓名首字母，以及把 `...` 当作一个省略号而不是三个句点。

## 命令

- **开 / 关台灯**
- **切换粒度**
- **诊断：为什么没有变暗**

三个命令都在命令面板。默认不占用快捷键——避免与你已有的冲突，需要的话在
Obsidian 的快捷键设置里自行指定。

台灯看似没反应时，跑一下 **诊断：为什么没有变暗**——它把整条链路（总开关、粒度、当前笔记、范围、挂载的编辑器数、实际带装饰类的行数）复制到剪贴板，通知条给出结论。

## 工作原理

Desk Lamp 用 CodeMirror 6 的 `ViewPlugin` 做行级装饰。每次选区变化时从
`EditorState` 算出亮区，可见范围内、亮区之外的行才挂装饰类。

也就是说：没有全局 `<body>` class，没有注入的 `<style>`，也没有 DOM 遍历——每个编辑器实例自持状态，分屏和多窗口天然各管各的。

## 开发

```bash
npm install
npm run dev         # 监听构建
npm run typecheck
npm test            # 49 项引擎测试
npm run build       # 生产构建
npm run test:bundle # 对构建产物跑 17 项冒烟测试
npm run verify      # 以上全部，然后装进仓库实测
```

引擎测试直接从 `src/engine.ts` 导入真实函数，跑在真实的 CodeMirror 状态和真实的
markdown 解析器上，所以测试不会与源码漂移。`test/perf.mjs` 测的是每次按键的代价。

作者 [@ouatis](https://github.com/ouatis)。灵感来自
[Stille](https://github.com/michaellee/stille)。丝带图标出自
[Phosphor Icons](https://phosphoricons.com)。第三方声明见
[NOTICE.md](NOTICE.md)。

界面是英文的，这是 Obsidian 插件的惯例。想要某个功能没有，可以自己加——
插件很小，没有构建负担。
