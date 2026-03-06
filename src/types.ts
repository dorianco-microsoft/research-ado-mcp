export interface AdoSearchResponse {
  count: number;
  results: AdoSearchResult[];
  infoCode: number;
}

export interface AdoSearchResult {
  fileName: string;
  path: string;
  matches: {
    content: AdoMatchContent[];
    fileName: AdoMatchFileName[];
  };
  collection: { name: string };
  project: { name: string; id: string };
  repository: { name: string; id: string; type: string };
  versions: { branchName: string; changeId: string }[];
  contentId: string;
}

export interface AdoMatchContent {
  charOffset: number;
  length: number;
  line: number;
  column: number;
  codeSnippet: string | null;
  type: string;
}

export interface AdoMatchFileName {
  charOffset: number;
  length: number;
  line: number;
  column: number;
}

export interface AdoIndexedBranch {
  name: string;
  lastIndexedChangeId: string;
  lastProcessedTime: string;
}

export interface AdoSearchStatusResponse {
  id: string;
  name: string;
  indexedBranches: AdoIndexedBranch[];
}
