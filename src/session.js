"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { MAX_SESSIONS, DEFAULT_SESSION_ORDER, GLOBAL_STATE_SESSION_KEY, GLOBAL_STATE_SESSION_ORDER_KEY, GLOBAL_STATE_SESSION_MEMOS_KEY, GLOBAL_STATE_DRAFTS_KEY, GLOBAL_STATE_LAST_WORKSPACE_PATH_KEY, MAX_SESSION_MEMO_CHARS, MAX_SESSION_HISTORY_ITEMS, MANAGED_WORKSPACES_REGISTRY_PATH, MESSAGES_BASE_DIR, } = require("./constants");
function normalizeWorkspacePath(rawPath) {
    const s = String(rawPath ?? "").trim();
    return s ? path.resolve(s) : "";
}
function workspaceHash(wsPath) {
    return crypto.createHash("sha256").update(wsPath).digest("hex").slice(0, 12);
}
function getQueueRootForWorkspace(wsPath) {
    const norm = normalizeWorkspacePath(wsPath);
    if (!norm)
        return MESSAGES_BASE_DIR;
    return path.join(MESSAGES_BASE_DIR, "w", workspaceHash(norm));
}
let MESSAGE_QUEUE_ROOT_DIR = MESSAGES_BASE_DIR;
let RUNTIME_CONFIG_PATH = path.join(MESSAGE_QUEUE_ROOT_DIR, "config.json");
function setActiveWorkspace(wsPath) {
    MESSAGE_QUEUE_ROOT_DIR = getQueueRootForWorkspace(wsPath);
    RUNTIME_CONFIG_PATH = path.join(MESSAGE_QUEUE_ROOT_DIR, "config.json");
}
const DEFAULT_HEARTBEAT_INTERVAL_MS = 700;
const DEFAULT_KEEPALIVE_TIMEOUT_MS = 60000;
const HEARTBEAT_STALE_AFTER_MS = 90000;
function isValidSessionId(id) {
    const n = parseInt(id, 10);
    return Number.isInteger(n) && n >= 1 && n <= MAX_SESSIONS && String(n) === id;
}
/** 去重、校验、按编号排序 */
function normalizeSessionOrder(raw) {
    const arr = Array.isArray(raw) ? raw : [];
    const ids = arr.map((x) => String(x)).filter(isValidSessionId);
    const unique = [...new Set(ids)];
    unique.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    return unique;
}
function readSessionOrder(context) {
    const stored = normalizeSessionOrder(context.workspaceState.get(GLOBAL_STATE_SESSION_ORDER_KEY));
    if (stored.length > 0)
        return stored;
    return [...DEFAULT_SESSION_ORDER];
}
function readSessionMemos(context) {
    const raw = context.workspaceState.get(GLOBAL_STATE_SESSION_MEMOS_KEY);
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
        return {};
    const out = {};
    for (const [k, v] of Object.entries(raw)) {
        if (!isValidSessionId(k))
            continue;
        const s = String(v ?? "")
            .trim()
            .slice(0, MAX_SESSION_MEMO_CHARS);
        if (s)
            out[k] = s;
    }
    return out;
}
function readSessionDrafts(context) {
    const raw = context.workspaceState.get(GLOBAL_STATE_DRAFTS_KEY);
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
        return {};
    const out = {};
    for (const [k, v] of Object.entries(raw)) {
        if (!isValidSessionId(k))
            continue;
        const s = String(v ?? "").slice(0, 4000);
        if (s)
            out[k] = s;
    }
    return out;
}
function readLastWorkspacePath(context) {
    const raw = context.workspaceState.get(GLOBAL_STATE_LAST_WORKSPACE_PATH_KEY);
    return typeof raw === "string" ? raw.trim() : "";
}
function readManagedWorkspaceRegistry() {
    try {
        if (!fs.existsSync(MANAGED_WORKSPACES_REGISTRY_PATH))
            return [];
        const raw = fs.readFileSync(MANAGED_WORKSPACES_REGISTRY_PATH, "utf-8");
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return [];
        return [...new Set(parsed.map((x) => String(x ?? "").trim()).filter(Boolean))];
    }
    catch {
        return [];
    }
}
function writeManagedWorkspaceRegistry(paths) {
    const next = [...new Set((Array.isArray(paths) ? paths : []).map((x) => String(x ?? "").trim()).filter(Boolean))];
    const dir = path.dirname(MANAGED_WORKSPACES_REGISTRY_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(MANAGED_WORKSPACES_REGISTRY_PATH, JSON.stringify(next, null, 2), "utf-8");
}
function rememberManagedWorkspace(workspacePath) {
    const target = String(workspacePath ?? "").trim();
    if (!target)
        return;
    const current = readManagedWorkspaceRegistry();
    current.push(target);
    writeManagedWorkspaceRegistry(current);
}
function normalizeHistoryMessageType(type) {
    return type === "cursor" || type === "system" ? type : "user";
}
function trimSessionHistoryItems(items) {
    if (!Array.isArray(items))
        return [];
    if (items.length <= MAX_SESSION_HISTORY_ITEMS)
        return items;
    return items.slice(items.length - MAX_SESSION_HISTORY_ITEMS);
}
function normalizePersistedSessionHistories(raw) {
    let parsed = raw;
    if (typeof raw === "string") {
        try {
            parsed = JSON.parse(raw);
        }
        catch {
            parsed = {};
        }
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return {};
    }
    const out = {};
    for (const [sid, rows] of Object.entries(parsed)) {
        if (!isValidSessionId(sid) || !Array.isArray(rows))
            continue;
        const nextRows = [];
        for (const row of rows) {
            if (!row || typeof row !== "object")
                continue;
            const o = row;
            let time = new Date().toISOString();
            if (typeof o.time === "string" || typeof o.time === "number") {
                const t = new Date(o.time);
                if (!Number.isNaN(t.getTime())) {
                    time = t.toISOString();
                }
            }
            nextRows.push({
                type: normalizeHistoryMessageType(o.type),
                content: String(o.content ?? ""),
                time,
            });
        }
        out[sid] = trimSessionHistoryItems(nextRows);
    }
    return out;
}
function serializePersistedSessionHistories(raw) {
    return JSON.stringify(normalizePersistedSessionHistories(raw));
}
async function clearPersistedSessionArtifacts(context, sessionId) {
    const histories = normalizePersistedSessionHistories(context.workspaceState.get(GLOBAL_STATE_SESSION_KEY));
    if (histories[sessionId]) {
        delete histories[sessionId];
        await context.workspaceState.update(GLOBAL_STATE_SESSION_KEY, JSON.stringify(histories));
    }
    const memos = readSessionMemos(context);
    if (memos[sessionId]) {
        delete memos[sessionId];
        await context.workspaceState.update(GLOBAL_STATE_SESSION_MEMOS_KEY, memos);
    }
}
function clearSessionQueueDir(sessionId) {
    if (!isValidSessionId(sessionId))
        return;
    const sessionDir = path.join(MESSAGE_QUEUE_ROOT_DIR, "s", sessionId);
    if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
    }
}
function ensureQueueRootDir() {
    if (!fs.existsSync(MESSAGE_QUEUE_ROOT_DIR)) {
        fs.mkdirSync(MESSAGE_QUEUE_ROOT_DIR, { recursive: true });
    }
}
function getSessionRuntimePaths(sessionId) {
    const sessionDir = path.join(MESSAGE_QUEUE_ROOT_DIR, "s", sessionId);
    return {
        sessionDir,
        queuePath: path.join(sessionDir, "messages.json"),
        replyPath: path.join(sessionDir, "reply.json"),
        heartbeatPath: path.join(sessionDir, "heartbeat.json"),
        aiDonePath: path.join(sessionDir, "ai_done.json"),
    };
}
function readJsonFileSafe(filePath, fallback) {
    try {
        if (!fs.existsSync(filePath))
            return fallback;
        return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
    catch {
        return fallback;
    }
}
function writeJsonFileSafe(filePath, data) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}
function ensureRuntimeConfig() {
    ensureQueueRootDir();
    const existing = readJsonFileSafe(RUNTIME_CONFIG_PATH, {});
    const next = {
        heartbeatIntervalMs: DEFAULT_HEARTBEAT_INTERVAL_MS,
        keepaliveTimeoutMs: DEFAULT_KEEPALIVE_TIMEOUT_MS,
        ...((existing && typeof existing === "object" && !Array.isArray(existing)) ? existing : {}),
    };
    writeJsonFileSafe(RUNTIME_CONFIG_PATH, next);
    return next;
}
function primeSessionRuntimeState(sessionId) {
    if (!isValidSessionId(sessionId))
        return;
    const paths = getSessionRuntimePaths(sessionId);
    const now = new Date().toISOString();
    ensureRuntimeConfig();
    writeJsonFileSafe(paths.heartbeatPath, {
        sessionId,
        status: "idle",
        updatedAt: now,
        source: "sidechat-sidebar",
    });
    writeJsonFileSafe(paths.aiDonePath, {
        sessionId,
        status: "idle",
        done: true,
        updatedAt: now,
        source: "sidechat-sidebar",
    });
}
function markSessionQueued(sessionId) {
    if (!isValidSessionId(sessionId))
        return;
    const paths = getSessionRuntimePaths(sessionId);
    const now = new Date().toISOString();
    writeJsonFileSafe(paths.aiDonePath, {
        sessionId,
        status: "queued",
        done: false,
        updatedAt: now,
        source: "sidechat-sidebar",
    });
}
function readSessionRuntimeSnapshot(sessionId) {
    if (!isValidSessionId(sessionId))
        return null;
    const paths = getSessionRuntimePaths(sessionId);
    const heartbeat = readJsonFileSafe(paths.heartbeatPath, null);
    const aiDone = readJsonFileSafe(paths.aiDonePath, null);
    const queue = readJsonFileSafe(paths.queuePath, { messages: [] });
    const queueSize = Array.isArray(queue?.messages) ? queue.messages.length : 0;
    let state = "idle";
    const now = Date.now();
    const heartbeatTime = heartbeat?.updatedAt ? new Date(heartbeat.updatedAt).getTime() : 0;
    const heartbeatFresh = heartbeatTime > 0 && now - heartbeatTime <= HEARTBEAT_STALE_AFTER_MS;
    if (queueSize > 0) {
        state = "queued";
    }
    if (aiDone?.status === "processing" || aiDone?.done === false) {
        state = aiDone?.status === "queued" ? "queued" : "processing";
    }
    if (heartbeatFresh && heartbeat?.status === "polling" && state === "idle") {
        state = "connected";
    }
    if (heartbeatFresh && heartbeat?.status === "processing") {
        state = "processing";
    }
    return {
        sessionId,
        state,
        queueSize,
        heartbeatAt: heartbeat?.updatedAt || "",
        aiDoneAt: aiDone?.updatedAt || "",
        heartbeatFresh,
        replyAt: aiDone?.lastReplyAt || "",
        lastMessageAt: aiDone?.lastMessageAt || "",
    };
}
exports.normalizeWorkspacePath = normalizeWorkspacePath;
exports.workspaceHash = workspaceHash;
exports.getQueueRootForWorkspace = getQueueRootForWorkspace;
Object.defineProperty(exports, "MESSAGE_QUEUE_ROOT_DIR", {
    get() {
        return MESSAGE_QUEUE_ROOT_DIR;
    },
    enumerable: true,
    configurable: true,
});
Object.defineProperty(exports, "RUNTIME_CONFIG_PATH", {
    get() {
        return RUNTIME_CONFIG_PATH;
    },
    enumerable: true,
    configurable: true,
});
exports.setActiveWorkspace = setActiveWorkspace;
exports.isValidSessionId = isValidSessionId;
exports.normalizeSessionOrder = normalizeSessionOrder;
exports.readSessionOrder = readSessionOrder;
exports.readSessionMemos = readSessionMemos;
exports.readSessionDrafts = readSessionDrafts;
exports.readLastWorkspacePath = readLastWorkspacePath;
exports.readManagedWorkspaceRegistry = readManagedWorkspaceRegistry;
exports.writeManagedWorkspaceRegistry = writeManagedWorkspaceRegistry;
exports.rememberManagedWorkspace = rememberManagedWorkspace;
exports.normalizeHistoryMessageType = normalizeHistoryMessageType;
exports.trimSessionHistoryItems = trimSessionHistoryItems;
exports.normalizePersistedSessionHistories = normalizePersistedSessionHistories;
exports.serializePersistedSessionHistories = serializePersistedSessionHistories;
exports.clearPersistedSessionArtifacts = clearPersistedSessionArtifacts;
exports.clearSessionQueueDir = clearSessionQueueDir;
exports.ensureQueueRootDir = ensureQueueRootDir;
exports.getSessionRuntimePaths = getSessionRuntimePaths;
exports.readJsonFileSafe = readJsonFileSafe;
exports.writeJsonFileSafe = writeJsonFileSafe;
exports.ensureRuntimeConfig = ensureRuntimeConfig;
exports.primeSessionRuntimeState = primeSessionRuntimeState;
exports.markSessionQueued = markSessionQueued;
exports.readSessionRuntimeSnapshot = readSessionRuntimeSnapshot;
