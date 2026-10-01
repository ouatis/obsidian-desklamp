# 小台灯 · Desk Lamp

房间大灯关掉，只留一盏。

An Obsidian plugin that dims everything except the line, sentence, paragraph,
or section you are working on.

## 与 Stille 的区别

Stille 的做法是往 `<head>` 插一段 CSS，给 `body` 挂一个 class，然后用
`.cm-line:not(.cm-active)` 把非光标行变暗。这个思路有三个绕不过去的限制：

1. **粒度只能是「行」**，因为 `.cm-active` 是 CodeMirror 给光标行打的标记。
2. **CSS 变量写在 `body` 上**，会漏给其他插件和主题。
3. **类挂在全局 `body`**，分屏、多窗口都照顾不到。

小台灯改成用 CodeMirror 6 的 `ViewPlugin` + `Decoration`：从 `EditorState`
算出该亮的行，只给这些行以外的**可见行**挂 decoration class。没有全局 body
class，没有注入的 `<style>` 元素，也没有任何 DOM 遍历。

| | Stille 1.3.4 | 小台灯 |
|---|---|---|
| 粒度 | 行 | 行 / 句 / 段落 / 小节 |
| 范围控制 | 无 | 文件夹、路径排除、frontmatter 单篇覆盖 |
| 阅读视图 | 无效 | 不支持 |
| 多光标 | 无 | 每个光标各自点亮 |
| 多窗口 | 全局一起暗 | 只暗获得焦点的窗口 |
| 嵌入 / 公式 / 表格 | 会被误暗 | 默认豁免 |
| 透明度输入 | 自由文本框，可输入 `NaN` | 滑块 |
| 状态 | 每次启动必定重置 | 持久化 |
| 阅读视图 | 无效 | 不支持 |
| 引擎 | CSS + `.cm-active` | CM6 decoration |

## 功能

- **四档粒度**：行（同 Stille）、句、段落（软换行的整段）、小节（到下一个同级标题）
- **小节级别**可调（1–6），标题可选择保留不暗
- **范围规则**：`onlyPaths` / `exceptPaths`，以及 per-note frontmatter
- **单篇覆盖**：frontmatter 写 `focus: false` 关闭这一篇，或写 `focus: section`（也认 `行` / `句` / `段落` / `小节`）为这一篇单独指定粒度，不影响其他笔记
- **豁免**：含嵌入块、公式、表格的行始终清晰
- **多光标**：每个光标独立计算
- **多窗口**：可只暗获得焦点的窗口
- **过渡动画**：0–500ms 可调，遵循 `prefers-reduced-motion`
- **透明度滑块**，0–1，步进 0.05
- 自动从已安装的 Stille 读取 `unfocusedLevel`，首次运行不跳变

### 粒度的诚实边界

CodeMirror 的行 decoration 是**行粒度**的，所以：

- **句级**点亮的是「句子所在的那些行」。一行里有多句话时，整行都会亮——行内再切分需要字符级 decoration，代价和风险都高得多。

句级对中英文标点都生效，并会避开常见误判：`3.14` 里的点、`Mr.` / `e.g.` 之类的缩写、`J. R.` 这样的首字母缩写，以及把 `...` 当成一个边界。

**不做阅读视图。** 试过，做出来了，然后删掉了：阅读视图没有光标，焦点只能靠猜或靠点；而通读时把大部分内容压暗，只会让文档更难读，不是有助于读。这个功能在 Stille 里也不存在，所以这不算退步。

## 快捷键

| 命令 | 默认键 |
|---|---|
| 开 / 关 | `Ctrl/Cmd + Shift + S` |
| 切换粒度 | `Ctrl/Cmd + Alt + G` |
| 只暗获得焦点的窗口 | `Ctrl/Cmd + Alt + W` |
| 诊断 | 命令面板 |

所有键位都可以在 Obsidian 的「快捷键」设置里改。开 / 关 的状态会被记住，重启后保持。

## 许可与致谢

MIT。灵感来自 [Stille](https://github.com/michaellee/stille)（Michael Lee，MIT，未包含其源码）。图标为 Phosphor Icons 的 "Lamp"（regular），MIT。详见 [LICENSE](LICENSE)。

## 安装

需要 Obsidian 1.5.0 或更高。

**本地开发**：

```bash
npm install
npm run build
```

把 `main.js`、`manifest.json`、`styles.css` 三个文件复制到
`<vault>/.obsidian/plugins/desklamp/`，然后在
「设置 → 第三方插件」里启用。

## 开发

```bash
npm run dev         # watch 模式
npm run typecheck   # 仅类型检查
npm test            # 引擎逻辑测试（21 项）
npm run build       # 生产构建
npm run test:bundle # 对构建产物做冒烟测试
npm run verify      # 以上全部
```

测试直接调用 `src/engine.ts` 里导出的真实函数，用真实的 CodeMirror 状态和
真实的 markdown 解析器跑，不重新实现一遍逻辑，所以测试不会和源码脱节。
