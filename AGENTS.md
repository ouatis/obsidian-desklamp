# AGENTS.md

给在这台机器上干活的 AI Agent(以及偶尔失忆的人类)。

## 这是什么

Desk Lamp——Obsidian 插件:把你正在工作的行/句/段/节以外的一切调暗。
已进入官方社区插件库(community.obsidian.md/plugins/desklamp)。

## 构建与验证

```bash
npm run verify   # 全链:typecheck → engine 测试 → install:vault → build → bundle 冒烟
npm run dev      # esbuild watch
```

CI 的 verify 作业跑同一条链(外加性能探针),并以 `needs: verify` 把守
release 作业——**verify 不过,发版不启动**。别绕过它。

## 地图

- `src/engine.ts` —— 调暗逻辑本体(纯函数,`test/engine.test.mjs` 单测)。
- `src/main.ts` —— Obsidian 接线(编辑器装饰、ribbon、设置)。
- `src/strings.ts` —— 多语言 UI 字符串。
- `test/bundle.smoke.cjs` —— 在假 vault 里加载构建产物做冒烟
  (`scripts/install-vault.mjs` 负责把插件装进 vault;CI 用 `JY_VAULT`
  指向伪 vault,本地默认装进作者的 vault)。
- `manifest.json` —— id `desklamp`;`isDesktopOnly: false`。

## 约定

- **阅读视图刻意不支持**:那里没有光标,焦点只能靠猜;边读边调暗只会
  更难读。不要"修"它。
- README 三语(en / README.zh-CN.md / README.ja.md)——改动同步三份。
- 发布 = 打标签(release.yml 构建并挂 dist/ 三件套)。
- esbuild 产物经 minify:属性引号会被剥、逗号会变空格——对构建产物的
  任何 grep 必须引号与顺序无关。
