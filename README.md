# research-ado-mcp

An MCP (Model Context Protocol) server that exposes Azure DevOps code search and repository browsing capabilities. Designed to be used with GitHub Copilot CLI or any MCP-compatible client.

## Tools

| Tool | Description |
|------|-------------|
| `ado_search_code` | Full-text code search across Azure DevOps repositories. Supports ADO query filters like `ext:`, `file:`, `path:`, `class:`, `method:`, `def:`, `ref:`, etc. |
| `ado_get_file_content` | Retrieve file content from an ADO Git repository by path, branch, or commit. |
| `ado_detect_context` | Detect organization, project, repository, and branch from a local git repo's ADO remote URL. |
| `ado_get_search_status` | Check which branches are indexed for search in a repository. |

## Prerequisites

- **Node.js** ≥ 18
- **Azure CLI** installed ([Install the Azure CLI](https:/learn.microsoft.com/en-us/cli/azure/install-azure-cli))
- An **Azure DevOps** account with access to the organization you want to search

## Setup (Step by Step)

### Step 1 — Install Azure CLI

If you don't already have it, install the Azure CLI:

- **Windows:** `winget install -e --id Microsoft.AzureCLI`
- **macOS:** `brew install azure-cli`
- **Linux:** `curl -sL https:/aka.ms/InstallAzureCLIDeb | sudo bash`

Verify the installation:

```bash
az --version
```

### Step 2 — Sign in with Azure CLI

Log in to Azure with your Microsoft account that has access to Azure DevOps:

```bash
az login
```

This opens your browser for authentication. Once signed in, your session is cached locally and the MCP server will use it to authenticate API calls.

> **Tip:** If your account belongs to multiple tenants, specify your organization's tenant:
>
> ```bash
> az login --tenant YOUR_TENANT_ID
> ```

You can verify your session is active at any time:

```bash
az account show
```

### Step 3 — Clone the repository and install dependencies

> **Recommended:** Keep all your MCP servers under `C:/mcp/` for easy management.

```bash
cd C:/mcp
git clone https://github.com/dorianco-microsoft/research-ado-mcp.git
cd research-ado-mcp
npm install
```

### Step 4 — Add the MCP server to GitHub Copilot CLI

Open Copilot CLI and use the `/mcp` slash command:

```
/mcp add
```

Fill in the fields (use `Tab` to move between them):

| Field | Value |
|-------|-------|
| **Name** | `research-ado` |
| **Type** | `stdio` |
| **Command** | `npm` |
| **Args** | `start` |

> **Note:** Set the working directory to where you cloned the repository.

Press `Ctrl+S` to save.

Alternatively, manually edit `~/.copilot/mcp-config.json`:

```json
{
  "mcpServers": {
    "research-ado": {
      "type": "stdio",
      "command": "npm",
      "tools": ["*"],
      "args": ["start"],
      "cwd": "C:/mcp/research-ado-mcp"
    }
  }
}
```

### Step 5 — Verify

Restart your Copilot CLI session (or run `/mcp` to check status). You should see `research-ado` listed with status `✓ Connected`.

> [!IMPORTANT]
> **The agent won't use the MCP tools automatically.** You must explicitly instruct it to prefer MCP-based search over local tools. Add the following instruction at the start of your session (or in your custom instructions / `COPILOT.md`):
>
> ```
> This project is too large to search locally. Always use the `research-ado` MCP tools
> (ado_search_code, ado_get_file_content, etc.) to perform code search and file retrieval
> instead of local search tools like grep or glob.
> ```
>
> Without this, the agent will default to local search tools which cannot reach Azure DevOps repositories.

Once the context is clear, try a search:

```
Find all usages of `SomeClass` in the ADO repository
```

## Refreshing Authentication

Your `az login` session expires periodically. If you see authentication errors, simply run:

```bash
az login
```

Then restart your Copilot CLI session.
