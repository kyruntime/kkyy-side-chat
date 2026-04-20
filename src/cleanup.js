"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const childProcess = require("child_process");
const homedir = os.homedir();
const cursorRoot = path.join(homedir, ".cursor");
const managedWorkspaceRegistryPath = path.join(cursorRoot, "sidechat-managed-workspaces.json");
const managedServerDir = path.join(cursorRoot, "sidechat-server");
const managedMessagesDir = path.join(cursorRoot, "sidechat-messages");
const managedRuleFileName = "sidechat.mdc";
const managedMcpKey = /^sidechat-\d+$/;
const extensionStateKeys = [
    "kkyy.sidechat",
    "workbench.view.extension.sidechat.state.hidden",
];
function readManagedWorkspaces() {
    try {
        if (!fs.existsSync(managedWorkspaceRegistryPath))
            return [];
        const raw = fs.readFileSync(managedWorkspaceRegistryPath, "utf-8");
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return [];
        return [...new Set(parsed.map((x) => String(x ?? "").trim()).filter(Boolean))];
    }
    catch {
        return [];
    }
}
function safeRemove(targetPath, removedItems) {
    try {
        if (fs.existsSync(targetPath)) {
            fs.rmSync(targetPath, { recursive: true, force: true });
            if (removedItems)
                removedItems.push(targetPath);
        }
    }
    catch {
    }
}
function getCursorStateDbPath() {
    if (process.platform === "darwin") {
        return path.join(homedir, "Library", "Application Support", "Cursor", "User", "globalStorage", "state.vscdb");
    }
    if (process.platform === "win32") {
        const appData = process.env.APPDATA || path.join(homedir, "AppData", "Roaming");
        return path.join(appData, "Cursor", "User", "globalStorage", "state.vscdb");
    }
    return path.join(homedir, ".config", "Cursor", "User", "globalStorage", "state.vscdb");
}
function escapeSqlString(value) {
    return String(value).replace(/'/g, "''");
}
function cleanupExtensionStateDb(removedItems) {
    const dbPath = getCursorStateDbPath();
    if (!fs.existsSync(dbPath))
        return;
    const quotedKeys = extensionStateKeys.map((key) => `'${escapeSqlString(key)}'`).join(", ");
    const sql = `DELETE FROM ItemTable WHERE key IN (${quotedKeys});`;
    try {
        childProcess.execFileSync("sqlite3", [dbPath, sql], { stdio: "ignore" });
        if (removedItems)
            removedItems.push(`${dbPath} :: ${extensionStateKeys.join(", ")}`);
    }
    catch {
    }
}
function cleanupWorkspace(workspacePath, removedItems) {
    try {
        const cursorDir = path.join(workspacePath, ".cursor");
        const mcpPath = path.join(cursorDir, "mcp.json");
        if (fs.existsSync(mcpPath)) {
            let changed = false;
            let parsed = {};
            try {
                parsed = JSON.parse(fs.readFileSync(mcpPath, "utf-8"));
            }
            catch {
                parsed = {};
            }
            const currentServers = parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.mcpServers && typeof parsed.mcpServers === "object" && !Array.isArray(parsed.mcpServers)
                ? { ...parsed.mcpServers }
                : {};
            if (Object.prototype.hasOwnProperty.call(currentServers, "sidechat")) {
                delete currentServers["sidechat"];
                changed = true;
            }
            for (const key of Object.keys(currentServers)) {
                if (managedMcpKey.test(key)) {
                    delete currentServers[key];
                    changed = true;
                }
            }
            if (changed) {
                if (Object.keys(currentServers).length === 0) {
                    safeRemove(mcpPath, removedItems);
                }
                else {
                    const next = { ...parsed, mcpServers: currentServers };
                    fs.writeFileSync(mcpPath, JSON.stringify(next, null, 2), "utf-8");
                    if (removedItems)
                        removedItems.push(`${mcpPath} :: sidechat-* removed`);
                }
            }
        }
        const rulesDir = path.join(cursorDir, "rules");
        safeRemove(path.join(rulesDir, managedRuleFileName), removedItems);
        try {
            if (fs.existsSync(rulesDir) && fs.readdirSync(rulesDir).length === 0) {
                safeRemove(rulesDir, removedItems);
            }
            if (fs.existsSync(cursorDir) && fs.readdirSync(cursorDir).length === 0) {
                safeRemove(cursorDir, removedItems);
            }
        }
        catch {
        }
    }
    catch {
    }
}
function cleanupSideChatArtifacts() {
    const removedItems = [];
    for (const workspacePath of readManagedWorkspaces()) {
        cleanupWorkspace(workspacePath, removedItems);
    }
    cleanupExtensionStateDb(removedItems);
    safeRemove(managedServerDir, removedItems);
    safeRemove(managedMessagesDir, removedItems);
    safeRemove(managedWorkspaceRegistryPath, removedItems);
    return removedItems;
}
module.exports = {
    cleanupSideChatArtifacts,
    readManagedWorkspaces,
};
