#!/usr/bin/env node
/**
 * SideChat MCP Server - 稳定版
 * 通过 stdio 与 Cursor 通信，使用文件队列实现插件 ↔ AI 的持续对话
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, appendFileSync, unlinkSync } from "fs";
import { join, resolve } from "path";
import { homedir } from "os";
import { randomBytes, createHash } from "crypto";

// ── 全局错误兜底：防止未捕获异常导致进程崩溃 ──
process.on("uncaughtException", (err) => {
  try { logError("uncaughtException", err); } catch {}
});
process.on("unhandledRejection", (reason) => {
  try { logError("unhandledRejection", reason); } catch {}
});

// ── 优雅退出：收到终止信号时写入状态后退出 ──
function gracefulShutdown(signal) {
  try { markHeartbeat("shutdown", { signal }); } catch {}
  process.exit(0);
}
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

// ── CLI args: --workspace <path> ──
function parseCliArgs() {
  const args = process.argv.slice(2);
  let workspace = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--workspace" && i + 1 < args.length) {
      workspace = args[i + 1];
    }
  }
  return { workspace: workspace ? resolve(workspace).replace(/[/\\]+$/, "") : "" };
}

function workspaceHash(wsPath) {
  return createHash("sha256").update(wsPath).digest("hex").slice(0, 12);
}

const cliArgs = parseCliArgs();

// ── 路径常量 ──
const messagesBase = join(homedir(), ".cursor", "sidechat-messages");
const queueRoot = cliArgs.workspace
  ? join(messagesBase, "w", workspaceHash(cliArgs.workspace))
  : messagesBase;
const serverPrefix = "sidechat";
const sessionKey = (process.env.SIDECHAT_SESSION || "").trim();
const queueDir = sessionKey ? join(queueRoot, "s", sessionKey) : queueRoot;
const queuePath = join(queueDir, "messages.json");
const heartbeatPath = join(queueDir, "heartbeat.json");
const aiDonePath = join(queueDir, "ai_done.json");
const configPath = join(queueRoot, "config.json");
const logPath = join(queueDir, "server.log");

// ── 日志 ──
function logError(label, err) {
  try {
    ensureQueueDir();
    const line = `[${new Date().toISOString()}] ${label}: ${err?.stack || err}\n`;
    appendFileSync(logPath, line);
  } catch {}
}

// ── 文件系统工具 ──
function ensureQueueDir() {
  if (!existsSync(queueDir)) mkdirSync(queueDir, { recursive: true });
}

/** 原子写入：先写临时文件再 rename，防止读到半写的 JSON */
function atomicWriteSync(filePath, content) {
  ensureQueueDir();
  const tmp = filePath + "." + randomBytes(4).toString("hex") + ".tmp";
  try {
    writeFileSync(tmp, content, "utf-8");
    renameSync(tmp, filePath);
  } catch (err) {
    try { unlinkSync(tmp); } catch {}
    throw err;
  }
}

/** 安全读取 JSON：解析失败时重试一次（防止刚好读到写入中间态） */
function safeReadJSON(filePath, defaultVal) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (!existsSync(filePath)) return defaultVal;
      const raw = readFileSync(filePath, "utf-8");
      if (!raw.trim()) return defaultVal;
      return JSON.parse(raw);
    } catch {
      if (attempt === 0) {
        const start = Date.now();
        while (Date.now() - start < 50) { /* busy wait 50ms */ }
      }
    }
  }
  logError("safeReadJSON", `failed to parse ${filePath} after 2 attempts`);
  return defaultVal;
}

function readQueue() {
  return safeReadJSON(queuePath, { messages: [] });
}

function writeQueue(data) {
  atomicWriteSync(queuePath, JSON.stringify(data, null, 2));
}

function readRuntimeConfig() {
  const parsed = safeReadJSON(configPath, null);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed;
  }
  return {};
}

function readKeepaliveConfig() {
  const cfg = readRuntimeConfig();
  const heartbeatIntervalMs = Math.max(400, Number(cfg.heartbeatIntervalMs) || 700);
  const keepaliveTimeoutMs = Math.max(2000, Number(cfg.keepaliveTimeoutMs) || 60000);
  return { heartbeatIntervalMs, keepaliveTimeoutMs };
}

function writeRuntimeState(filePath, payload) {
  try {
    atomicWriteSync(filePath, JSON.stringify(payload, null, 2));
  } catch (err) {
    logError("writeRuntimeState", err);
  }
}

function readAiDoneState() {
  return safeReadJSON(aiDonePath, null);
}

function markHeartbeat(status, extra = {}) {
  writeRuntimeState(heartbeatPath, {
    sessionId: sessionKey || "default",
    status,
    pid: process.pid,
    updatedAt: new Date().toISOString(),
    ...extra,
  });
}

function markAiDone(status, done, extra = {}) {
  writeRuntimeState(aiDonePath, {
    sessionId: sessionKey || "default",
    status,
    done,
    pid: process.pid,
    updatedAt: new Date().toISOString(),
    ...extra,
  });
}

function getWorkspaceInfo() {
  if (cliArgs.workspace) return cliArgs.workspace;
  try {
    const infoPath = join(queueRoot, "workspace.json");
    if (existsSync(infoPath)) {
      const raw = readFileSync(infoPath, "utf-8");
      const data = JSON.parse(raw);
      return data.workspacePath || null;
    }
  } catch {}
  return null;
}

function buildSystemSuffix() {
  const workspace = getWorkspaceInfo();
  let suffix = "\n\n---\n[MANDATORY INSTRUCTION]\n";

  if (workspace) {
    suffix += `\u5DE5\u4F5C\u533A\uFF1A${workspace}\n\n`;
  }
  if (sessionKey) {
    suffix += `\u3010\u4F1A\u8BDD\u901A\u9053\u3011MCP-${sessionKey}\uFF1A\u672C\u8FDB\u7A0B\u4EC5\u5904\u7406\u63D2\u4EF6\u53D1\u5230\u8BE5\u901A\u9053\u7684\u6D88\u606F\uFF1B\u8BF7\u5728\u672C\u5BF9\u8BDD\u4E2D\u8C03\u7528 ${serverPrefix}-${sessionKey} \u7684 check_messages\u3002\n\n`;
  }

  suffix +=
    "\u4EE5\u4E0A\u662F\u7528\u6237\u901A\u8FC7\u63D2\u4EF6\u53D1\u6765\u7684**\u4E00\u6761**\u6D88\u606F\uFF08\u82E5\u8FDE\u53D1\u591A\u6761\u4F1A\u5206\u591A\u6B21\u9001\u8FBE\uFF09\u3002\n\n" +
    "\u3010\u5FC5\u987B\u5148\u505A\u3011\u50CF\u5E73\u5E38\u804A\u5929\u4E00\u6837\u76F4\u63A5\u56DE\u5E94\u7528\u6237\u5185\u5BB9\uFF08\u5BD2\u6684\u3001\u95EE\u7B54\u3001\u4EFB\u52A1\u7B49\uFF09\uFF0C\u4E0D\u8981\u7528\u300C\u5DE5\u5177\u5DF2\u9A8C\u8BC1\u300D\u300CMCP \u6B63\u5E38\u300D\u7B49**\u4EE3\u66FF\u771F\u5B9E\u56DE\u590D**\u3002\n" +
    "\u3010\u7981\u6B62\u3011\u7528\u957F\u7BC7\u89E3\u91CA\u63D2\u4EF6/Cursor/\u901A\u9053\u539F\u7406\u6765\u7ED3\u675F\u672C\u8F6E\uFF1B\u7528\u6237\u53D1\u300C\u4F60\u597D\u300D\u5C31\u6B63\u5E38\u56DE\u300C\u4F60\u597D\u300D\u7C7B\u7B80\u77ED\u95EE\u5019\u5373\u53EF\u3002\n\n" +
    "\u6B63\u6587\u5199\u5728 Cursor \u7A97\u53E3\uFF1B\u9ED8\u8BA4\u4E0D\u8981\u628A\u957F\u6587\u585E\u8FDB reply\u3002\n\n" +
    "\u3010\u4E0B\u4E00\u6B65\u5EFA\u8BAE\u3011\u6BCF\u6B21\u56DE\u590D\u7528\u6237\u540E\uFF0C\u8C03\u7528 check_messages \u65F6**\u5FC5\u987B**\u4F20\u5165 suggestions \u53C2\u6570\uFF1A\u6839\u636E\u5F53\u524D\u5BF9\u8BDD\u4E0A\u4E0B\u6587\u63A8\u6D4B 2\u20134 \u4E2A\u7528\u6237\u53EF\u80FD\u60F3\u505A\u7684\u4E0B\u4E00\u6B65\uFF0C\u4F5C\u4E3A\u5B57\u7B26\u4E32\u6570\u7EC4\u3002\u4F8B\u5982\uFF1A[\"继续优化代码\", \"添加单元测试\", \"部署到生产环境\"]\u3002\u5EFA\u8BAE\u5E94\u7B80\u6D01\u6709\u7528\uFF0C\u6BCF\u9879\u4E0D\u8D85\u8FC7 30 \u5B57\u3002\u5982\u679C\u540C\u65F6\u6709 reply\uFF0C\u4E5F\u4E00\u5E76\u4F20\u5165\u3002\n\n" +
    "\u56DE\u590D\u7528\u6237\u540E\uFF0C\u4E0B\u4E00\u6B65**\u53EA\u80FD**\u662F\u518D\u6B21\u8C03\u7528 check_messages()\uFF08reply \u53EF\u7701\u7565\uFF09\u7B49\u5F85\u4E0B\u4E00\u6761\uFF1B\u4E0D\u8981\u518D\u8F93\u51FA\u4EFB\u4F55\u8FC7\u6E21\u53E5\u3001\u966A\u804A\u53E5\u6216\u89E3\u91CA\u53E5\u3002\n" +
    "\u5982\u679C\u5DE5\u5177\u8FD4\u56DE [KEEPALIVE_ONLY] \u6216 [NO_MESSAGE_CONTINUE] \u5F00\u5934\u7684\u6587\u672C\uFF1A\u8FD9\u8868\u793A\u5F53\u524D\u6CA1\u6709\u65B0\u6D88\u606F\u3002**\u7EDD\u5BF9\u4E0D\u8981**\u5411\u7528\u6237\u8F93\u51FA\u4EFB\u4F55\u6B63\u6587\uFF0C\u76F4\u63A5\u518D\u6B21\u8C03\u7528 check_messages()\u3002\n" +
    "\u50CF\u300C\u6211\u5728\u300D\u300C\u7EE7\u7EED\u8BF4\u300D\u300C\u6211\u4F1A\u7EE7\u7EED\u76D1\u542C\u300D\u300C\u968F\u65F6\u53EB\u6211\u300D\u8FD9\u7C7B\u81EA\u7136\u8BED\u8A00\uFF0C\u5728 keepalive \u573A\u666F\u4E0B\u4E00\u5F8B\u7981\u6B62\u8F93\u51FA\u3002\n" +
    "[END]";

  return suffix;
}

// ── sleep 工具：正确清理事件监听器，防止泄漏 ──
function sleepWithAbort(signal, ms) {
  return new Promise((resolve) => {
    if (signal?.aborted) { resolve(false); return; }
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      if (signal) signal.removeEventListener("abort", onAbort);
      resolve(true);
    }, ms);
    function onAbort() {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(false);
    }
    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

// ── 提取消息处理逻辑到独立函数，保持主循环简洁 ──
function parseMessage(m) {
  const textPieces = [];
  const imageParts = [];

  if (typeof m.text === "string" && m.text.trim()) {
    textPieces.push(m.text.trim());
  }
  if (Array.isArray(m.images)) {
    for (const img of m.images) {
      if (img?.mimeType && img?.data) {
        imageParts.push({ mimeType: String(img.mimeType), data: String(img.data) });
      }
    }
  }
  return { textPieces, imageParts };
}

function buildMessageResponse(textPieces, imageParts) {
  const content = [];
  const systemSuffix = buildSystemSuffix();
  const mainText = textPieces.join("\n\n");
  const fetchedAt = new Date().toISOString();
  markHeartbeat("processing", { lastMessageAt: fetchedAt });
  markAiDone("processing", false, { lastMessageAt: fetchedAt });

  if (mainText) {
    content.push({ type: "text", text: mainText + systemSuffix });
  } else if (imageParts.length > 0) {
    content.push({ type: "text", text: "\uFF08\u6536\u5230\u6765\u81EA\u63D2\u4EF6\u7684\u56FE\u7247/\u9644\u4EF6\uFF0C\u65E0\u6587\u5B57\u8BF4\u660E\uFF09" + systemSuffix });
  } else {
    content.push({ type: "text", text: "\uFF08\u6536\u5230\u6765\u81EA\u63D2\u4EF6\u7684\u6D88\u606F\uFF09" + systemSuffix });
  }

  for (const img of imageParts) {
    content.push({ type: "image", mimeType: img.mimeType, data: img.data });
  }

  return { content };
}

// ── MCP Server 实例 ──
const serverName = sessionKey ? `${serverPrefix}-${sessionKey}` : serverPrefix;
const server = new McpServer({ name: serverName, version: "0.2.0" });

server.registerTool(
  "check_messages",
  {
    title: "\u68C0\u67E5\u6D88\u606F\uFF08\u6301\u7EED\u5BF9\u8BDD\uFF09",
    description:
      "\u3010\u6301\u7EED\u5BF9\u8BDD\u3011\u83B7\u53D6\u7528\u6237\u901A\u8FC7\u63D2\u4EF6\u53D1\u9001\u7684\u6D88\u606F\u3002\u52A9\u624B\u6B63\u6587\u5E94\u53EA\u5728 Cursor \u5BF9\u8BDD\u91CC\u8F93\u51FA\u3002" +
      "\u5904\u7406\u5B8C\u540E\u5FC5\u987B\u518D\u6B21\u8C03\u7528\u672C\u5DE5\u5177\u4EE5\u4FDD\u6301\u5FAA\u73AF\uFF1B\u82E5\u6536\u5230 [KEEPALIVE_ONLY]/[NO_MESSAGE_CONTINUE]\uFF0C\u4E0D\u8981\u56DE\u590D\u7528\u6237\uFF0C\u76F4\u63A5\u518D\u6B21\u8C03\u7528\u672C\u5DE5\u5177\uFF1B\u9ED8\u8BA4\u4E0D\u4F20 reply\u3002" +
      "\u6BCF\u6B21\u56DE\u590D\u7528\u6237\u540E\uFF0C\u8C03\u7528\u672C\u5DE5\u5177\u65F6\u5FC5\u987B\u4F20\u5165 suggestions\uFF0C\u63D0\u4F9B 2\u20134 \u4E2A\u7528\u6237\u53EF\u80FD\u60F3\u505A\u7684\u4E0B\u4E00\u6B65\u5EFA\u8BAE\u3002",
    inputSchema: z.object({
      reply: z
        .string()
        .optional()
        .describe("\u53EF\u9009\u3002\u4EC5\u975E\u7A7A\u65F6\u624D\u4F1A\u5199\u5165\u63D2\u4EF6\u4FA7\uFF1B\u9ED8\u8BA4\u7701\u7565\uFF0C\u7528\u6237\u53EA\u5728 Cursor \u770B\u5B8C\u6574\u56DE\u590D"),
      suggestions: z
        .array(z.string())
        .optional()
        .describe("\u53EF\u9009\u3002AI \u63A8\u6D4B\u7684\u4E0B\u4E00\u6B65\u5EFA\u8BAE\uFF0C\u6570\u7EC4\uFF0C\u6BCF\u9879\u4E3A\u7B80\u77ED\u5EFA\u8BAE\u6587\u672C\uFF1B\u4F1A\u5728\u63D2\u4EF6\u4FA7\u663E\u793A\u4E3A\u53EF\u70B9\u51FB\u6309\u94AE"),
    }),
  },
  async ({ reply, suggestions }, extra) => {
    const { heartbeatIntervalMs, keepaliveTimeoutMs } = readKeepaliveConfig();
    const replyTrimmed = typeof reply === "string" ? reply.trim() : "";

    // 更新 AI 完成状态
    try {
      const previousAiDone = readAiDoneState();
      if (previousAiDone?.status === "processing") {
        markAiDone("done", true, {
          lastMessageAt: previousAiDone.lastMessageAt || "",
          lastReplyAt: replyTrimmed ? new Date().toISOString() : previousAiDone.lastReplyAt || "",
        });
      } else if (!previousAiDone) {
        markAiDone("idle", true);
      }
    } catch (err) {
      logError("check_messages aiDone", err);
    }

    // 写入 reply（含可选 suggestions）
    const suggestionsArr = Array.isArray(suggestions)
      ? suggestions.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim())
      : [];
    if (replyTrimmed || suggestionsArr.length > 0) {
      try {
        const replyFile = join(queueDir, "reply.json");
        const payload = { timestamp: new Date().toISOString() };
        if (replyTrimmed) payload.reply = replyTrimmed;
        if (suggestionsArr.length > 0) payload.suggestions = suggestionsArr;
        atomicWriteSync(replyFile, JSON.stringify(payload, null, 2));
      } catch (err) {
        logError("check_messages reply", err);
      }
    }

    // ── 核心轮询循环（全部包裹在 try-catch 中，单次错误不会中断循环）──
    let lastHeartbeatAt = 0;
    const startedAt = Date.now();
    let consecutiveErrors = 0;

    while (!extra.signal.aborted) {
      try {
        const now = Date.now();
        if (now - lastHeartbeatAt >= heartbeatIntervalMs) {
          markHeartbeat("polling");
          lastHeartbeatAt = now;
        }

        const data = readQueue();
        const queued = Array.isArray(data.messages) ? data.messages : [];
        consecutiveErrors = 0;

        if (queued.length > 0) {
          const first = queued[0];
          const rest = queued.slice(1);
          writeQueue({ messages: rest });

          const { textPieces, imageParts } = parseMessage(first);
          return buildMessageResponse(textPieces, imageParts);
        }

        if (keepaliveTimeoutMs > 0 && now - startedAt >= keepaliveTimeoutMs) {
          markHeartbeat("polling", { keepalive: true });
          return {
            content: [
              {
                type: "text",
                text: "[KEEPALIVE_ONLY]\n\u5F53\u524D\u901A\u9053\u4ECD\u7136\u6D3B\u8DC3\uFF0C\u4F46\u6682\u65F6\u6CA1\u6709\u65B0\u6D88\u606F\u3002\n\u4E0D\u8981\u5411\u7528\u6237\u8F93\u51FA\u4EFB\u4F55\u6B63\u6587\u3002\n\u8BF7\u7ACB\u523B\u518D\u6B21\u8C03\u7528 check_messages() \u7EE7\u7EED\u7B49\u5F85\u4E0B\u4E00\u6761\u3002",
              },
            ],
          };
        }
      } catch (err) {
        consecutiveErrors++;
        logError("check_messages loop", err);
        if (consecutiveErrors > 10) {
          markHeartbeat("error", { error: String(err) });
          return {
            content: [{ type: "text", text: "[KEEPALIVE_ONLY]\n\u8F6E\u8BE2\u9047\u5230\u8FDE\u7EED\u9519\u8BEF\uFF0C\u81EA\u52A8\u6062\u590D\u4E2D\u3002\u8BF7\u7ACB\u523B\u518D\u6B21\u8C03\u7528 check_messages()\u3002" }],
          };
        }
      }

      await sleepWithAbort(extra.signal, Math.min(heartbeatIntervalMs, 1000));
    }

    markHeartbeat("aborted");
    return {
      content: [{ type: "text", text: "[system] check_messages \u7B49\u5F85\u88AB\u53D6\u6D88\uFF0C\u7ED3\u675F\u672C\u8F6E\u3002" }],
      isError: true,
    };
  }
);

server.registerTool(
  "ask_question",
  {
    title: "\u63D0\u95EE",
    description: "\u5411\u7528\u6237\u63D0\u95EE\uFF0C\u83B7\u53D6\u7528\u6237\u8F93\u5165",
    inputSchema: z.object({
      question: z.string().describe("\u8981\u95EE\u7528\u6237\u7684\u95EE\u9898"),
    }),
  },
  async ({ question }) => {
    const data = readQueue();
    const texts = data.messages?.map((m) => m.text).filter(Boolean) ?? [];
    const userReply = texts.length ? texts[0] : "\u7528\u6237\u6682\u65E0\u56DE\u590D";
    return { content: [{ type: "text", text: `\u95EE\u9898\uFF1A${question}\n\u7528\u6237\u56DE\u590D\uFF1A${userReply}` }] };
  }
);

server.registerTool(
  "send_message",
  {
    title: "\u53D1\u9001\u6D88\u606F",
    description: "\u63A5\u6536\u6587\u672C\u548C\u53EF\u9009\u56FE\u7247\uFF0C\u8FD4\u56DE\u7B80\u5355\u786E\u8BA4",
    inputSchema: z.object({
      text: z.string().describe("\u7528\u6237\u8F93\u5165\u7684\u6587\u672C"),
      images: z
        .array(
          z.object({
            mimeType: z.string().describe("\u56FE\u7247 MIME \u7C7B\u578B\uFF0C\u5982 image/png"),
            data: z.string().describe("\u56FE\u7247 base64 \u6570\u636E"),
          })
        )
        .optional()
        .describe("\u53EF\u9009\u56FE\u7247\u5217\u8868"),
    }),
  },
  async ({ text, images }) => {
    const imgCount = images?.length ?? 0;
    const reply = `\u5DF2\u6536\u5230\uFF1A${text}${imgCount > 0 ? `\uFF0C\u56FE\u7247 ${imgCount} \u5F20` : ""}`;
    return { content: [{ type: "text", text: reply }] };
  }
);

// ── 启动 ──
const transport = new StdioServerTransport();
await server.connect(transport);
markHeartbeat("started");
