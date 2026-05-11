"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const os = require("os");
const child_process_1 = require("child_process");
const cleanup_1 = require("./cleanup");
const { VIEW_ID, BRAND_TITLE, MCP_SERVER_PREFIX, MANAGED_RULE_FILE_NAME, MANAGED_MCP_KEY, GLOBAL_STATE_SESSION_KEY, GLOBAL_STATE_SESSION_ORDER_KEY, GLOBAL_STATE_SESSION_MEMOS_KEY, GLOBAL_STATE_DRAFTS_KEY, GLOBAL_STATE_LAST_WORKSPACE_PATH_KEY, GLOBAL_STATE_PRESETS_KEY, MAX_SESSION_MEMO_CHARS, } = require("./constants");
const session = require("./session");
const { setActiveWorkspace, normalizeSessionOrder, readSessionOrder, readSessionMemos, readSessionDrafts, readLastWorkspacePath, rememberManagedWorkspace, serializePersistedSessionHistories, clearPersistedSessionArtifacts, clearSessionQueueDir, readSessionRuntimeSnapshot, ensureRuntimeConfig, primeSessionRuntimeState, markSessionQueued, isValidSessionId, } = session;
const webview_html_1 = require("./webview-html");
const viewType = VIEW_ID;
console.log(`[${viewType}] module loaded`);
/** Windows：侧栏 Webview 内无法使用浏览器 Speech API 的麦克风，改用系统语音识别（PowerShell + System.Speech） */
const WIN_VOICE_PS_SCRIPT = `
$ErrorActionPreference = 'Stop'
try {
  Add-Type -AssemblyName System.Speech | Out-Null
  $zh = [System.Globalization.CultureInfo]::new('zh-CN')
  $e = $null
  try { $e = New-Object System.Speech.Recognition.SpeechRecognitionEngine($zh) } catch { $e = New-Object System.Speech.Recognition.SpeechRecognitionEngine }
  $e.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
  $e.SetInputToDefaultAudioDevice()
  $res = $e.Recognize()
  if (-not $res -or -not $res.Text) { exit 2 }
  $b = [System.Text.Encoding]::UTF8.GetBytes($res.Text)
  [Console]::Out.Write([Convert]::ToBase64String($b))
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
`.trim();
function encodePowerShellCommandBody(body) {
    return Buffer.from(body, "utf16le").toString("base64");
}
function recognizeSpeechWindows(timeoutMs) {
    return new Promise((resolve) => {
        const sysRoot = process.env.SystemRoot || "C:\\Windows";
        const psExe = path.join(sysRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
        const encoded = encodePowerShellCommandBody(WIN_VOICE_PS_SCRIPT);
        const ps = (0, child_process_1.spawn)(psExe, ["-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded], {
            windowsHide: true,
        });
        const outChunks = [];
        let stderr = "";
        ps.stdout.on("data", (d) => {
            outChunks.push(Buffer.from(d));
        });
        ps.stderr.on("data", (d) => {
            stderr += d.toString("utf8");
        });
        const timer = setTimeout(() => {
            try {
                ps.kill();
            }
            catch {
                // ignore
            }
        }, timeoutMs);
        ps.on("close", (code) => {
            clearTimeout(timer);
            const stdout = Buffer.concat(outChunks).toString("utf8");
            const b64 = stdout.replace(/\s+/g, "").trim();
            if (code === 0 && b64.length > 0) {
                try {
                    const text = Buffer.from(b64, "base64").toString("utf8");
                    resolve({ ok: true, text });
                }
                catch {
                    resolve({ ok: false, err: "无法解析识别结果" });
                }
                return;
            }
            if (code === 2) {
                resolve({ ok: false, err: "未识别到有效语句，请重试并靠近麦克风说话" });
                return;
            }
            const errLine = stderr.trim() || (code != null ? `识别进程退出码 ${code}` : "识别失败");
            resolve({ ok: false, err: errLine });
        });
        ps.on("error", (e) => {
            clearTimeout(timer);
            resolve({ ok: false, err: String(e) });
        });
    });
}
function activate(context) {
    console.log(`[${viewType}] activate() called`);
    // 配置工作区命令：接收目标路径参数
    context.subscriptions.push(vscode.commands.registerCommand(`${VIEW_ID}.configureWorkspace`, async (targetPath, sessionOrderOverride) => {
        // 如果没有传入路径，使用当前工作区
        let workspacePath = targetPath;
        if (!workspacePath) {
            const folder = vscode.workspace.workspaceFolders?.[0];
            if (!folder) {
                throw new Error("请先选择或打开一个工作区文件夹");
            }
            workspacePath = folder.uri.fsPath;
        }
        // 验证路径存在
        if (!fs.existsSync(workspacePath)) {
            throw new Error(`路径不存在：${workspacePath}`);
        }
        const srcDir = path.join(context.extensionPath, "mcp-server");
        const destDir = path.join(os.homedir(), ".cursor", "sidechat-server");
        const copyDir = (src, dest) => {
            if (!fs.existsSync(dest))
                fs.mkdirSync(dest, { recursive: true });
            for (const name of fs.readdirSync(src)) {
                if (name === "node_modules")
                    continue; // 跳过 node_modules
                const s = path.join(src, name);
                const d = path.join(dest, name);
                if (fs.statSync(s).isDirectory())
                    copyDir(s, d);
                else
                    fs.copyFileSync(s, d);
            }
        };
        copyDir(srcDir, destDir);
        const nodeModules = path.join(destDir, "node_modules");
        if (!fs.existsSync(nodeModules)) {
            (0, child_process_1.execSync)("npm install", { cwd: destDir, stdio: "inherit" });
        }
        const cursorDir = path.join(workspacePath, ".cursor");
        const mcpPath = path.join(cursorDir, "mcp.json");
        const mcpServerPath = path.join(destDir, "index.mjs");
        let mcpServers = {};
        if (fs.existsSync(mcpPath)) {
            try {
                const raw = fs.readFileSync(mcpPath, "utf-8");
                const existing = JSON.parse(raw);
                mcpServers = existing.mcpServers ?? {};
            }
            catch {
                mcpServers = {};
            }
        }
        const mcpServerPathNorm = mcpServerPath.replace(/\\/g, "/");
        delete mcpServers[MCP_SERVER_PREFIX];
        for (const key of Object.keys(mcpServers)) {
            if (MANAGED_MCP_KEY.test(key)) {
                delete mcpServers[key];
            }
        }
        let order;
        if (Array.isArray(sessionOrderOverride) && sessionOrderOverride.length > 0) {
            order = normalizeSessionOrder(sessionOrderOverride);
            if (order.length === 0) {
                order = readSessionOrder(context);
            }
        }
        else {
            order = readSessionOrder(context);
        }
        if (order.length === 0) {
            throw new Error("会话列表为空，请先在侧栏至少保留一路会话");
        }
        setActiveWorkspace(workspacePath);
        void context.workspaceState.update(GLOBAL_STATE_LAST_WORKSPACE_PATH_KEY, workspacePath);
        ensureRuntimeConfig();
        void context.workspaceState.update(GLOBAL_STATE_SESSION_ORDER_KEY, order);
        for (const id of order) {
            mcpServers[`${MCP_SERVER_PREFIX}-${id}`] = {
                command: "node",
                args: [mcpServerPathNorm, "--workspace", workspacePath],
                env: { SIDECHAT_SESSION: id },
                disabled: false,
            };
            primeSessionRuntimeState(id);
        }
        if (!fs.existsSync(cursorDir)) {
            fs.mkdirSync(cursorDir, { recursive: true });
        }
        fs.writeFileSync(mcpPath, JSON.stringify({ mcpServers }, null, 2), "utf-8");
        // 写入规则文件，让 Cursor 持续调用 check_messages
        const rulesDir = path.join(cursorDir, "rules");
        if (!fs.existsSync(rulesDir)) {
            fs.mkdirSync(rulesDir, { recursive: true });
        }
        const rulePath = path.join(rulesDir, MANAGED_RULE_FILE_NAME);
        const ruleContent = `---
description: 先正常回复用户，再持续调用 check_messages 保持通道在线；keepalive 时禁止输出任何自然语言
globs:
alwaysApply: true
---

# ${BRAND_TITLE} 多会话规则

你当前所在的 Cursor 对话窗口，只会绑定一个通道：\`${MCP_SERVER_PREFIX}-N\`。  
侧栏点击 **「开始配置」** 后，会把**当前侧栏会话列表**写入本工作区的 \`.cursor/mcp.json\`。  
如果侧栏增删了会话，**必须重新配置一次**，否则 Cursor 里的 MCP 列表会和侧栏不一致。

## 目标

让用户感觉这就是一个持续在线的正常对话，而不是“每轮都重新启动一次工具”。

## 绝对优先级

1. **先回答用户，再谈工具。**  
   用户说什么，就先像正常聊天一样回答什么。  
   不要用「工具正常」「通道已验证」「我在监听」来代替真正回复。

2. **用户可见内容只写在 Cursor 对话窗口。**  
   默认不要传 \`reply\`，除非你明确需要把一小段结果镜像回插件。

3. **每轮完成后，下一步只能是继续调用 \`check_messages()\`。**  
   回完用户以后，不要再补任何过渡句、陪聊句、结束语。  
   允许的下一步只有：继续调用当前通道的 \`check_messages()\`。

## keepalive 规则

- 工具默认会长轮询等待约 30 分钟，期间内部会持续检查新消息。
- 如果这段时间没有新消息，工具可能返回以 **[KEEPALIVE_ONLY]** 或 **[NO_MESSAGE_CONTINUE]** 开头的文本。  
- 这两种返回都表示：**当前没有新消息，但通道还活着。**

### 遇到 keepalive 时你必须这样做

1. **不要输出任何自然语言给用户**
2. **不要解释你在等待**
3. **不要说“我在”“继续说”“随时叫我”“我会继续监听”**
4. **直接再次调用 \`check_messages()\`**

## 多条消息规则

- 插件侧可能一次只推送一条消息。  
- 如果用户连续发了多条，它们会分多次送达。  
- 你要逐条处理，每处理完一条就继续下一轮 \`check_messages()\`。

## 禁止事项

- ❌ 用工具状态代替对用户问题的真实回答
- ❌ 长篇解释 MCP / 插件 / 通道原理
- ❌ 回完用户后停住不再调用 \`check_messages()\`
- ❌ 把 keepalive 文本转述给用户
- ❌ 在没有新消息时输出任何“陪伴型”废话

## 标准流程

\`\`\`
check_messages()
  -> 收到用户新消息
  -> 在 Cursor 正常回复用户
  -> 立刻再次调用 check_messages()
  -> 若返回 KEEPALIVE_ONLY / NO_MESSAGE_CONTINUE，则不说话，直接继续 check_messages()
\`\`\`

## 最小示例

- 用户发来「你好」
  正确：回复一句正常问候，然后继续调用 \`check_messages()\`
  错误：回复「通道正常」「我会继续监听」

- 工具返回 \`[KEEPALIVE_ONLY]\`
  正确：什么都不说，直接继续调用 \`check_messages()\`
  错误：回复「我在」「继续说」「我会一直等你」
`;
        fs.writeFileSync(rulePath, ruleContent, "utf-8");
        rememberManagedWorkspace(workspacePath);
        return { mcpPath, rulePath, destDir, workspacePath, sessionIds: order };
    }));
    context.subscriptions.push(vscode.commands.registerCommand("sideChat.cleanupArtifacts", async () => {
        const confirm = await vscode.window.showWarningMessage("这会清理 SideChat 在本机和已登记工作区留下的文件，包括 ~/.cursor/sidechat-*、工作区 .cursor/mcp.json 中的 sidechat-* 项、规则文件，以及本地草稿/备忘状态。", { modal: true }, "继续清理");
        if (confirm !== "继续清理")
            return;
        const removedItems = (0, cleanup_1.cleanupSideChatArtifacts)();
        const detail = removedItems.length > 0
            ? `已清理 ${removedItems.length} 项 SideChat 文件/状态。现在可以卸载扩展，并完全退出后重新打开 Cursor 确认结果。`
            : "没有发现可清理的 SideChat 文件/状态。若你准备卸载扩展，仍建议完全退出后重新打开 Cursor 再确认。";
        void vscode.window.showInformationMessage(detail);
        return { ok: true, removedItems, detail };
    }));
    const provider = {
        resolveWebviewView(webviewView) {
            console.log(`[${viewType}] resolveWebviewView() called`);
            webviewView.webview.options = {
                enableScripts: true,
                localResourceRoots: [context.extensionUri],
            };
            const nonce = (0, webview_html_1.getNonce)();
            const extVer = String(context.extension.packageJSON.version ?? "");
            webviewView.webview.html = (0, webview_html_1.getHtml)(webviewView.webview, nonce, extVer);
            const lastReplyBySession = {};
            const pollIntervalMs = 800;
            const intervalId = setInterval(() => {
                const polledSessionIds = readSessionOrder(context);
                for (const sid of polledSessionIds) {
                    try {
                        const replyPath = path.join(session.MESSAGE_QUEUE_ROOT_DIR, "s", sid, "reply.json");
                        if (!fs.existsSync(replyPath))
                            continue;
                        const raw = fs.readFileSync(replyPath, "utf-8");
                        const parsed = JSON.parse(raw);
                        const ts = String(parsed.timestamp ?? "");
                        if (!ts || ts === lastReplyBySession[sid])
                            continue;
                        lastReplyBySession[sid] = ts;
                        const reply = String(parsed.reply ?? "");
                        const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
                        webviewView.webview.postMessage({
                            command: "cursorReply",
                            reply,
                            suggestions,
                            time: ts,
                            sessionId: sid,
                        });
                        try {
                            fs.unlinkSync(replyPath);
                        }
                        catch {
                            // ignore
                        }
                    }
                    catch {
                        // ignore
                    }
                    try {
                        const snapshot = readSessionRuntimeSnapshot(sid);
                        if (snapshot) {
                            webviewView.webview.postMessage({
                                command: "sessionRuntimeStatus",
                                payload: snapshot,
                            });
                        }
                    }
                    catch {
                        // ignore
                    }
                }
            }, pollIntervalMs);
            const sessionOrder = readSessionOrder(context);
            const savedWorkspacePath = readLastWorkspacePath(context);
            if (savedWorkspacePath) {
                setActiveWorkspace(savedWorkspacePath);
            }
            setTimeout(() => {
                webviewView.webview.postMessage({ command: "restoreSessionOrder", order: sessionOrder });
                webviewView.webview.postMessage({ command: "restoreSessionMemos", memos: readSessionMemos(context) });
                webviewView.webview.postMessage({ command: "restoreWorkspacePath", path: savedWorkspacePath });
                webviewView.webview.postMessage({ command: "restoreDrafts", drafts: readSessionDrafts(context) });
                const savedPresets = context.workspaceState.get(GLOBAL_STATE_PRESETS_KEY);
                if (savedPresets && typeof savedPresets === "object") {
                    webviewView.webview.postMessage({ command: "restorePresets", presets: savedPresets });
                }
            }, 50);
            const savedHist = serializePersistedSessionHistories(context.workspaceState.get(GLOBAL_STATE_SESSION_KEY));
            if (savedHist !== "{}") {
                setTimeout(() => {
                    webviewView.webview.postMessage({ command: "restoreHistories", payload: savedHist });
                }, 100);
            }
            // Auto-configure MCP when sidebar opens if workspace folder is available
            setTimeout(async () => {
                const autoFolder = vscode.workspace.workspaceFolders?.[0];
                if (!autoFolder)
                    return;
                const autoPath = autoFolder.uri.fsPath;
                try {
                    const result = await vscode.commands.executeCommand(`${VIEW_ID}.configureWorkspace`, autoPath, sessionOrder);
                    if (typeof result?.workspacePath === "string" && result.workspacePath.trim()) {
                        await context.workspaceState.update(GLOBAL_STATE_LAST_WORKSPACE_PATH_KEY, result.workspacePath.trim());
                        setActiveWorkspace(result.workspacePath.trim());
                    }
                    webviewView.webview.postMessage({
                        command: "configResult",
                        ok: true,
                        msg: `已自动配置工作区：${result?.workspacePath}`,
                        workspacePath: result?.workspacePath,
                        silent: true,
                    });
                }
                catch (e) {
                    webviewView.webview.postMessage({
                        command: "configResult",
                        ok: false,
                        msg: String(e),
                    });
                }
            }, 200);
            const disposable = webviewView.webview.onDidReceiveMessage(async (message) => {
                if (!message || typeof message !== "object")
                    return;
                const cmd = message.command;
                const cmdStr = typeof cmd === "string" ? cmd : "";
                // 选择文件夹
                if (cmd === "selectFolder") {
                    try {
                        const result = await vscode.window.showOpenDialog({
                            canSelectFiles: false,
                            canSelectFolders: true,
                            canSelectMany: false,
                            openLabel: "选择工作区",
                            title: "选择要配置 MCP 的工作区文件夹",
                        });
                        if (result && result.length > 0) {
                            const selectedPath = result[0].fsPath;
                            webviewView.webview.postMessage({
                                command: "folderSelected",
                                path: selectedPath,
                            });
                        }
                    }
                    catch (e) {
                        webviewView.webview.postMessage({
                            command: "folderSelected",
                            path: null,
                            error: String(e),
                        });
                    }
                    return;
                }
                /** 将当前窗口打开的工作区根路径填回侧栏输入框 */
                if (cmd === "requestCurrentWorkspace") {
                    const folder = vscode.workspace.workspaceFolders?.[0];
                    if (folder) {
                        void context.workspaceState.update(GLOBAL_STATE_LAST_WORKSPACE_PATH_KEY, folder.uri.fsPath);
                        webviewView.webview.postMessage({
                            command: "folderSelected",
                            path: folder.uri.fsPath,
                            fromCurrentWorkspace: true,
                        });
                    }
                    else {
                        webviewView.webview.postMessage({
                            command: "folderSelected",
                            path: null,
                            error: "当前没有打开工作区，请先用「文件 → 打开文件夹」打开一个项目",
                        });
                    }
                    return;
                }
                // 配置工作区（带路径参数）
                if (cmd === "configureWorkspace") {
                    const targetPath = message.path;
                    const orderRaw = message.sessionOrder;
                    const orderFromUi = Array.isArray(orderRaw) ? orderRaw.map((x) => String(x)) : undefined;
                    try {
                        const result = await vscode.commands.executeCommand(`${VIEW_ID}.configureWorkspace`, targetPath, orderFromUi);
                        if (typeof result?.workspacePath === "string" && result.workspacePath.trim()) {
                            await context.workspaceState.update(GLOBAL_STATE_LAST_WORKSPACE_PATH_KEY, result.workspacePath.trim());
                            setActiveWorkspace(result.workspacePath.trim());
                        }
                        const mcpList = (result?.sessionIds ?? []).map((id) => `sidechat-${id}`).join("、");
                        webviewView.webview.postMessage({
                            command: "configResult",
                            ok: true,
                            msg: `已配置 MCP！\n工作区：${result?.workspacePath}\n已按当前侧栏注册 ${result?.sessionIds?.length ?? 0} 路：${mcpList || "（无）"}\n已清理本扩展在旧配置里多余的 sidechat-* 项。\n配置文件：${result?.mcpPath}\n规则：${result?.rulePath}\n保存后 Cursor 会按新列表加载 MCP。`,
                            workspacePath: result?.workspacePath,
                        });
                    }
                    catch (e) {
                        webviewView.webview.postMessage({
                            command: "configResult",
                            ok: false,
                            msg: String(e),
                        });
                    }
                    return;
                }
                if (cmd === "cleanupArtifacts") {
                    try {
                        const result = await vscode.commands.executeCommand("sideChat.cleanupArtifacts");
                        if (result?.ok) {
                            webviewView.webview.postMessage({
                                command: "cleanupArtifactsResult",
                                ok: true,
                                removedCount: Array.isArray(result.removedItems) ? result.removedItems.length : 0,
                                msg: result.detail,
                            });
                        }
                        else {
                            webviewView.webview.postMessage({
                                command: "cleanupArtifactsResult",
                                ok: false,
                                msg: "已取消清理",
                            });
                        }
                    }
                    catch (e) {
                        webviewView.webview.postMessage({
                            command: "cleanupArtifactsResult",
                            ok: false,
                            msg: String(e),
                        });
                    }
                    return;
                }
                if (cmd === "persistSessionOrder") {
                    const raw = message.order;
                    const next = normalizeSessionOrder(raw);
                    if (next.length === 0)
                        return;
                    void context.workspaceState.update(GLOBAL_STATE_SESSION_ORDER_KEY, next);
                    return;
                }
                if (cmd === "persistSessionMemos") {
                    const raw = message.memos;
                    if (!raw || typeof raw !== "object" || Array.isArray(raw))
                        return;
                    const next = {};
                    for (const [k, v] of Object.entries(raw)) {
                        if (!isValidSessionId(k))
                            continue;
                        const s = String(v ?? "")
                            .trim()
                            .slice(0, MAX_SESSION_MEMO_CHARS);
                        if (s)
                            next[k] = s;
                    }
                    void context.workspaceState.update(GLOBAL_STATE_SESSION_MEMOS_KEY, next);
                    return;
                }
                if (cmd === "persistDrafts") {
                    const raw = message.drafts;
                    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
                        void context.workspaceState.update(GLOBAL_STATE_DRAFTS_KEY, {});
                        return;
                    }
                    const next = {};
                    for (const [k, v] of Object.entries(raw)) {
                        if (!isValidSessionId(k))
                            continue;
                        const s = String(v ?? "").slice(0, 4000);
                        if (s)
                            next[k] = s;
                    }
                    void context.workspaceState.update(GLOBAL_STATE_DRAFTS_KEY, next);
                    return;
                }
                if (cmd === "persistPresets") {
                    const raw = message.presets;
                    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
                        void context.workspaceState.update(GLOBAL_STATE_PRESETS_KEY, {});
                        return;
                    }
                    const next = {};
                    for (const [k, v] of Object.entries(raw)) {
                        if (!isValidSessionId(k))
                            continue;
                        if (!Array.isArray(v))
                            continue;
                        const items = v
                            .filter((s) => typeof s === "string" && s.trim())
                            .map((s) => s.trim().slice(0, 200))
                            .slice(0, 3);
                        if (items.length > 0)
                            next[k] = items;
                    }
                    void context.workspaceState.update(GLOBAL_STATE_PRESETS_KEY, next);
                    return;
                }
                if (cmd === "persistWorkspacePath") {
                    const nextPath = String(message.path ?? "").trim();
                    void context.workspaceState.update(GLOBAL_STATE_LAST_WORKSPACE_PATH_KEY, nextPath);
                    setActiveWorkspace(nextPath);
                    return;
                }
                if (cmd === "clearSessionQueue") {
                    const sid = String(message.sessionId ?? "");
                    if (isValidSessionId(sid)) {
                        try {
                            const queueFile = path.join(session.MESSAGE_QUEUE_ROOT_DIR, "s", sid, "messages.json");
                            if (fs.existsSync(queueFile)) {
                                fs.writeFileSync(queueFile, JSON.stringify({ messages: [] }, null, 2), "utf-8");
                            }
                        }
                        catch { }
                    }
                    return;
                }
                if (cmd === "deleteSessionData") {
                    const sid = String(message.sessionId ?? "");
                    if (!isValidSessionId(sid)) {
                        webviewView.webview.postMessage({ command: "sessionDeleted", ok: false, msg: "无效会话 ID" });
                        return;
                    }
                    const nextOrder = normalizeSessionOrder(message.order);
                    try {
                        if (nextOrder.length > 0) {
                            await context.workspaceState.update(GLOBAL_STATE_SESSION_ORDER_KEY, nextOrder);
                        }
                        await clearPersistedSessionArtifacts(context, sid);
                        const drafts = readSessionDrafts(context);
                        if (drafts[sid]) {
                            delete drafts[sid];
                            await context.workspaceState.update(GLOBAL_STATE_DRAFTS_KEY, drafts);
                        }
                        clearSessionQueueDir(sid);
                        webviewView.webview.postMessage({
                            command: "sessionDeleted",
                            ok: true,
                            sessionId: sid,
                        });
                    }
                    catch (e) {
                        webviewView.webview.postMessage({
                            command: "sessionDeleted",
                            ok: false,
                            sessionId: sid,
                            msg: String(e),
                        });
                    }
                    return;
                }
                if (cmd === "copyCheckPhrase") {
                    const sid = String(message.sessionId ?? "1");
                    if (!isValidSessionId(sid)) {
                        return;
                    }
                    const phrase = `请使用 sidechat-${sid} 的 check_messages`;
                    await vscode.env.clipboard.writeText(phrase);
                    webviewView.webview.postMessage({ command: "copyPhraseResult", ok: true });
                    return;
                }
                if (cmd === "persistHistories") {
                    void context.workspaceState.update(GLOBAL_STATE_SESSION_KEY, serializePersistedSessionHistories(message.payload));
                    return;
                }
                if (cmdStr === "voiceInputNative") {
                    if (process.platform !== "win32") {
                        webviewView.webview.postMessage({
                            command: "voiceInputResult",
                            ok: false,
                            msg: "系统语音仅支持 Windows",
                        });
                        return;
                    }
                    const r = await recognizeSpeechWindows(50000);
                    webviewView.webview.postMessage({
                        command: "voiceInputResult",
                        ok: r.ok,
                        text: r.text ?? "",
                        msg: r.err ?? "",
                    });
                    return;
                }
                if (cmd === "sendMessage") {
                    const msgObj = message;
                    const text = String(msgObj.text ?? "").trim();
                    const workspacePath = msgObj.workspacePath;
                    const sessionId = String(msgObj.sessionId ?? "1");
                    if (!isValidSessionId(sessionId)) {
                        webviewView.webview.postMessage({ command: "sendResult", ok: false, msg: "无效会话 ID（超出范围）" });
                        return;
                    }
                    const images = Array.isArray(msgObj.images) ? msgObj.images.filter((img) => img && img.data) : [];
                    if (!text && images.length === 0) {
                        webviewView.webview.postMessage({
                            command: "sendResult",
                            ok: false,
                            msg: "请输入文字或粘贴图片",
                        });
                        return;
                    }
                    if (workspacePath) {
                        setActiveWorkspace(workspacePath);
                    }
                    const queueDir = session.MESSAGE_QUEUE_ROOT_DIR;
                    const sessionDir = path.join(queueDir, "s", sessionId);
                    const queuePath = path.join(sessionDir, "messages.json");
                    ensureRuntimeConfig();
                    if (workspacePath) {
                        const workspaceInfoPath = path.join(queueDir, "workspace.json");
                        try {
                            if (!fs.existsSync(queueDir))
                                fs.mkdirSync(queueDir, { recursive: true });
                            fs.writeFileSync(workspaceInfoPath, JSON.stringify({ workspacePath, time: new Date().toISOString() }, null, 2), "utf-8");
                        }
                        catch {
                            // ignore
                        }
                    }
                    let data = { messages: [] };
                    try {
                        if (fs.existsSync(queuePath)) {
                            data = JSON.parse(fs.readFileSync(queuePath, "utf-8"));
                        }
                    }
                    catch {
                        data = { messages: [] };
                    }
                    data.messages = data.messages ?? [];
                    const entry = {
                        text,
                        time: new Date().toISOString(),
                    };
                    if (images.length > 0)
                        entry.images = images;
                    data.messages.push(entry);
                    try {
                        if (!fs.existsSync(sessionDir))
                            fs.mkdirSync(sessionDir, { recursive: true });
                        fs.writeFileSync(queuePath, JSON.stringify(data, null, 2), "utf-8");
                        markSessionQueued(sessionId);
                        webviewView.webview.postMessage({
                            command: "sendResult",
                            ok: true,
                            msg: `已发送到 MCP-${sessionId}！在对应 Cursor 对话中说「请使用 sidechat-${sessionId} 的 check_messages」获取。`,
                            text,
                            sessionId,
                            imageCount: images.length,
                        });
                    }
                    catch (e) {
                        webviewView.webview.postMessage({ command: "sendResult", ok: false, msg: String(e) });
                    }
                    return;
                }
                if (cmd === "ping") {
                    const text = String(message.text ?? "");
                    console.log(`[${viewType}] onDidReceiveMessage ping, text=`, text);
                    webviewView.webview.postMessage({ command: "pong", text, time: new Date().toISOString() });
                }
            });
            context.subscriptions.push(disposable);
            context.subscriptions.push({ dispose: () => clearInterval(intervalId) });
        },
    };
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(viewType, provider, {
        webviewOptions: {
            retainContextWhenHidden: true,
        },
    }));
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
