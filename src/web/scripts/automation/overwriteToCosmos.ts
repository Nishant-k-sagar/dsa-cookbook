import fs from 'fs';
import path from 'path';
import { config } from './config.js';
import { upsertDocument } from './cosmosClient.js';

interface GeneratedProblemContent {
  statement: string;
  constraints: string;
  examples: string;
  hints: string[];
  key_observations: string | string[];
  intuition: string;
  approach: string | string[];
  pseudocode: string | string[];
  pitfalls: string | string[];
  time_complexity?: string;
  space_complexity?: string;
  connection_to_subtopic: string;
}

interface GeneratedProblem {
  id: string;
  title: string;
  topic_id: string;
  leetcode_id: number;
  leetcode_slug: string;
  difficulty: string;
  time_complexity: string;
  space_complexity: string;
  pitfalls: string[];
  content: GeneratedProblemContent;
  code: {
    cpp: string;
    python?: string;
    java?: string;
  };
}

interface GeneratedTopicData {
  schemaVersion: number;
  topic: {
    id: string;
    title: string;
    summary: string;
    problemCount: number;
  };
  problems: GeneratedProblem[];
}

interface CosmosTopicDocument {
  id: string;
  topicId: string;
  slug: string;
  name: string;
  description: string;
  problemCount: number;
  solvedCount: number;
}

interface CosmosProblemDocument {
  id: string;
  slug: string;
  leetcodeId: number;
  title: string;
  difficulty: string;
  statement: string;
  constraints: string[];
  examples: Array<{ input: string; output: string; explanation?: string }>;
  hints: string[];
  content: {
    intuition: string;
    keyObservations: string[];
    approach: string[];
    pseudocode: string[];
    pitfalls: string[];
    timeComplexity: string;
    spaceComplexity: string;
  };
  code: {
    cpp: string;
    python?: string;
    java?: string;
  };
  topicSlug: string;
}

function getCosmosConfig() {
  if (!config.cosmosEndpoint || !config.cosmosKey) {
    throw new Error('Missing Cosmos DB configuration. Check COSMOS_ENDPOINT and COSMOS_KEY');
  }
  return {
    endpoint: config.cosmosEndpoint,
    key: config.cosmosKey,
    databaseName: config.cosmosDatabase || 'dsa-cookbook',
  };
}

function toArray(value: string | string[] | undefined | null): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return value.trim() ? [value] : [];
}

function constraintsToArray(value: string | undefined | null): string[] {
  if (!value || !value.trim()) return [];
  return value.split('\n').map(c => c.trim()).filter(c => c.length > 0);
}

function parseExamples(examplesStr: string): Array<{ input: string; output: string; explanation?: string }> {
  if (!examplesStr || examplesStr.trim() === '' || examplesStr.trim() === '[]') {
    return [];
  }
  try {
    return JSON.parse(examplesStr);
  } catch {
    return [];
  }
}

function getGeneratedDir(): string {
  return path.join(process.cwd(), 'generated');
}

async function pushTopic(topicData: GeneratedTopicData): Promise<string> {
  const cosmosConfig = getCosmosConfig();
  const topicSlug = topicData.topic.id;
  const topicName = topicData.topic.title;
  const topicDescription = topicData.topic.summary;

  console.log(`\n=== Overwriting topic: ${topicName} ===`);

  const topicDocument: CosmosTopicDocument = {
    id: topicSlug,
    topicId: topicName,
    slug: topicSlug,
    name: topicName,
    description: topicDescription,
    problemCount: topicData.problems.length,
    solvedCount: 0,
  };

  await upsertDocument(cosmosConfig, 'topics', topicDocument);
  console.log(`Topic upserted: ${topicSlug}`);

  let pushedCount = 0;

  for (const problem of topicData.problems) {
    const slug = problem.leetcode_slug || problem.id;
    console.log(`Processing problem: ${problem.title} (slug: ${slug})...`);

    const problemDocument: CosmosProblemDocument = {
      id: `${topicSlug}--${slug}`,
      slug,
      leetcodeId: problem.leetcode_id,
      title: problem.title,
      difficulty: problem.difficulty,
      statement: problem.content?.statement || '',
      constraints: constraintsToArray(problem.content?.constraints),
      examples: parseExamples(problem.content?.examples || '[]'),
      hints: problem.content?.hints || [],
      content: {
        intuition: problem.content?.intuition || '',
        keyObservations: toArray(problem.content?.key_observations),
        approach: Array.isArray(problem.content?.approach)
          ? problem.content.approach
          : (problem.content?.approach ? [problem.content.approach] : []),
        pseudocode: Array.isArray(problem.content?.pseudocode)
          ? problem.content.pseudocode
          : (problem.content?.pseudocode ? [problem.content.pseudocode] : []),
        pitfalls: Array.isArray(problem.pitfalls) && problem.pitfalls.length > 0
          ? problem.pitfalls
          : toArray(problem.content?.pitfalls),
        timeComplexity: problem.time_complexity || problem.content?.time_complexity || '',
        spaceComplexity: problem.space_complexity || problem.content?.space_complexity || '',
      },
      code: {
        cpp: problem.code?.cpp || '',
        python: problem.code?.python,
        java: problem.code?.java,
      },
      topicSlug,
    };

    await upsertDocument(cosmosConfig, 'problems', problemDocument);
    pushedCount++;
    console.log(`  -> ${problem.title} overwritten successfully`);
  }

  return `${pushedCount} problems overwritten`;
}

async function main() {
  const args = process.argv.slice(2);
  const allArg = args.includes('--all');
  const topicArg = args.find(arg => arg.startsWith('--topic='));
  const topicSlug = topicArg ? topicArg.replace('--topic=', '') : undefined;

  if (!allArg && !topicSlug) {
    console.error('Usage:');
    console.error('  npx tsx overwriteToCosmos.ts --all');
    console.error('  npx tsx overwriteToCosmos.ts --topic=<topic-slug>');
    process.exit(1);
  }

  const generatedDir = getGeneratedDir();

  if (allArg) {
    console.log('Overwriting all topics to Cosmos DB...');
    const files = fs.readdirSync(generatedDir).filter(f => f.endsWith('.json'));

    for (const file of files) {
      const topicSlugFromFile = file.replace('.json', '');
      const filePath = path.join(generatedDir, file);

      console.log(`\nLoading generated data from: ${filePath}`);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const topicData: GeneratedTopicData = JSON.parse(fileContent);

      console.log(`\n=== Cosmos DB Overwrite ===`);
      console.log(`Topic: ${topicData.topic.title}`);
      console.log(`Problems: ${topicData.problems.length}`);

      try {
        const result = await pushTopic(topicData);
        console.log(`\n=== Overwrite Complete ===`);
        console.log(result);
      } catch (error) {
        console.error(`\n=== Overwrite Failed for ${topicSlugFromFile} ===`);
        console.error(error);
      }
    }
  } else if (topicSlug) {
    const filePath = path.join(generatedDir, `${topicSlug}.json`);

    if (!fs.existsSync(filePath)) {
      console.error(`Generated file not found: ${filePath}`);
      console.error('Run contentGenerator.ts first to generate the content.');
      process.exit(1);
    }

    console.log(`Loading generated data from: ${filePath}`);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const topicData: GeneratedTopicData = JSON.parse(fileContent);

    console.log(`\n=== Cosmos DB Overwrite ===`);
    console.log(`Topic: ${topicData.topic.title}`);
    console.log(`Problems: ${topicData.problems.length}`);

    try {
      const result = await pushTopic(topicData);
      console.log(`\n=== Overwrite Complete ===`);
      console.log(result);
    } catch (error) {
      console.error('\n=== Overwrite Failed ===');
      console.error(error);
      process.exit(1);
    }
  }
}

main();