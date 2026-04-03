import fs from 'fs';
import path from 'path';
import { getCosmosConfig, queryDocuments, deleteDocument } from './cosmosClient.js';

interface Back4AppRecord {
  id: string;
  objectId: string;
  slug?: string;
  title?: string;
  topicSlug?: string;
}

function getSeedsDir(): string {
  const cwdDir = path.join(process.cwd(), 'seeds');
  if (fs.existsSync(cwdDir)) {
    return cwdDir;
  }
  return path.join(process.cwd(), 'src/web', 'seeds');
}

async function deleteProblemsFromSeed(topicSlug: string): Promise<number> {
  const cosmosConfig = getCosmosConfig();
  const seedsDir = getSeedsDir();
  const seedPath = path.join(seedsDir, `${topicSlug}.json`);

  if (!fs.existsSync(seedPath)) {
    console.error(`Seed file not found: ${seedPath}`);
    process.exit(1);
  }

  console.log(`\n=== Deleting problems from seed for topic: ${topicSlug} ===`);

  const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
  const seedProblems = seedData.problems || [];

  console.log(`Found ${seedProblems.length} problems in seed file`);

  let deletedCount = 0;
  for (const seedProblem of seedProblems) {
    const slug = seedProblem.slug;
    
    // Query CosmosDB for this specific problem
    const problems = await queryDocuments<Back4AppRecord>(
      cosmosConfig,
      'problems',
      'SELECT c.id, c.slug, c.title FROM c WHERE c.slug = @slug AND c.topicSlug = @topicSlug',
      [
        { name: '@slug', value: slug },
        { name: '@topicSlug', value: topicSlug }
      ]
    );

    if (problems.length === 0) {
      console.log(`  -> Skipping: ${seedProblem.title} (not found in CosmosDB)`);
      continue;
    }

    for (const problem of problems) {
      try {
        await deleteDocument(cosmosConfig, 'problems', problem.id, topicSlug);
        deletedCount++;
        console.log(`  -> Deleted: ${problem.title || problem.slug}`);
      } catch (error) {
        console.error(`  -> Failed to delete: ${problem.title || problem.slug}`, error);
      }
    }
  }

  return deletedCount;
}

async function main() {
  const args = process.argv.slice(2);
  const topicArg = args.find(arg => arg.startsWith('--topic='));
  const allArg = args.includes('--all');

  if (!topicArg && !allArg) {
    console.error('Usage:');
    console.error('  npx tsx deleteFromCosmos.ts --topic=<topic-slug>');
    console.error('  npx tsx deleteFromCosmos.ts --all');
    process.exit(1);
  }

  if (allArg) {
    console.error('--all flag is not supported for safety. Please specify a topic.');
    process.exit(1);
  }

  if (topicArg) {
    const topicSlug = topicArg.replace('--topic=', '');
    const deletedCount = await deleteProblemsFromSeed(topicSlug);
    console.log(`\n=== Deletion Complete ===`);
    console.log(`Deleted ${deletedCount} problems from seed for topic: ${topicSlug}`);
  }
}

main();