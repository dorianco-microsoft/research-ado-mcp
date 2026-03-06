#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  searchCode,
  getFileContent,
  getSearchStatus
} from "./ado-client.js";

const execFileAsync = promisify(execFile);

// Logs go to stderr so they don't interfere with the JSON-RPC messages on stdout.
const log = (...args: unknown[]) =>
  console.error("[research-ado-mcp]", ...args);

const server = new McpServer({
  name: "research-ado-mcp",
  version: "1.0.0"
});

// ── Tool: Code Search ─────────────────────────────────────────────────

server.registerTool(
  "ado_search_code",
  {
    description:
      "Search for code across Azure DevOps repositories. " +
      "Supports ADO search filters: ext:, file:, path:, repo:, proj:, " +
      "class:, method:, def:, ref:, comment:, namespace:, type:, etc.",
    inputSchema: {
      organization: z
        .string()
        .describe("Azure DevOps organization name (e.g. 'microsoft')"),
      query: z
        .string()
        .describe(
          "Search query. Supports ADO code-search filters like ext:ts, file:index, class:MyClass, def:myFunction"
        ),
      project: z
        .string()
        .describe("Filter results to a specific project"),
      repository: z
        .string()
        .describe("Filter results to a specific repository name"),
      branch: z
        .string()
        .describe("Filter results to a specific branch"),
      path: z
        .string()
        .optional()
        .describe(
          "Filter results to a path prefix (only effective with a single repository filter)"
        ),
      top: z
        .number()
        .optional()
        .default(25)
        .describe("Maximum number of results (default 25, max 1000)")
    },
    annotations: { readOnlyHint: true }
  },
  async (params) => {
    try {
      const response = await searchCode(params);

      const results = response.results.map((r) => ({
        fileName: r.fileName,
        path: r.path,
        repository: r.repository.name,
        repositoryId: r.repository.id,
        project: r.project.name,
        branch: r.versions[0]?.branchName,
        commitId: r.versions[0]?.changeId,
        matchCount: r.matches.content.length,
        matches: r.matches.content.slice(0, 5).map((m) => ({
          line: m.line,
          column: m.column,
          snippet: m.codeSnippet,
          type: m.type
        }))
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { count: response.count, results },
              null,
              2
            )
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          { type: "text" as const, text: `Error: ${(error as Error).message}` }
        ],
        isError: true
      };
    }
  }
);

// ── Tool: Get File Content ────────────────────────────────────────────

server.registerTool(
  "ado_get_file_content",
  {
    description:
      "Retrieve the content of a file from an Azure DevOps Git repository. " +
      "Use repository IDs and paths from search results.",
    inputSchema: {
      organization: z.string().describe("Azure DevOps organization name"),
      project: z.string().describe("Project name"),
      repositoryId: z
        .string()
        .describe("Repository ID (GUID from search results)"),
      path: z.string().describe("Full file path (e.g. '/src/index.ts')"),
      branch: z
        .string()
        .optional()
        .describe("Branch name (defaults to 'main')"),
      commitId: z.string().optional().describe("Specific commit SHA")
    },
    annotations: { readOnlyHint: true }
  },
  async (params) => {
    try {
      const content = await getFileContent(params);
      return {
        content: [{ type: "text" as const, text: content }]
      };
    } catch (error) {
      return {
        content: [
          { type: "text" as const, text: `Error: ${(error as Error).message}` }
        ],
        isError: true
      };
    }
  }
);

// ── Tool: Search Index Status ─────────────────────────────────────────

server.registerTool(
  "ado_get_search_status",
  {
    description:
      "Get the search-index status for a repository, showing which branches " +
      "are indexed and when they were last processed.",
    inputSchema: {
      organization: z.string().describe("Azure DevOps organization name"),
      project: z.string().describe("Project name"),
      repositoryId: z.string().describe("Repository ID (GUID)")
    },
    annotations: { readOnlyHint: true }
  },
  async ({ organization, project, repositoryId }) => {
    try {
      const status = await getSearchStatus(organization, project, repositoryId);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(status, null, 2) }
        ]
      };
    } catch (error) {
      return {
        content: [
          { type: "text" as const, text: `Error: ${(error as Error).message}` }
        ],
        isError: true
      };
    }
  }
);

// ── Tool: Detect ADO Context from Git ─────────────────────────────────

const ADO_REMOTE_RE =
  /https:\/\/dev\.azure\.com\/(?<organization>[^/]+)\/(?<project>[^/]+)\/_git\/(?<repository>[^/\s]+)/;

server.registerTool(
  "ado_detect_context",
  {
    description:
      "Detect Azure DevOps organization, project, repository, and branch " +
      "from the git repository at the given working directory. " +
      "Parses the ADO remote URL and current branch so callers don't need " +
      "to supply these values manually.",
    inputSchema: {
      cwd: z
        .string()
        .describe("Absolute path to the working directory of a git repository")
    },
    annotations: { readOnlyHint: true }
  },
  async ({ cwd }) => {
    try {
      const [remoteResult, branchResult] = await Promise.all([
        execFileAsync("git", ["remote", "-v"], { cwd }),
        execFileAsync("git", ["branch", "--show-current"], { cwd })
      ]);

      const remoteMatch = remoteResult.stdout.match(ADO_REMOTE_RE);
      if (!remoteMatch?.groups) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: No Azure DevOps remote found. Expected a remote URL matching https://dev.azure.com/{org}/{project}/_git/{repo}"
            }
          ],
          isError: true
        };
      }

      const { organization, project, repository } = remoteMatch.groups;
      const branch = branchResult.stdout.trim();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { organization, project, repository, branch: branch || undefined },
              null,
              2
            )
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          { type: "text" as const, text: `Error: ${(error as Error).message}` }
        ],
        isError: true
      };
    }
  }
);

// ── Start ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("Server running on stdio");
}

main().catch((error) => {
  log("Fatal error:", error);
  process.exit(1);
});
