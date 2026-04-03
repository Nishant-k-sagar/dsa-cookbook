import * as fs from 'fs';
import * as path from 'path';
import { createLeetCodeClient } from './leetCodeClient.js';
import { createAIClient, type AIClient } from './aiClient.js';
import { getCurrentProviderName } from './aiClient.js';
import { config } from './config.js';
import type {
  SeedFile,
  GeneratedFile,
  GeneratedProblem,
  TopicContent,
  Difficulty,
  Importance
} from './types.js';
import { GENERATED_SCHEMA_VERSION } from './types.js';
import {
  validateSeedFile,
  sanitizeText,
  sanitizeHtmlArray,
  extractConstraints,
  extractPureStatement,
  stripMarkdownCodeFences,
  toKebabCase,
  parseExamplesFromContent,
  examplesToString
} from './parseUtils.js';
import {
  buildProblemContentPrompt,
  buildProblemCodePrompt,
  buildTopicContentPrompt
} from './promptTemplates.js';
import type { ProblemContext, TopicContext } from './promptTemplates.js';

function resolveDataDir(dirName: 'seeds' | 'generated'): string {
  const cwdDir = path.join(process.cwd(), dirName);
  if (fs.existsSync(cwdDir)) {
    return cwdDir;
  }

  return path.join(process.cwd(), 'src/web', dirName);
}

const SEEDS_DIR = resolveDataDir('seeds');
const GENERATED_DIR = resolveDataDir('generated');

interface ContentGenerationResult {
  success: boolean;
  problemSlug: string;
  generatedProblem?: GeneratedProblem;
  error?: string;
}

interface MistralContentFields {
  key_observations: string[];
  intuition: string;
  approach: string[];
  pseudocode: string[];
  pitfalls: string[];
  time_complexity: string;
  space_complexity: string;
  connection_to_subtopic: string;
}

interface MistralCodeFields {
  cpp: string;
}

interface ExpectedCppShape {
  classNames: string[];
  methodNames: string[];
}

function calculateRating(difficulty: Difficulty, importance: Importance): number {
  const baseRating = difficulty === 'Easy' ? 1200 : difficulty === 'Medium' ? 1400 : 1600;
  const importanceOffset = importance === 'Crucial' ? 100 : 0;
  return baseRating + importanceOffset;
}


function assignImportance(difficulty: Difficulty, index: number): Importance {
  if (difficulty === 'Easy') return 'Crucial';
  if (index < 2) return 'Crucial';
  return 'Optional';
}

function validateContentFields(fields: MistralContentFields): boolean {
  const approachIsValid = Array.isArray(fields.approach) && fields.approach.length > 0;
  const pseudocodeIsValid = Array.isArray(fields.pseudocode) && fields.pseudocode.length > 0;
  
  return Boolean(
    fields.key_observations &&
    Array.isArray(fields.key_observations) &&
    fields.key_observations.length > 0 &&
    fields.intuition &&
    approachIsValid &&
    pseudocodeIsValid &&
    fields.pitfalls &&
    Array.isArray(fields.pitfalls) &&
    fields.pitfalls.length > 0 &&
    fields.time_complexity &&
    fields.space_complexity &&
    fields.connection_to_subtopic
  );
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractExpectedCppShape(cppTemplate: string): ExpectedCppShape {
  const classNames = [...cppTemplate.matchAll(/\bclass\s+([A-Za-z_]\w*)/g)]
    .map(match => match[1])
    .filter(Boolean);

  const methodNames = [...cppTemplate.matchAll(
    /\b(?:virtual\s+)?(?:static\s+)?(?:const\s+)?(?:unsigned\s+|signed\s+)?(?:long\s+long\s+|long\s+|short\s+)?(?:bool|char|int|float|double|string|void|TreeNode\*|ListNode\*|Node\*|vector<[^>]+>|unordered_map<[^>]+>|map<[^>]+>|set<[^>]+>|queue<[^>]+>|stack<[^>]+>|pair<[^>]+>|[A-Za-z_]\w*(?:::[A-Za-z_]\w*)?(?:<[^;{}()]+>)?)\s+([A-Za-z_]\w*)\s*\([^;{}]*\)\s*(?:const)?\s*\{/g
  )]
    .map(match => match[1])
    .filter(name => name && name !== 'if' && name !== 'for' && name !== 'while' && name !== 'switch');

  return {
    classNames: [...new Set(classNames)],
    methodNames: [...new Set(methodNames)],
  };
}

function validateCodeFields(fields: MistralCodeFields, cppTemplate: string): boolean {
  if (!fields.cpp || !fields.cpp.trim()) {
    return false;
  }

  const expected = extractExpectedCppShape(cppTemplate);

  const hasExpectedClass = expected.classNames.length === 0
    || expected.classNames.some(className => new RegExp(`\\bclass\\s+${escapeRegex(className)}\\b`).test(fields.cpp));

  if (!hasExpectedClass) {
    return false;
  }

  const hasExpectedMethods = expected.methodNames.every(
    methodName => new RegExp(`\\b${escapeRegex(methodName)}\\s*\\(`).test(fields.cpp)
  );

  return hasExpectedMethods;
}

async function checkProblemExistsInCosmosDB(slug: string, topicSlug: string): Promise<boolean> {
  if (!config.cosmosEndpoint || !config.cosmosKey) {
    return false; // If no Cosmos DB config, assume problem doesn't exist
  }

  try {
    const { queryDocuments } = await import('./cosmosClient.js');
    const cosmosConfig = {
      endpoint: config.cosmosEndpoint,
      key: config.cosmosKey,
      databaseName: config.cosmosDatabase || 'dsa-cookbook',
    };

    const problems = await queryDocuments<{ id: string }>(
      cosmosConfig,
      'problems',
      'SELECT c.id FROM c WHERE c.slug = @slug AND c.topicSlug = @topicSlug',
      [
        { name: '@slug', value: slug },
        { name: '@topicSlug', value: topicSlug },
      ]
    );

    return problems.length > 0;
  } catch {
    return false; // On error, assume problem doesn't exist
  }
}

async function checkProblemExists(slug: string, topicSlug: string): Promise<boolean> {
  // Check in Cosmos DB if configured
  const existsInCosmosDB = await checkProblemExistsInCosmosDB(slug, topicSlug);
  if (existsInCosmosDB) {
    return true;
  }

  return false;
}

async function generateProblemContent(
  leetCodeClient: ReturnType<typeof createLeetCodeClient>,
  aiClient: AIClient,
  seedProblem: SeedFile['problems'][0],
  topicSlug: string,
  _topicName: string,
  index: number
): Promise<ContentGenerationResult> {
  try {
    const providerName = getCurrentProviderName();
    const problem = await leetCodeClient.fetchProblem(seedProblem.slug);

    const statement = extractPureStatement(problem.content);
    const constraints = extractConstraints(problem.content);
    const parsedExamples = parseExamplesFromContent(problem.content);
    const examples = examplesToString(parsedExamples);
    const hints = sanitizeHtmlArray(problem.hints);
    const cppTemplate = leetCodeClient.getCppTemplate(problem.codeSnippets);
    const tags = problem.topicTags.map(t => t.slug);

    const difficulty = problem.difficulty;
    const importance = assignImportance(difficulty, index);

    const problemContext: ProblemContext = {
      title: seedProblem.title,
      slug: seedProblem.slug,
      difficulty,
      statement,
      constraints,
      examples,
      hints,
      tags,
      topicSlug,
      cppTemplate
    };

    console.log(`\n--- ${providerName} Call 1: Generating content fields for ${seedProblem.title} ---`);
    const contentPrompt = buildProblemContentPrompt(problemContext);

    let contentFields: MistralContentFields;
    try {
      contentFields = await aiClient.callForJson<MistralContentFields>(
        [{ role: 'user', content: contentPrompt }],
        5
      );
      console.log(`Call 1 successful for: ${seedProblem.title}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Call 1 failed for ${seedProblem.slug}: ${errorMsg}`);
      return {
        success: false,
        problemSlug: seedProblem.slug,
        error: `Content call failed: ${errorMsg}`
      };
    }

    if (!validateContentFields(contentFields)) {
      console.error(`Call 1 returned invalid fields for ${seedProblem.slug}`);
      return {
        success: false,
        problemSlug: seedProblem.slug,
        error: 'Content call returned invalid/empty fields'
      };
    }

    console.log(`\n--- ${providerName} Call 2: Generating code for ${seedProblem.title} ---`);
    const codePrompt = buildProblemCodePrompt(problemContext, contentFields.key_observations.join('; '));

    let codeFields: MistralCodeFields;
    try {
      const rawCodeResponse = await aiClient.call(
        [{ role: 'user', content: codePrompt }],
        3
      );
      codeFields = { cpp: stripMarkdownCodeFences(rawCodeResponse.content.trim()) };
      console.log(`Call 2 successful for: ${seedProblem.title}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Call 2 failed for ${seedProblem.slug}: ${errorMsg}`);
      return {
        success: false,
        problemSlug: seedProblem.slug,
        error: `Code call failed: ${errorMsg}`
      };
    }

    if (!validateCodeFields(codeFields, cppTemplate)) {
      console.error(`Call 2 returned invalid code for ${seedProblem.slug}`);
      return {
        success: false,
        problemSlug: seedProblem.slug,
        error: 'Code call returned invalid code'
      };
    }

    const sanitizedContentFields = {
      key_observations: Array.isArray(contentFields.key_observations) 
        ? contentFields.key_observations.map(sanitizeText)
        : [],
      intuition: sanitizeText(contentFields.intuition || ''),
      approach: Array.isArray(contentFields.approach)
        ? contentFields.approach.map(sanitizeText)
        : [],
      pseudocode: Array.isArray(contentFields.pseudocode)
        ? contentFields.pseudocode.map(sanitizeText)
        : [],
      pitfalls: Array.isArray(contentFields.pitfalls)
        ? contentFields.pitfalls.map(sanitizeText)
        : [],
      time_complexity: sanitizeText(contentFields.time_complexity || ''),
      space_complexity: sanitizeText(contentFields.space_complexity || ''),
      connection_to_subtopic: sanitizeText(contentFields.connection_to_subtopic || ''),
    };

    const generatedProblem: GeneratedProblem = {
      id: seedProblem.slug,
      title: seedProblem.title,
      topic_id: topicSlug,
      subtopic_id: toKebabCase(seedProblem.category),
      leetcode_id: problem.questionId,
      leetcode_slug: seedProblem.slug,
      leetcode_url: `https://leetcode.com/problems/${seedProblem.slug}/`,
      source: 'LeetCode',
      difficulty,
      importance,
      rating: calculateRating(difficulty, importance),
      difficulty_bucket: 'standard',
      tags,
      time_complexity: sanitizedContentFields.time_complexity,
      space_complexity: sanitizedContentFields.space_complexity,
      pitfalls: [],
      content: {
        statement,
        constraints,
        examples,
        hints,
        ...sanitizedContentFields
      },
      code: {
        cpp: codeFields.cpp
      }
    };

    console.log(`Successfully generated complete content for: ${seedProblem.title}`);
    return {
      success: true,
      problemSlug: seedProblem.slug,
      generatedProblem
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error generating content for ${seedProblem.slug}:`, errorMessage);
    return {
      success: false,
      problemSlug: seedProblem.slug,
      error: errorMessage
    };
  }
}

async function generateTopicContent(
  aiClient: AIClient,
  topicName: string,
  topicSlug: string,
  problems: GeneratedProblem[]
): Promise<TopicContent> {
  const providerName = getCurrentProviderName();
  
  // Check if topic already has content
  const existingPath = path.join(GENERATED_DIR, `${topicSlug}.json`);
  if (fs.existsSync(existingPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(existingPath, 'utf-8')) as GeneratedFile;
      if (existing.topic?.summary && existing.topic.summary.trim().length > 0) {
        console.log(`Topic "${topicSlug}" already has content, preserving existing.`);
        return {
          ...existing.topic,
          id: topicSlug,
          title: topicName,  // Always use the correct title from seed file
          problemCount: problems.length
        };
      }
    } catch {
      // Ignore parse errors, generate fresh content
    }
  }

  const topicContext: TopicContext = {
    topicName,
    topicSlug,
    tags: problems.flatMap(p => p.tags).filter((v, i, a) => a.indexOf(v) === i),
    problems: problems.map(p => ({
      title: p.title,
      difficulty: p.difficulty,
      tags: p.tags
    }))
  };

  console.log(`\n--- ${providerName} Call: Generating topic-level content for ${topicName} ---`);
  const topicPrompt = buildTopicContentPrompt(topicContext);

  try {
    const topicFields = await aiClient.callForJson<TopicContent>([{ role: 'user', content: topicPrompt }], 3);
    console.log(`Topic content generated for: ${topicName}`);
    return {
      ...topicFields,
      id: topicSlug,
      title: topicName,
      problemCount: problems.length
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Topic content generation failed for ${topicSlug}: ${errorMsg}`);
    // Return empty topic content on failure
    return {
      id: topicSlug,
      title: topicName,
      summary: '',
      lc_rating_range: [1200, 1600],
      target_audience: 'DSA learners',
      prerequisites: [],
      patterns: [],
      subtopics: [],
      time_complexity: '',
      space_complexity: '',
      pitfalls: [],
      edge_cases: [],
      content: {
        introduction: '',
        key_patterns: '',
        common_pitfalls: '',
        when_to_use: '',
        related_topics: ''
      },
      problemCount: problems.length
    };
  }
}

async function generateContent(topicSlug: string): Promise<void> {
  console.log(`\n=== Generating content for: ${topicSlug} ===`);

  const seedPath = path.join(SEEDS_DIR, `${topicSlug}.json`);

  if (!fs.existsSync(seedPath)) {
    console.error(`Seed file not found: ${seedPath}`);
    process.exit(1);
  }

  const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
  const seedFile = validateSeedFile(seedData);

  const leetCodeClient = createLeetCodeClient();
  const aiClient = createAIClient();

  const results: ContentGenerationResult[] = [];
  const generatedProblems: GeneratedProblem[] = [];

  for (let i = 0; i < seedFile.problems.length; i++) {
    const seedProblem = seedFile.problems[i];
    console.log(`\nProcessing ${i + 1}/${seedFile.problems.length}: ${seedProblem.title}`);

    // Check if problem already exists in Back4App or Cosmos DB for this topic
    const exists = await checkProblemExists(seedProblem.slug, topicSlug);
    if (exists) {
      console.log(`  -> ${seedProblem.title} already exists for topic ${topicSlug}, skipping content generation`);
      continue;
    }

    const result = await generateProblemContent(
      leetCodeClient,
      aiClient,
      seedProblem,
      topicSlug,
      seedFile.topic,
      i
    );
    results.push(result);

    if (result.success && result.generatedProblem) {
      generatedProblems.push(result.generatedProblem);
      console.log(`Successfully generated: ${seedProblem.slug}`);
    } else {
      console.error(`Failed: ${seedProblem.slug} - ${result.error}`);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`\n=== Summary for ${topicSlug} ===`);
  console.log(`Successful: ${successful.length}/${results.length}`);

  if (failed.length > 0) {
    console.log(`\nFailed problems:`);
    for (const f of failed) {
      console.log(`  - ${f.problemSlug}: ${f.error}`);
    }
  }

  // If no new problems were generated, load existing problems from the generated file
  if (generatedProblems.length === 0) {
    const existingPath = path.join(GENERATED_DIR, `${topicSlug}.json`);
    if (fs.existsSync(existingPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(existingPath, 'utf-8')) as GeneratedFile;
        if (existing.problems && existing.problems.length > 0) {
          console.log(`Using ${existing.problems.length} existing problems for topic content generation.`);
          generatedProblems.push(...existing.problems);
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  if (generatedProblems.length === 0) {
    console.error('No problems available for topic content generation. Aborting.');
    process.exit(1);
  }

  // Generate topic-level content using Mistral AI
  const topicContent = await generateTopicContent(aiClient, seedFile.topic, topicSlug, generatedProblems);

  const generatedFile: GeneratedFile = {
    schemaVersion: GENERATED_SCHEMA_VERSION,
    topic: topicContent,
    problems: generatedProblems
  };

  if (!fs.existsSync(GENERATED_DIR)) {
    fs.mkdirSync(GENERATED_DIR, { recursive: true });
  }

  const generatedPath = path.join(GENERATED_DIR, `${topicSlug}.json`);
  fs.writeFileSync(generatedPath, JSON.stringify(generatedFile, null, 2));
  console.log(`\nWritten generated content to: ${generatedPath}`);
}

async function main() {
  const args = process.argv.slice(2);
  const topicArg = args.find(arg => arg.startsWith('--topic='));
  const allArg = args.includes('--all');

  if (!topicArg && !allArg) {
    console.log('Usage:');
    console.log('  npx tsx contentGenerator.ts --topic=binary-search');
    console.log('  npx tsx contentGenerator.ts --all');
    process.exit(1);
  }

  if (allArg) {
    console.log('Generating content for all topics...');

    if (!fs.existsSync(SEEDS_DIR)) {
      console.error('Seeds directory not found. Run seedGenerator.ts first.');
      process.exit(1);
    }

    const seedFiles = fs.readdirSync(SEEDS_DIR).filter(f => f.endsWith('.json'));

    for (const seedFile of seedFiles) {
      const topicSlug = seedFile.replace('.json', '');
      await generateContent(topicSlug);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

  } else if (topicArg) {
    const topicSlug = topicArg.replace('--topic=', '').replace(/^["']|["']$/g, '');
    await generateContent(topicSlug);
  }

  console.log('\n=== Content Generation Complete ===');
}

main().catch(console.error);
