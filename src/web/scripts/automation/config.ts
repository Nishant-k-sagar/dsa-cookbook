import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const cwd = process.cwd();
let envPath: string;

if (cwd.endsWith('src/web') || cwd.endsWith('src\\web')) {
  envPath = path.join(cwd, '.env');
} else {
  envPath = path.join(cwd, 'src/web/.env');
}

if (!fs.existsSync(envPath)) {
  const altPath = path.join(cwd, '.env');
  if (fs.existsSync(altPath)) {
    envPath = altPath;
  }
}

console.log('Loading env from:', envPath);
dotenv.config({ path: envPath });

export interface Config {
  mistralApiKey: string | null;
  mistralModel: string;
  leetCodeSession: string | null;
  cosmosEndpoint: string | null;
  cosmosKey: string | null;
  cosmosDatabase: string;
}

function getOptionalEnvVar(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

export const config: Config = {
  mistralApiKey: getOptionalEnvVar('MISTRAL_API_KEY', '') || null,
  mistralModel: getOptionalEnvVar('MISTRAL_MODEL', 'mistral-large-latest'),
  leetCodeSession: getOptionalEnvVar('LEETCODE_SESSION', '') || null,
  cosmosEndpoint: getOptionalEnvVar('COSMOS_ENDPOINT', '') || null,
  cosmosKey: getOptionalEnvVar('COSMOS_KEY', '') || null,
  cosmosDatabase: getOptionalEnvVar('COSMOS_DATABASE', 'dsa-cookbook'),
};

export const CACHE_DIR = '.leetcode-cache';
export const CACHE_TTL_HOURS = 24;
export const RATE_LIMIT_MS = 1000;
export const MISTRAL_MAX_TOKENS = 32000;
export const MISTRAL_TEMPERATURE = 0.3;