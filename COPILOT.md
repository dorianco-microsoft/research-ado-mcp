# reSearch ADO MCP Server

## Overview

This is an MCP (Model Context Protocol) server that exposes Azure DevOps code search and repository browsing to MCP-compatible clients like GitHub Copilot CLI. It authenticates via Azure CLI (`az login`) and communicates over stdio using JSON-RPC.

## Architecture

```
src/
├── index.ts        # MCP server entry point — registers tools, starts stdio transport
├── auth.ts         # Azure CLI credential management with request deduplication
├── ado-client.ts   # HTTP client for Azure DevOps REST APIs (search + file content)
└── types.ts        # TypeScript interfaces for ADO API responses
```

- **Transport:** stdio (JSON-RPC over stdin/stdout). All logging uses `console.error` (stderr) to avoid corrupting the protocol stream.
- **Auth:** `AzureCliCredential` from `@azure/identity`. Requires `az login` before use. Tokens are cached by the Azure CLI; concurrent requests are deduplicated in `auth.ts`.
- **APIs consumed:**
  - Code Search: `POST https://almsearch.dev.azure.com/{org}/_apis/search/codesearchresults`
  - File Content: `GET https://dev.azure.com/{org}/{project}/_apis/git/repositories/{repoId}/items`
  - Search Status: `GET https://almsearch.dev.azure.com/{org}/{project}/_apis/search/status/repositories/{repoId}`

## Tools Exposed

| Tool | Purpose |
|------|---------|
| `ado_search_code` | Full-text code search with ADO filter syntax (`ext:`, `class:`, `def:`, etc.) |
| `ado_get_file_content` | Fetch a file by repo ID, path, branch, or commit SHA |
| `ado_get_search_status` | Check which branches are search-indexed for a repository |
| `ado_detect_context` | Detect organization, project, repository, and branch from a local git repo's ADO remote |

## Tech Stack

- **Language:** TypeScript (strict mode, ES2022 target, Node16 module resolution)
- **Runtime:** Node.js ≥ 18, run via `tsx` (no compile step — TypeScript is executed directly)
- **Key dependencies:**
  - `@modelcontextprotocol/sdk` — MCP server framework
  - `@azure/identity` — Azure authentication (AzureCliCredential)
  - `zod` — Input schema validation for tool parameters
  - `tsx` — TypeScript runtime (dev dependency, used by `npm start` and `npm run dev`)

## Build & Run

```bash
npm install        # install dependencies
npm start          # run the MCP server (stdio mode) — executes src/index.ts via tsx
npm run dev        # watch mode for development (tsx --watch)
```

> **Note:** There is no build/compile step. The project runs TypeScript source directly using `tsx`. The `tsconfig.json` is used for IDE support and type checking only.

## Development Guidelines

- When adding a new tool, use `server.registerTool(name, config, callback)` in `index.ts` (the older `server.tool()` is deprecated).
- All tools should include `annotations: { readOnlyHint: true }` unless they perform write operations.
- HTTP calls go through the helpers in `ado-client.ts` (`adoFetch<T>` for JSON, `adoFetchText` for raw text). Auth is handled automatically.
- ADO API response types are defined in `types.ts`. Add new interfaces there when consuming new endpoints.
- Do not add alternative auth methods (PAT, browser, device-code). This project uses Azure CLI auth exclusively.
