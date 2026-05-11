# AGENTS.md

This repository is the SideChat VS Code/Cursor extension.

## Project Overview

- SideChat adds a Cursor sidebar chat panel that communicates with Cursor Agent through MCP.
- The extension source lives in `src/`; runtime entrypoint is `dist/extension.js`.
- `src/extension.js` handles VS Code activation, webview setup, workspace MCP config, and message queue writes.
- `src/session.js` manages session order, drafts, memos, runtime state, and queue paths under `~/.cursor/sidechat-messages`.
- `src/webview-html.js`, `src/webview-css.js`, and `src/webview-script.js` build the sidebar UI.
- `mcp-server/index.mjs` is the standalone MCP stdio server used by Cursor. It is packaged directly into the VSIX and is not compiled by `tsc`.
- `resources/icon.svg` is the activity bar icon.

## Build Notes

- Run `npm run compile` after changing anything in `src/`; the extension loads compiled files from `dist/`.
- Run `node --check mcp-server/index.mjs` after changing the MCP server.
- `npm run package` creates a VSIX via `vsce package --no-dependencies`.
- VSIX files are ignored by `.gitignore`, but official release artifacts are intentionally committed with `git add -f`.

## Release Workflow

When the user says any of the following:

- "部署发布"
- "编译打包发布"
- "发一个新版本"
- "release"
- "publish"

first read `发布检测部署.md`, then follow its complete release checklist.

The expected full release includes:

1. Check git state, remote, current branch, and `gh auth status`.
2. Bump the patch version unless the user specifies another version.
3. Compile and validate.
4. Package and rename the VSIX as `sidechat-<version>-<YYYYMMDD>.vsix`.
5. Verify VSIX metadata and SHA256.
6. Commit source/version changes.
7. Force-add and commit the VSIX artifact.
8. Create annotated tag `v<version>` on the commit containing the VSIX.
9. Push `main` and the tag.
10. Create a GitHub Release, upload the VSIX asset, and mark it latest.
11. Report commit hashes, tag, release URL, VSIX download URL, and SHA256.

If the working tree contains mixed or unrelated changes, stop and confirm the intended scope before staging or committing.

## Git Safety

- Do not run destructive git commands unless explicitly requested.
- Do not silently include unrelated local changes in a release.
- Prefer explicit `git add <paths>` over `git add -A`.
- Keep release tags aligned with the commit that contains the matching VSIX.
