import * as fs from 'fs';
import * as path from 'path';
import type { LeetCodeProblem, LeetCodeProblemSummary, Difficulty } from './types.js';
import { CACHE_DIR, CACHE_TTL_HOURS, RATE_LIMIT_MS, config } from './config.js';

const LEETCODE_API_BASE = 'https://leetcode.com';
const GRAPHQL_ENDPOINT = `${LEETCODE_API_BASE}/graphql`;
const REST_API_ENDPOINT = `${LEETCODE_API_BASE}/api/problems/algorithms/`;

interface LeetCodeCacheEntry<T> {
  data: T;
  timestamp: number;
}

interface RestProblemListResponse {
  stat_status_pairs: Array<{
    stat: {
      question_id: number;
      frontend_question_id: number;
      question__title_slug: string;
      question__title: string;
      total_acs?: number;
      total_submitted?: number;
    };
    difficulty: { level: number };
    paid_only: boolean;
    frequency?: number;
  }>;
}

interface GraphqlQuestionListResponse {
  data?: {
    problemsetQuestionList: {
      total: number;
      questions: GraphqlQuestionListItem[];
    };
  };
  errors?: Array<{ message: string }>;
}

interface GraphqlQuestionListItem {
  questionFrontendId: string;
  title: string;
  titleSlug: string;
  difficulty: string;
  topicTags: Array<{ name: string; slug: string }>;
  acRate?: number | string;
  freqBar?: number | string;
  isPaidOnly: boolean;
}

class LeetCodeClient {
  private cacheDir: string;
  private lastRequestTime = 0;

  constructor() {
    this.cacheDir = path.join(process.cwd(), CACHE_DIR);
    this.ensureCacheDir();
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private getCachePath(filename: string): string {
    return path.join(this.cacheDir, filename);
  }

  private isCacheValid(timestamp: number): boolean {
    const ttlMs = CACHE_TTL_HOURS * 60 * 60 * 1000;
    return Date.now() - timestamp < ttlMs;
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < RATE_LIMIT_MS) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - timeSinceLastRequest));
    }
    this.lastRequestTime = Date.now();
  }

  async fetchProblemList(): Promise<LeetCodeProblemSummary[]> {
    const cachePath = this.getCachePath('problem-list.json');

    try {
      const cached = this.loadCache<LeetCodeProblemSummary[]>(cachePath);
      if (cached && this.isCacheValid(cached.timestamp)) {
        console.log('Using cached problem list');
        return cached.data;
      }
    } catch {
      console.log('Cache miss or invalid, fetching from LeetCode');
    }

    await this.rateLimit();
    const response = await fetch(REST_API_ENDPOINT);

    if (!response.ok) {
      throw new Error(`Failed to fetch problem list: ${response.status} ${response.statusText}`);
    }

    const restData = await response.json() as RestProblemListResponse;
    const restBySlug = new Map<string, LeetCodeProblemSummary>();

    for (const p of restData.stat_status_pairs) {
      if (p.paid_only) continue;
      const totalSubmitted = Number(p.stat.total_submitted || 0);
      const totalAccepted = Number(p.stat.total_acs || 0);
      const acceptanceRate = totalSubmitted > 0 ? (totalAccepted / totalSubmitted) * 100 : undefined;

      restBySlug.set(p.stat.question__title_slug, {
        id: p.stat.frontend_question_id,
        slug: p.stat.question__title_slug,
        title: p.stat.question__title,
        difficulty: this.mapDifficulty(p.difficulty.level),
        tags: [],
        paidOnly: p.paid_only,
        totalAccepted,
        totalSubmitted,
        acceptanceRate,
        frequency: typeof p.frequency === 'number' ? p.frequency : undefined,
      });
    }

    const graphqlProblems = await this.fetchQuestionListMetadata();
    const problems: LeetCodeProblemSummary[] = [];

    for (const gql of graphqlProblems) {
      if (gql.isPaidOnly) continue;
      const fromRest = restBySlug.get(gql.titleSlug);
      const gqlFrontendId = Number(gql.questionFrontendId);

      problems.push({
        id: Number.isFinite(gqlFrontendId) && gqlFrontendId > 0 ? gqlFrontendId : (fromRest?.id || 0),
        slug: gql.titleSlug,
        title: gql.title,
        difficulty: this.mapDifficultyFromString(gql.difficulty),
        tags: (gql.topicTags || []).map(t => t.name).filter(Boolean),
        paidOnly: gql.isPaidOnly,
        totalAccepted: fromRest?.totalAccepted,
        totalSubmitted: fromRest?.totalSubmitted,
        acceptanceRate: fromRest?.acceptanceRate,
        frequency: fromRest?.frequency,
      });
    }

    const seen = new Set(problems.map(p => p.slug));
    for (const restProblem of restBySlug.values()) {
      if (seen.has(restProblem.slug)) continue;
      problems.push(restProblem);
    }

    this.saveCache(cachePath, problems);
    console.log(`Fetched ${problems.length} problems from LeetCode`);

    return problems;
  }

  async fetchProblem(slug: string): Promise<LeetCodeProblem> {
    const cachePath = this.getCachePath(`${slug}.json`);

    try {
      const cached = this.loadCache<LeetCodeProblem>(cachePath);
      if (cached && this.isCacheValid(cached.timestamp)) {
        console.log(`Using cached problem: ${slug}`);
        return cached.data;
      }
    } catch {
      console.log(`Cache miss for ${slug}, fetching from LeetCode`);
    }

    await this.rateLimit();

    // First, get the correct question_id from the problem list (this is the visible LeetCode ID)
    let correctQuestionId: number = 0;
    try {
      const problemList = await this.fetchProblemList();
      const found = problemList.find(p => p.slug === slug);
      if (found) {
        correctQuestionId = found.id;
        console.log(`Found question_id: ${correctQuestionId} for ${slug} from problem list`);
      }
    } catch (error) {
      console.warn(`Failed to fetch problem list for question_id lookup: ${error}`);
    }

    const query = `
      query getQuestion($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          questionId
          questionFrontendId
          title
          difficulty
          content
          exampleTestcases
          hints
          topicTags {
            name
            slug
          }
          codeSnippets {
            langSlug
            code
          }
        }
      }
    `;

    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.leetCodeSession && {
          'Cookie': `LEETCODE_SESSION=${config.leetCodeSession}`
        }),
      },
      body: JSON.stringify({
        query,
        variables: { titleSlug: slug },
      }),
    });

    if (response.status === 401) {
      throw new Error('LEETCODE_SESSION expired. Please refresh the session cookie in .env');
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch problem ${slug}: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as {
      data?: {
        question: {
          questionId: number;
          questionFrontendId: number;
          title: string;
          difficulty: string;
          content: string;
          exampleTestcases: string;
          hints: string[];
          topicTags: Array<{ name: string; slug: string }>;
          codeSnippets: Array<{ langSlug: string; code: string }>;
        };
      };
      errors?: Array<{ message: string }>;
    };

    if (result.errors && result.errors.length > 0) {
      throw new Error(`GraphQL error: ${result.errors[0].message}`);
    }

    if (!result.data?.question) {
      throw new Error(`Problem not found: ${slug}`);
    }

    const q = result.data.question;
    // Use correctQuestionId from REST API if available, otherwise fallback to GraphQL questionFrontendId or questionId
    const finalQuestionId = correctQuestionId || Number(q.questionFrontendId) || Number(q.questionId);
    const problem: LeetCodeProblem = {
      questionId: finalQuestionId,
      title: q.title,
      difficulty: this.mapDifficultyFromString(q.difficulty),
      content: q.content || '',
      exampleTestcases: q.exampleTestcases || '',
      hints: q.hints || [],
      topicTags: q.topicTags || [],
      codeSnippets: q.codeSnippets || [],
    };

    this.saveCache(cachePath, problem);
    console.log(`Fetched problem: ${slug}`);

    return problem;
  }

  private loadCache<T>(cachePath: string): LeetCodeCacheEntry<T> | null {
    try {
      if (!fs.existsSync(cachePath)) return null;
      const content = fs.readFileSync(cachePath, 'utf-8');
      return JSON.parse(content) as LeetCodeCacheEntry<T>;
    } catch {
      return null;
    }
  }

  private saveCache<T>(cachePath: string, data: T): void {
    const entry: LeetCodeCacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };
    fs.writeFileSync(cachePath, JSON.stringify(entry, null, 2));
  }

  private mapDifficulty(level: number): Difficulty {
    switch (level) {
      case 1: return 'Easy';
      case 2: return 'Medium';
      case 3: return 'Hard';
      default: return 'Medium';
    }
  }

  private mapDifficultyFromString(difficulty: string): Difficulty {
    switch (difficulty.toLowerCase()) {
      case 'easy': return 'Easy';
      case 'medium': return 'Medium';
      case 'hard': return 'Hard';
      default: return 'Medium';
    }
  }

  private async fetchQuestionListMetadata(): Promise<GraphqlQuestionListItem[]> {
    const query = `
      query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
        problemsetQuestionList: questionList(categorySlug: $categorySlug, limit: $limit, skip: $skip, filters: $filters) {
          total: totalNum
          questions: data {
            questionFrontendId
            title
            titleSlug
            difficulty
            topicTags { name slug }
            acRate
            freqBar
            isPaidOnly
          }
        }
      }
    `;

    const pageSize = 100;
    let skip = 0;
    let total = Number.MAX_SAFE_INTEGER;
    const allQuestions: GraphqlQuestionListItem[] = [];

    while (skip < total) {
      await this.rateLimit();
      const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.leetCodeSession && {
            'Cookie': `LEETCODE_SESSION=${config.leetCodeSession}`
          }),
        },
        body: JSON.stringify({
          query,
          variables: {
            categorySlug: '',
            limit: pageSize,
            skip,
            filters: {},
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch GraphQL question list: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as GraphqlQuestionListResponse;
      if (result.errors && result.errors.length > 0) {
        throw new Error(`GraphQL error: ${result.errors[0].message}`);
      }

      const list = result.data?.problemsetQuestionList;
      if (!list) {
        throw new Error('GraphQL question list response missing data');
      }

      total = list.total;
      allQuestions.push(...list.questions);
      skip += pageSize;
    }

    return allQuestions;
  }

  getCppTemplate(codeSnippets: Array<{ langSlug: string; code: string }>): string {
    const cpp = codeSnippets.find(s => s.langSlug === 'cpp' || s.langSlug === 'c++');
    return cpp?.code || '';
  }
}

export function createLeetCodeClient(): LeetCodeClient {
  return new LeetCodeClient();
}
