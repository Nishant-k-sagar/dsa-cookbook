import * as fs from 'fs';
import * as path from 'path';
import { createLeetCodeClient } from './leetCodeClient.js';
import { TOPIC_CONFIGS, SEED_SCHEMA_VERSION } from './types.js';
import type { TopicConfig, SeedFile, LeetCodeProblemSummary, Difficulty } from './types.js';
import { toKebabCase } from './parseUtils.js';

// Maps TOPIC_CONFIGS slugs to public file topicSlugs
const CONFIG_TO_PUBLIC_SLUG: Record<string, string> = {
  'arrays': 'arrays-and-hashing',
  'dynamic-programming': 'dynamic-programming',
  'trees': 'trees',
  'binary-search': 'binary-search',
  'two-pointers': 'two-pointers',
  'sliding-window': 'sliding-window',
  'linked-list': 'linked-list',
  'stack': 'stack-and-queues',
  'queue': 'stack-and-queues',
  'sorting': 'sorting',
  'greedy': 'greedy',
  'graph': 'graphs',
  'backtracking': 'backtracking',
  'heap-priority-queue': 'heap-priority-queue',
  
};

interface PublicProblemEntry {
  platform: 'LeetCode';
  id: number;
  slug: string;
  title: string;
  difficulty: Difficulty;
  category: string;
}

interface PublicProblemsFile {
  schemaVersion: number;
  problemSets: Array<{
    topics: Array<{
      topic: string;
      topicSlug: string;
      problems: PublicProblemEntry[];
    }>;
  }>;
}

function resolvePublicProblemsPath(): string {
  const candidates = [
    path.join(process.cwd(), 'public/publicaly_available_problems/publicaly_availabale_problems.json'),
    path.join(process.cwd(), 'src/web/public/publicaly_available_problems/publicaly_availabale_problems.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('publicaly_availabale_problems.json not found. Run from project root or src/web/.');
}

function loadPublicProblemsByTopic(): Map<string, PublicProblemEntry[]> {
  const filePath = resolvePublicProblemsPath();
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as PublicProblemsFile;
  const map = new Map<string, PublicProblemEntry[]>();
  for (const problemSet of raw.problemSets) {
    for (const topicEntry of problemSet.topics) {
      const existing = map.get(topicEntry.topicSlug) ?? [];
      map.set(topicEntry.topicSlug, existing.concat(topicEntry.problems));
    }
  }
  return map;
}

function generateSeedFromPublic(
  config: TopicConfig,
  publicSlug: string,
  publicMap: Map<string, PublicProblemEntry[]>
): void {
  console.log(`\n=== Generating seed from public list for: ${config.name} (${config.slug}) ===`);

  const allForTopic = publicMap.get(publicSlug);
  if (!allForTopic || allForTopic.length === 0) {
    console.error(`No problems found for topicSlug "${publicSlug}" in public problems file.`);
    console.log('Available topics in public file:');
    for (const key of publicMap.keys()) {
      console.log(`  - ${key}`);
    }
    process.exit(1);
  }

  const existingSlugs = getExistingSlugsForTopic(config.slug);
  if (existingSlugs.size > 0) {
    console.log(`Skipping ${existingSlugs.size} already-generated problem(s) for "${config.slug}":`);
    for (const s of existingSlugs) {
      console.log(`  skip: ${s}`);
    }
  }

  const available = allForTopic.filter(p => !existingSlugs.has(p.slug));
  if (available.length === 0) {
    console.log(`All problems for "${config.slug}" are already generated. Nothing to do.`);
    return;
  }

  const batchSize = config.problemCount;
  const batch = available.slice(0, batchSize);
  const deferred = available.length - batch.length;

  console.log(`${available.length} problem(s) available. Taking ${batch.length} for this run${deferred > 0 ? ` (${deferred} deferred to next run)` : ''}.`);
  for (const p of batch) {
    console.log(`  - ${p.id} | ${p.slug} | ${p.difficulty}`);
  }

  const seedFile: SeedFile = {
    schemaVersion: SEED_SCHEMA_VERSION,
    topic: config.name,
    topicSlug: config.slug,
    generatedAt: new Date().toISOString(),
    problems: batch.map(p => ({
      platform: 'LeetCode' as const,
      id: p.id,
      slug: p.slug,
      title: p.title,
      category: p.category,
    })),
  };

  if (!fs.existsSync(SEEDS_DIR)) {
    fs.mkdirSync(SEEDS_DIR, { recursive: true });
  }

  const seedPath = path.join(SEEDS_DIR, `${config.slug}.json`);
  fs.writeFileSync(seedPath, JSON.stringify(seedFile, null, 2));
  console.log(`Written seed to: ${seedPath}`);

  // Update used problems tracking to prevent duplicates in future runs
  const newSlugs = batch.map(p => p.slug);
  updateUsedProblems(config.slug, newSlugs);
}

function resolveDataDir(dirName: 'seeds' | 'generated'): string {
  const cwdDir = path.join(process.cwd(), dirName);
  if (fs.existsSync(cwdDir)) {
    return cwdDir;
  }
  return path.join(process.cwd(), 'src/web', dirName);
}

const SEEDS_DIR = resolveDataDir('seeds');
const GENERATED_DIR = resolveDataDir('generated');

interface SeedGenerationResult {
  success: boolean;
  topic: string;
  problemCount: number;
  error?: string;
}

interface ExistingGeneratedTopicFile {
  problems?: Array<{
    id?: string;
    leetcode_slug?: string;
  }>;
}

const BASE_MIN_SUBMISSIONS: Record<Difficulty, number> = {
  Easy: 80000,
  Medium: 45000,
  Hard: 18000,
};

const THRESHOLD_RELAX_STEPS = [1.0, 0.8, 0.6, 0.4, 0.2, 0];

function normalizeTag(value: string): string {
  return value.toLowerCase().trim();
}

function matchesTopicTag(problem: LeetCodeProblemSummary, config: TopicConfig): boolean {
  const problemTags = new Set((problem.tags || []).map(normalizeTag));
  return config.tags.some(tag => problemTags.has(normalizeTag(tag)));
}

interface SelectionMetrics {
  submissions: number;
  acceptanceRate: number;
  popularityScore: number;
  acceptanceBandScore: number;
  difficultyScore: number;
  totalScore: number;
}

function getSelectionMetrics(problem: LeetCodeProblemSummary): SelectionMetrics {
  const submissions = problem.totalSubmitted || 0;
  const acceptanceRate = problem.acceptanceRate || 0;

  // High submissions indicate canonical/famous interview problems.
  const popularityScore = Math.log10(submissions + 10) * 3.2;
  // Prefer non-trivial but still learnable acceptance range.
  const acceptanceBandScore = Math.max(0, 1 - Math.abs(acceptanceRate - 52) / 52) * 2.1;
  // Medium-heavy mix with some hard coverage.
  const difficultyScore = problem.difficulty === 'Medium' ? 1.2 : problem.difficulty === 'Hard' ? 0.7 : 0.8;
  const totalScore = popularityScore + acceptanceBandScore + difficultyScore;

  return {
    submissions,
    acceptanceRate,
    popularityScore,
    acceptanceBandScore,
    difficultyScore,
    totalScore,
  };
}

function scoreProblem(problem: LeetCodeProblemSummary): number {
  return getSelectionMetrics(problem).totalScore;
}

function targetDifficultyCounts(total: number): Record<Difficulty, number> {
  const easy = Math.max(1, Math.round(total * 0.25));
  const medium = Math.max(1, Math.round(total * 0.5));
  const hard = Math.max(0, total - easy - medium);
  return { Easy: easy, Medium: medium, Hard: hard };
}

function minSubmissionsForDifficulty(difficulty: Difficulty, relaxFactor: number): number {
  return Math.floor(BASE_MIN_SUBMISSIONS[difficulty] * relaxFactor);
}

function applySubmissionThresholds(candidates: LeetCodeProblemSummary[], relaxFactor: number): LeetCodeProblemSummary[] {
  return candidates.filter(problem => {
    const minSubmissions = minSubmissionsForDifficulty(problem.difficulty, relaxFactor);
    return (problem.totalSubmitted || 0) >= minSubmissions;
  });
}

function pickRankedProblems(candidates: LeetCodeProblemSummary[], count: number): LeetCodeProblemSummary[] {
  const ranked = [...candidates]
    .filter(p => !p.paidOnly)
    .sort((a, b) => scoreProblem(b) - scoreProblem(a));

  if (ranked.length <= count) {
    return ranked;
  }

  const byDifficulty: Record<Difficulty, LeetCodeProblemSummary[]> = {
    Easy: ranked.filter(p => p.difficulty === 'Easy'),
    Medium: ranked.filter(p => p.difficulty === 'Medium'),
    Hard: ranked.filter(p => p.difficulty === 'Hard'),
  };

  const targets = targetDifficultyCounts(count);
  const selected: LeetCodeProblemSummary[] = [];
  const selectedSlugs = new Set<string>();

  for (const difficulty of ['Easy', 'Medium', 'Hard'] as Difficulty[]) {
    const bucket = byDifficulty[difficulty];
    const take = Math.min(targets[difficulty], bucket.length);
    for (let i = 0; i < take; i++) {
      selected.push(bucket[i]);
      selectedSlugs.add(bucket[i].slug);
    }
  }

  if (selected.length < count) {
    for (const problem of ranked) {
      if (selectedSlugs.has(problem.slug)) continue;
      selected.push(problem);
      selectedSlugs.add(problem.slug);
      if (selected.length === count) break;
    }
  }

  return selected.slice(0, count);
}

function selectWithThresholdFallback(candidates: LeetCodeProblemSummary[], count: number): LeetCodeProblemSummary[] {
  for (const relaxFactor of THRESHOLD_RELAX_STEPS) {
    const thresholded = applySubmissionThresholds(candidates, relaxFactor);
    const selected = pickRankedProblems(thresholded, count);
    if (selected.length >= count || relaxFactor === 0) {
      const easyMin = minSubmissionsForDifficulty('Easy', relaxFactor);
      const mediumMin = minSubmissionsForDifficulty('Medium', relaxFactor);
      const hardMin = minSubmissionsForDifficulty('Hard', relaxFactor);
      console.log(
        `Threshold step ${Math.round(relaxFactor * 100)}% -> mins(E/M/H)=${easyMin}/${mediumMin}/${hardMin}, pool=${thresholded.length}, selected=${selected.length}`
      );
      return selected;
    }
  }

  return [];
}

function inferCategory(problem: LeetCodeProblemSummary, config: TopicConfig): string {
  const problemTags = problem.tags || [];
  for (const tag of config.tags) {
    if (problemTags.some(t => normalizeTag(t) === normalizeTag(tag))) {
      return tag;
    }
  }
  return problemTags[0] || config.tags[0];
}

function getUsedProblemsPath(topicSlug: string): string {
  return path.join(SEEDS_DIR, `${topicSlug}.used.json`);
}

function getExistingSlugsForTopic(topicSlug: string): Set<string> {
  const excluded = new Set<string>();
  const seedPath = path.join(SEEDS_DIR, `${topicSlug}.json`);
  const generatedPath = path.join(GENERATED_DIR, `${topicSlug}.json`);
  const usedPath = getUsedProblemsPath(topicSlug);

  // Check used problems tracking file (persistent across seed generations)
  if (fs.existsSync(usedPath)) {
    try {
      const usedData = JSON.parse(fs.readFileSync(usedPath, 'utf-8')) as { slugs: string[] };
      for (const slug of usedData.slugs || []) {
        excluded.add(slug);
      }
    } catch {
      // Keep seed generation resilient; ignore malformed files.
    }
  }

  // Also check current seed file
  if (fs.existsSync(seedPath)) {
    try {
      const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8')) as SeedFile;
      for (const problem of seedData.problems || []) {
        if (problem.slug) excluded.add(problem.slug);
      }
    } catch {
      // Keep seed generation resilient; ignore malformed historical files.
    }
  }

  // Also check generated file
  if (fs.existsSync(generatedPath)) {
    try {
      const generatedData = JSON.parse(fs.readFileSync(generatedPath, 'utf-8')) as ExistingGeneratedTopicFile;
      for (const problem of generatedData.problems || []) {
        if (problem.leetcode_slug) excluded.add(problem.leetcode_slug);
        else if (problem.id) excluded.add(problem.id);
      }
    } catch {
      // Keep seed generation resilient; ignore malformed historical files.
    }
  }

  return excluded;
}

function updateUsedProblems(topicSlug: string, newSlugs: string[]): void {
  const usedPath = getUsedProblemsPath(topicSlug);
  let existingSlugs: string[] = [];

  if (fs.existsSync(usedPath)) {
    try {
      const usedData = JSON.parse(fs.readFileSync(usedPath, 'utf-8')) as { slugs: string[] };
      existingSlugs = usedData.slugs || [];
    } catch {
      // Keep seed generation resilient; ignore malformed files.
    }
  }

  // Add new slugs to existing ones (avoid duplicates)
  const allSlugs = [...new Set([...existingSlugs, ...newSlugs])];

  if (!fs.existsSync(SEEDS_DIR)) {
    fs.mkdirSync(SEEDS_DIR, { recursive: true });
  }

  fs.writeFileSync(usedPath, JSON.stringify({ slugs: allSlugs }, null, 2));
  console.log(`Updated used problems tracking: ${usedPath} (${allSlugs.length} total slugs)`);
}

async function generateSeed(
  _client: ReturnType<typeof createLeetCodeClient>,
  config: TopicConfig,
  allProblems: LeetCodeProblemSummary[]
): Promise<SeedGenerationResult> {
  console.log(`\n=== Generating seed for: ${config.name} ===`);
  console.log(`Tags: ${config.tags.join(', ')}`);

  try {
    console.log(`Using ${allProblems.length} total problems from LeetCode catalog`);
    const existingSlugs = getExistingSlugsForTopic(config.slug);
    if (existingSlugs.size > 0) {
      console.log(`Excluding ${existingSlugs.size} already-used problems for topic ${config.slug}`);
    }

    const availableProblems = allProblems.filter(p => !existingSlugs.has(p.slug));
    const filteredByTags = availableProblems.filter(p => matchesTopicTag(p, config));

    let selectedProblems = selectWithThresholdFallback(filteredByTags, config.problemCount);

    if (filteredByTags.length === 0) {
      console.log(`No problems matched configured tags. Falling back to global ranked selection.`);
      selectedProblems = selectWithThresholdFallback(availableProblems, config.problemCount);
    } else {
      console.log(`Found ${filteredByTags.length} problems matching tags. Selected top ${selectedProblems.length} by popularity score.`);
    }

    if (selectedProblems.length === 0) {
      return {
        success: false,
        topic: config.name,
        problemCount: 0,
        error: 'No problems found for the specified tags'
      };
    }

    if (selectedProblems.length < config.problemCount) {
      console.warn(
        `Only ${selectedProblems.length}/${config.problemCount} new problems available for ${config.name} without repeats.`
      );
    }

    console.log(`Selected problems for ${config.name}:`);
    for (const p of selectedProblems) {
      const m = getSelectionMetrics(p);
      console.log(
        `  - ${p.id} | ${p.slug} | ${p.difficulty} | submissions=${m.submissions} | ac=${m.acceptanceRate.toFixed(2)}% | score=${m.totalScore.toFixed(3)}`
      );
    }

    const seedFile: SeedFile = {
      schemaVersion: SEED_SCHEMA_VERSION,
      topic: config.name,
      topicSlug: config.slug,
      generatedAt: new Date().toISOString(),
      problems: selectedProblems.map(p => ({
        platform: 'LeetCode' as const,
        id: p.id,
        slug: p.slug,
        title: p.title,
        category: inferCategory(p, config)
      }))
    };

    if (!fs.existsSync(SEEDS_DIR)) {
      fs.mkdirSync(SEEDS_DIR, { recursive: true });
    }

    const seedPath = path.join(SEEDS_DIR, `${config.slug}.json`);
    fs.writeFileSync(seedPath, JSON.stringify(seedFile, null, 2));
    console.log(`Written seed to: ${seedPath}`);

    // Update used problems tracking to prevent duplicates in future runs
    const newSlugs = selectedProblems.map(p => p.slug);
    updateUsedProblems(config.slug, newSlugs);

    return {
      success: true,
      topic: config.name,
      problemCount: selectedProblems.length
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error generating seed for ${config.name}:`, errorMessage);
    return {
      success: false,
      topic: config.name,
      problemCount: 0,
      error: errorMessage
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const topicArg = args.find(arg => arg.startsWith('--topic='));
  const allArg = args.includes('--all');
  const fromPublicArg = args.includes('--from-public');

  if (!topicArg && !allArg) {
    console.log('Usage:');
    console.log('  npx tsx seedGenerator.ts --topic="Binary Search"           # from LeetCode API');
    console.log('  npx tsx seedGenerator.ts --all                             # from LeetCode API, all topics');
    console.log('  npx tsx seedGenerator.ts --from-public --topic=binary-search  # from public JSON');
    process.exit(1);
  }

  if (fromPublicArg) {
    if (!topicArg) {
      console.error('--from-public requires --topic=<topicSlug>');
      process.exit(1);
    }
    const rawTopic = topicArg.replace('--topic=', '').replace(/^["']|["']$/g, '');

    // Step 1: Validate against TOPIC_CONFIGS
    const config = TOPIC_CONFIGS.find(c => c.slug === rawTopic);
    if (!config) {
      console.error(`Topic "${rawTopic}" does not exist.`);
      console.log('Available topics:');
      for (const c of TOPIC_CONFIGS) {
        console.log(`  - ${c.slug}`);
      }
      process.exit(1);
    }

    // Step 2: Check if available in public file
    const publicSlug = CONFIG_TO_PUBLIC_SLUG[config.slug];
    if (!publicSlug) {
      console.error(`Topic "${rawTopic}" not available in public file.`);
      console.log('Use LeetCode API mode instead: --topic="' + config.name + '"');
      process.exit(1);
    }

    // Step 3: Generate seed using config
    const publicMap = loadPublicProblemsByTopic();
    generateSeedFromPublic(config, publicSlug, publicMap);
    return;
  }

  const client = createLeetCodeClient();
  const allProblems = await client.fetchProblemList();
  console.log(`Loaded ${allProblems.length} problems for seed selection`);

  if (allArg) {
    console.log('Generating seeds for all topics...');
    const results: SeedGenerationResult[] = [];

    for (const config of TOPIC_CONFIGS) {
      const result = await generateSeed(client, config, allProblems);
      results.push(result);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n=== Summary ===');
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`Successful: ${successful.length}/${results.length}`);
    for (const r of successful) {
      console.log(`  - ${r.topic}: ${r.problemCount} problems`);
    }

    if (failed.length > 0) {
      console.log(`\nFailed: ${failed.length}`);
      for (const r of failed) {
        console.log(`  - ${r.topic}: ${r.error}`);
      }
    }

  } else if (topicArg) {
    const topicName = topicArg.replace('--topic=', '').replace(/^["']|["']$/g, '');
    const config = TOPIC_CONFIGS.find(c =>
      c.name.toLowerCase() === topicName.toLowerCase() ||
      c.slug === toKebabCase(topicName)
    );

    if (!config) {
      console.error(`Error: Topic "${topicName}" not found in TOPIC_CONFIGS`);
      console.log('Available topics:');
      for (const c of TOPIC_CONFIGS) {
        console.log(`  - ${c.name} (${c.slug})`);
      }
      process.exit(1);
    }

    const result = await generateSeed(client, config, allProblems);

    if (!result.success) {
      console.error(`\nFailed to generate seed: ${result.error}`);
      process.exit(1);
    }

    console.log(`\nSuccessfully generated seed with ${result.problemCount} problems`);
  }
}

main().catch(console.error);
