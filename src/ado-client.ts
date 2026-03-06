import { getAuthHeader } from "./auth.js";
import type {
  AdoSearchResponse,
  AdoSearchStatusResponse
} from "./types.js";

const log = (...args: unknown[]) =>
  console.error("[research-ado-mcp:client]", ...args);

// ── Generic HTTP helpers ──────────────────────────────────────────────

async function adoFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const authHeader = await getAuthHeader();

  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
      ...init?.headers
    }
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Azure DevOps API ${response.status} ${response.statusText}: ${body}`
    );
  }

  return response.json() as Promise<T>;
}

async function adoFetchText(url: string): Promise<string> {
  const authHeader = await getAuthHeader();

  const response = await fetch(url, {
    headers: { Authorization: authHeader }
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Azure DevOps API ${response.status} ${response.statusText}: ${body}`
    );
  }

  return response.text();
}

// ── Code Search ───────────────────────────────────────────────────────

export interface SearchCodeParams {
  organization: string;
  query: string;
  project?: string;
  repository?: string;
  branch?: string;
  path?: string;
  top?: number;
  skip?: number;
}

export async function searchCode(
  params: SearchCodeParams
): Promise<AdoSearchResponse> {
  const url = `https://almsearch.dev.azure.com/${params.organization}/_apis/search/codesearchresults?api-version=5.0-preview.1`;

  const filters: Record<string, string[]> = {};
  if (params.project) filters.Project = [params.project];
  if (params.repository) filters.Repository = [params.repository];
  if (params.branch)
    filters.Branch = [params.branch.replace("refs/heads/", "")];
  if (params.path && params.repository) filters.Path = [params.path];

  const body = {
    searchText: params.query,
    $skip: params.skip ?? 0,
    $top: Math.min(params.top ?? 25, 1000),
    filters,
    $orderBy: [],
    includeFacets: false
  };

  log(`Searching: "${params.query}" in ${params.organization}`);
  return adoFetch<AdoSearchResponse>(url, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

// ── File Content ──────────────────────────────────────────────────────

export interface GetFileContentParams {
  organization: string;
  project: string;
  repositoryId: string;
  path: string;
  branch?: string;
  commitId?: string;
}

export async function getFileContent(
  params: GetFileContentParams
): Promise<string> {
  const versionType = params.commitId ? "commit" : "branch";
  const version =
    params.commitId ||
    params.branch?.replace("refs/heads/", "") ||
    "main";

  const url = new URL(
    `https://dev.azure.com/${params.organization}/${params.project}/_apis/git/repositories/${params.repositoryId}/items`
  );
  url.searchParams.set("path", params.path);
  url.searchParams.set("versionDescriptor.version", version);
  url.searchParams.set("versionDescriptor.versionType", versionType);
  url.searchParams.set("$format", "text");
  url.searchParams.set("api-version", "7.0");

  log(`Fetching file: ${params.path} from ${params.repositoryId}`);
  return adoFetchText(url.toString());
}

// ── Search Index Status ───────────────────────────────────────────────

export async function getSearchStatus(
  organization: string,
  project: string,
  repositoryId: string
): Promise<AdoSearchStatusResponse> {
  return adoFetch<AdoSearchStatusResponse>(
    `https://almsearch.dev.azure.com/${organization}/${project}/_apis/search/status/repositories/${repositoryId}?api-version=6.0-preview.1`
  );
}
