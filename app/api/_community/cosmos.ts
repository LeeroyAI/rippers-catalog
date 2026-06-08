import { CosmosClient, type Container } from "@azure/cosmos";

/**
 * Lazy Cosmos client + container accessors for the community layer. Reads
 * COSMOS_ENDPOINT / COSMOS_KEY / COSMOS_DATABASE from the environment (set in
 * App Service config and .env.local). Throws a clear error if unconfigured so
 * routes can return a tidy 503 rather than crash.
 */

let client: CosmosClient | null = null;

export class CommunityNotConfiguredError extends Error {
  constructor() {
    super("Community backend is not configured (missing Cosmos env).");
    this.name = "CommunityNotConfiguredError";
  }
}

export function communityConfigured(): boolean {
  return Boolean(process.env.COSMOS_ENDPOINT && process.env.COSMOS_KEY && process.env.COSMOS_DATABASE);
}

function getClient(): CosmosClient {
  if (!communityConfigured()) throw new CommunityNotConfiguredError();
  if (!client) {
    client = new CosmosClient({
      endpoint: process.env.COSMOS_ENDPOINT as string,
      key: process.env.COSMOS_KEY as string,
    });
  }
  return client;
}

function container(name: string): Container {
  return getClient().database(process.env.COSMOS_DATABASE as string).container(name);
}

export const containers = {
  users: () => container("users"),
  presence: () => container("presence"),
  reports: () => container("reports"),
  authCodes: () => container("authcodes"),
};
