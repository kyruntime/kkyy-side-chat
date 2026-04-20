"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const process = require("process");
const { MAX_SESSIONS } = require("./constants");
const { getStyles } = require("./webview-css");
const { getScript } = require("./webview-script");
function getHtml(webview, nonce, extensionVersion) {
    const csp = `
    default-src 'none';
    img-src ${webview.cspSource} data:;
    style-src ${webview.cspSource} 'unsafe-inline';
    script-src 'nonce-${nonce}';
  `.replace(/\s+/g, " ").trim();
    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <title>SideChat</title>
  <style>
${getStyles()}
  </style>
</head>
<body>
  <div class="header">
    <h1>SideChat</h1>
    <span class="header-ver" id="extVersionBadge">v${extensionVersion}</span>
    <div class="status-dot" id="statusDot"></div>
    <button type="button" class="btn-header" id="openHelpBtn">?</button>
  </div>

  <div class="tab-bar" id="tabBar">
    <button type="button" class="tab-add" id="addSessionBtn" title="添加会话">+</button>
  </div>

  <div class="main">
    <details class="config-section" id="configDetails">
      <summary class="config-summary" id="configSummary">工作区配置</summary>
      <div class="config-body">
        <div class="config-row">
          <input type="text" class="config-input" id="pathInput" placeholder="选择或输入工作区路径..." />
          <button class="btn btn-icon" id="browseBtn" title="浏览">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          </button>
        </div>
        <div class="config-row">
          <button class="btn btn-blue" id="cfgBtn">开始配置</button>
          <button class="btn btn-sm" id="useCurrentBtn">使用当前</button>
        </div>
        <div class="config-row cleanup-row">
          <button class="btn btn-sm btn-danger" id="cleanupArtifactsBtn">卸载前清理</button>
          <div class="cleanup-tip">删除 ~/.cursor/sidechat-* 与当前工作区 SideChat 配置</div>
        </div>
        <div class="config-path" id="currentPathDisplay">未选择工作区</div>
        <div class="feedback" id="cfgFeedback"></div>
        <div class="memo-row">
          <div class="memo-label"><span id="sessionMemoBadge">MCP-1</span> · 本路备忘</div>
          <input type="text" class="memo-input" id="sessionMemoInput" placeholder="例如：前端仓库 / 写文档 / 测试" maxlength="200" />
        </div>
        <div class="presets-config">
          <div class="presets-config-label">快捷指令（点击即发送，最多 3 条）</div>
          <div class="presets-config-list" id="presetsConfigList"></div>
          <button type="button" class="btn btn-sm" id="addPresetBtn">+ 添加指令</button>
        </div>
      </div>
    </details>

    <div id="connectionBanner" class="conn-banner">
      <span>等待 Agent 连接</span>
      <span class="conn-hint">在 Cursor 对话中输入：<code id="bannerHintCode">请使用 sidechat-1 的 check_messages</code></span>
    </div>

    <div class="composer" id="sendMessageSection">
      <div style="position:relative">
        <div id="msgInput" class="msg-input is-empty" contenteditable="true" data-placeholder="输入消息… Cmd+Enter 发送，Ctrl+V 粘贴截图"></div>
      </div>
      <div class="attach-chips" id="attachChips"></div>
      <div class="toolbar">
        <div class="toolbar-left">
          <div class="presets-bar" id="presetsBar"></div>
        </div>
        <div class="toolbar-right">
          <button type="button" class="btn-voice" id="voiceInputBtn" aria-pressed="false" title="语音输入">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>
          </button>
          <button class="btn btn-blue btn-send" type="button" id="sendBtn" title="发送">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          </button>
        </div>
      </div>
      <div class="feedback" id="sendFeedback"></div>
    </div>

    <div id="imgPreviewOverlay" class="img-preview-overlay" aria-hidden="true">
      <div class="img-preview-backdrop" id="imgPreviewBackdrop"></div>
      <img id="imgPreviewFull" alt="" />
    </div>

    <div class="hint-bar">
      <code class="hint-code" id="hintPhrase">请使用 sidechat-1 的 check_messages</code>
      <button type="button" class="btn btn-sm btn-copy-hint" id="copyHintBtn">复制</button>
      <span class="hint-status" id="hintStatus"></span>
    </div>

    <div class="chat-section">
      <div class="chat-head">
        <span class="chat-head-title">对话记录</span>
        <button class="btn btn-sm" type="button" id="clearChatBtn">清空</button>
      </div>
      <div class="chat-body" id="chatContainer">
        <div id="messagesList"></div>
        <div class="empty" id="emptyState">
          <div class="empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div class="empty-title">发送消息开始对话</div>
          <div class="empty-sub">输入文字，按 Cmd+Enter 或点发送按钮</div>
        </div>
      </div>
    </div>
  </div>

  <div id="helpOverlay" class="help-overlay" aria-hidden="true">
    <div class="help-backdrop" id="helpBackdrop"></div>
    <div class="help-panel">
      <div class="help-head">
        <h3>SideChat</h3>
        <button type="button" class="btn btn-sm" id="closeHelpBtn">关闭</button>
      </div>
      <div class="help-body">
        <div class="hh">快捷操作</div>
        <ul>
          <li><code>Cmd+Enter</code> 发送消息</li>
          <li>双击标签页重命名会话</li>
        </ul>
        <div class="hh">注意事项</div>
        <ul>
          <li>增删会话后需重新点 <strong>「开始配置」</strong></li>
          <li>每个 Cursor 对话窗口只绑定一个通道</li>
          <li>提示 taking longer 时请确保网络稳定，否则容易断连</li>
          <li>如需指定某个文件或文件中的某几行代码，建议先在 Cursor 原生聊天框中通过 @ 选取文件/行号，再复制粘贴到本聊天窗口发送</li>
        </ul>
      </div>
    </div>
  </div>

  <script nonce="${nonce}">
${getScript(nonce, MAX_SESSIONS, process.platform)}
  </script>
</body>
</html>`;
}
function getNonce() {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
exports.getHtml = getHtml;
exports.getNonce = getNonce;
