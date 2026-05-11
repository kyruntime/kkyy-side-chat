# AGENTS.md

这是 SideChat VS Code/Cursor 扩展项目的 agent 工作说明。新窗口或新会话进入本仓库后，应先阅读本文件，再根据任务继续阅读相关文档。

## 项目概览

- SideChat 是一个 Cursor 侧栏聊天面板，通过 MCP 和 Cursor Agent 通信。
- 扩展源码在 `src/`，运行入口是编译后的 `dist/extension.js`。
- `src/extension.js` 负责 VS Code 扩展激活、webview 初始化、工作区 MCP 配置、消息队列写入。
- `src/session.js` 负责会话顺序、草稿、备忘、运行状态，以及 `~/.cursor/sidechat-messages` 下的队列路径。
- `src/webview-html.js`、`src/webview-css.js`、`src/webview-script.js` 负责侧栏 UI。
- `mcp-server/index.mjs` 是 Cursor 使用的独立 MCP stdio server，会直接打进 VSIX，不经过 `tsc` 编译。
- `resources/icon.svg` 是 activity bar 图标。

## 构建注意事项

- 修改 `src/` 后必须运行 `npm run compile`，因为扩展实际加载的是 `dist/`。
- 修改 `mcp-server/index.mjs` 后必须运行 `node --check mcp-server/index.mjs`。
- `npm run package` 会通过 `vsce package --no-dependencies` 生成 VSIX。
- `.gitignore` 默认忽略 VSIX 文件，但正式发布产物需要用 `git add -f` 强制提交。

## 发布流程入口

当用户说以下任意表达时：

- “部署发布”
- “编译打包发布”
- “发一个新版本”
- “release”
- “publish”

必须先阅读 `发布检测部署.md`，再按里面的完整发布清单执行。

默认完整发布包括：

1. 检查 git 状态、远端、当前分支和 `gh auth status`。
2. 递增 patch 版本号，除非用户指定其它版本号。
3. 编译并校验。
4. 打包并重命名 VSIX：`sidechat-<version>-<YYYYMMDD>.vsix`。
5. 校验 VSIX 元数据和 SHA256。
6. 提交源码和版本号改动。
7. 强制加入并提交 VSIX 产物。
8. 在包含 VSIX 的提交上创建 annotated tag：`v<version>`。
9. 推送 `main` 和 tag。
10. 创建 GitHub Release，上传 VSIX asset，并标记为 latest。
11. 回报 commit hash、tag、Release URL、VSIX 下载 URL 和 SHA256。

如果工作区有混杂改动或不属于本次发布的改动，必须先停下来确认提交范围，不能静默一起提交。

## Git 安全规则

- 除非用户明确要求，否则不要执行破坏性 git 命令。
- 不要把无关本地改动静默混入 release。
- 优先使用显式路径 `git add <paths>`，不要默认 `git add -A`。
- release tag 必须和对应版本的 VSIX 产物提交保持一致。
