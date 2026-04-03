import { CosmosClient, Container, Database } from '@azure/cosmos';
import type { ItemDefinition, SqlParameter, JSONValue } from '@azure/cosmos';
import { config } from './config.js';

export interface CosmosConfig {
  endpoint: string;
  key: string;
  databaseName: string;
}

let cosmosClient: CosmosClient | null = null;
let database: Database | null = null;

export function getCosmosConfig(): CosmosConfig {
  if (!config.cosmosEndpoint || !config.cosmosKey) {
    throw new Error('Missing Cosmos DB configuration. Check COSMOS_ENDPOINT and COSMOS_KEY');
  }
  return {
    endpoint: config.cosmosEndpoint,
    key: config.cosmosKey,
    databaseName: config.cosmosDatabase || 'dsa-cookbook',
  };
}

function getClient(config: CosmosConfig): CosmosClient {
  if (!cosmosClient) {
    cosmosClient = new CosmosClient({
      endpoint: config.endpoint,
      key: config.key,
    });
  }
  return cosmosClient;
}

export async function getDatabase(config: CosmosConfig): Promise<Database> {
  if (!database) {
    const client = getClient(config);
    database = client.database(config.databaseName);
  }
  return database;
}

export async function getContainer(config: CosmosConfig, containerName: string): Promise<Container> {
  const db = await getDatabase(config);
  return db.container(containerName);
}

export async function queryDocuments<T>(
  config: CosmosConfig,
  containerName: string,
  query: string,
  parameters?: { name: string; value: JSONValue }[]
): Promise<T[]> {
  const container = await getContainer(config, containerName);
  const { resources } = await container.items.query<T>({
    query,
    parameters: (parameters || []) as SqlParameter[],
  }).fetchAll();
  return resources;
}

export async function getDocument<T extends ItemDefinition>(
  config: CosmosConfig,
  containerName: string,
  id: string,
  partitionKey: string
): Promise<T | null> {
  try {
    const container = await getContainer(config, containerName);
    const { resource } = await container.item(id, partitionKey).read<T>();
    return resource || null;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 404) {
      return null;
    }
    throw error;
  }
}

export async function upsertDocument<T extends ItemDefinition>(
  config: CosmosConfig,
  containerName: string,
  document: T
): Promise<T> {
  const container = await getContainer(config, containerName);
  const { resource } = await container.items.upsert<T>(document);
  return resource!;
}

export async function createDocument<T extends ItemDefinition>(
  config: CosmosConfig,
  containerName: string,
  document: T
): Promise<T> {
  const container = await getContainer(config, containerName);
  const { resource } = await container.items.create<T>(document);
  return resource!;
}

export async function deleteDocument(
  config: CosmosConfig,
  containerName: string,
  id: string,
  partitionKey: string
): Promise<void> {
  const container = await getContainer(config, containerName);
  await container.item(id, partitionKey).delete();
}