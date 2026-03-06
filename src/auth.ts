import { AzureCliCredential, type AccessToken } from "@azure/identity";

const ADO_RESOURCE_ID = "499b84ac-1321-427f-aa17-267ca6975798";
const ADO_SCOPE = `${ADO_RESOURCE_ID}/.default`;

const log = (...args: unknown[]) =>
  console.error("[research-ado-mcp:auth]", ...args);

let credential: AzureCliCredential | null = null;

// Prevents concurrent auth attempts from racing.
let pendingTokenRequest: Promise<string> | null = null;

async function acquireToken(): Promise<string> {
  if (!credential) {
    log("Using Azure CLI credential (az login)");
    credential = new AzureCliCredential();
  }

  const token: AccessToken | null = await credential.getToken(ADO_SCOPE);
  if (!token) {
    throw new Error(
      "Failed to acquire Azure DevOps access token. " +
        "Make sure you are logged in with: az login"
    );
  }

  return `Bearer ${token.token}`;
}

/**
 * Returns an Authorization header value for Azure DevOps API calls.
 * Uses Azure CLI (`az login` session) — no PAT, no app registration.
 * Concurrent calls are deduplicated so only one token request runs at a time.
 */
export async function getAuthHeader(): Promise<string> {
  // Deduplicate concurrent requests
  if (pendingTokenRequest) {
    return pendingTokenRequest;
  }

  pendingTokenRequest = acquireToken().finally(() => {
    pendingTokenRequest = null;
  });

  return pendingTokenRequest;
}
