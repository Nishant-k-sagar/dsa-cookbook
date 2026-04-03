import fs from 'fs';
import path from 'path';
import { createLeetCodeClient } from './leetCodeClient.js';
import type { LeetCodeProblemSummary } from './types.js';

interface MetadataProblem {
  id: number;
  slug: string;
  title: string;
  difficulty: LeetCodeProblemSummary['difficulty'];
  tags: string[];
  paidOnly: boolean;
  totalAccepted: number;
  totalSubmitted: number;
  acceptanceRate: number;
  frequency: number;
}

interface MetadataSnapshot {
  schemaVersion: number;
  generatedAt: string;
  count: number;
  problems: MetadataProblem[];
}

const OUTPUT_FILE = 'leetcode-metadata.json';
const CACHE_DIR = '.leetcode-cache';

function toNumber(value: number | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }
  return value;
}

function normalizeProblem(problem: LeetCodeProblemSummary): MetadataProblem {
  return {
    id: problem.id,
    slug: problem.slug,
    title: problem.title,
    difficulty: problem.difficulty,
    tags: Array.isArray(problem.tags) ? problem.tags : [],
    paidOnly: Boolean(problem.paidOnly),
    totalAccepted: toNumber(problem.totalAccepted),
    totalSubmitted: toNumber(problem.totalSubmitted),
    acceptanceRate: toNumber(problem.acceptanceRate),
    frequency: toNumber(problem.frequency),
  };
}

async function main(): Promise<void> {
  const client = createLeetCodeClient();
  const problems = await client.fetchProblemList();
  const normalized = problems.map(normalizeProblem).sort((a, b) => a.slug.localeCompare(b.slug));

  const snapshot: MetadataSnapshot = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    count: normalized.length,
    problems: normalized,
  };

  const cacheDir = path.join(process.cwd(), CACHE_DIR);
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const outputPath = path.join(cacheDir, OUTPUT_FILE);
  fs.writeFileSync(outputPath, JSON.stringify(snapshot, null, 2));

  console.log(`LeetCode metadata cache written: ${outputPath}`);
  console.log(`Problems: ${snapshot.count}`);
}

main().catch((error) => {
  console.error('Failed to build LeetCode metadata cache');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

