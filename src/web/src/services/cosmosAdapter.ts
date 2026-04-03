import type { Topic, Problem, ProblemSet } from '../types';

// Base URL for the Express API server that bridges to Cosmos DB.
// Use absolute URL in development to bypass Vite proxy issues.
const API_BASE = import.meta.env.VITE_COSMOS_API_URL || '/api';

// Cache configuration
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
const cache = new Map<string, { data: any; timestamp: number }>();

function getCachedData<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  if (cached) {
    cache.delete(key); // Remove expired cache
  }
  return null;
}

function setCachedData<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export function clearCache(): void {
  cache.clear();
}

interface CosmosDbTopic {
  id: string;
  slug: string;
  name: string;
  description: string;
  problemCount: number;
  solvedCount: number;
  icon?: string;
}

interface CosmosDbProblem {
  id: string;
  slug: string;
  leetcodeId: number;
  leetcodeUrl?: string;
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

async function fetchApi<T>(endpoint: string): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.error(`API Error [${response.status}]: ${url}`, errorBody);
      throw new Error(`API request failed: ${response.status} ${response.statusText}${errorBody ? ` - ${errorBody}` : ''}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error(`Expected JSON but got ${contentType} from ${url}. Body snippet: ${text.substring(0, 100)}`);
      throw new Error(`Invalid response format from API: Expected JSON but received ${contentType}`);
    }

    return response.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error(`JSON Parsing Error for ${url}:`, error);
    }
    throw error;
  }
}

function transformTopic(raw: CosmosDbTopic): Topic {
  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    description: raw.description,
    problemCount: raw.problemCount ?? 0,
    solvedCount: raw.solvedCount ?? 0,
    icon: raw.icon,
  };
}

function transformProblem(raw: CosmosDbProblem): Problem {
  return {
    id: raw.id,
    slug: raw.slug,
    leetcodeId: raw.leetcodeId,
    leetcodeUrl: raw.leetcodeUrl || `https://leetcode.com/problems/${raw.slug}/`,
    title: raw.title,
    difficulty: raw.difficulty as 'Easy' | 'Medium' | 'Hard',
    statement: raw.statement || '',
    constraints: Array.isArray(raw.constraints) ? raw.constraints : [],
    examples: Array.isArray(raw.examples) ? raw.examples : [],
    hints: Array.isArray(raw.hints) ? raw.hints : [],
    content: {
      intuition: raw.content?.intuition || '',
      keyObservations: Array.isArray(raw.content?.keyObservations) ? raw.content.keyObservations : [],
      approach: Array.isArray(raw.content?.approach) ? raw.content.approach : [],
      pseudocode: Array.isArray(raw.content?.pseudocode) ? raw.content.pseudocode : [],
      pitfalls: Array.isArray(raw.content?.pitfalls) ? raw.content.pitfalls : [],
      timeComplexity: raw.content?.timeComplexity || '',
      spaceComplexity: raw.content?.spaceComplexity || '',
    },
    code: {
      cpp: raw.code?.cpp || '',
      python: raw.code?.python,
      java: raw.code?.java,
    },
    topicSlug: raw.topicSlug,
  };
}

export async function getTopics(): Promise<Topic[]> {
  const cacheKey = 'topics';
  const cached = getCachedData<Topic[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const rawTopics = await fetchApi<CosmosDbTopic[]>('/topics');
  const topics = rawTopics.filter(t => t.slug && t.name).map(transformTopic);
  setCachedData(cacheKey, topics);
  return topics;
}

export async function getTopic(slug: string): Promise<Topic | undefined> {
  const cacheKey = `topic-${slug}`;
  const cached = getCachedData<Topic | undefined>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  try {
    const rawTopic = await fetchApi<CosmosDbTopic>(`/topics/${slug}`);
    const topic = transformTopic(rawTopic);
    setCachedData(cacheKey, topic);
    return topic;
  } catch {
    setCachedData(cacheKey, undefined);
    return undefined;
  }
}

export async function getProblems(): Promise<Problem[]> {
  const cacheKey = 'problems';
  const cached = getCachedData<Problem[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const rawProblems = await fetchApi<CosmosDbProblem[]>('/problems');
  const seen = new Set<string>();
  const uniqueProblems: Problem[] = [];
  for (const raw of rawProblems) {
    if (raw.slug && !seen.has(raw.slug)) {
      seen.add(raw.slug);
      uniqueProblems.push(transformProblem(raw));
    }
  }
  setCachedData(cacheKey, uniqueProblems);
  return uniqueProblems;
}

export async function getProblem(slug: string): Promise<Problem | undefined> {
  const cacheKey = `problem-${slug}`;
  const cached = getCachedData<Problem | undefined>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  try {
    const rawProblem = await fetchApi<CosmosDbProblem>(`/problems/${slug}`);
    const problem = transformProblem(rawProblem);
    setCachedData(cacheKey, problem);
    return problem;
  } catch {
    setCachedData(cacheKey, undefined);
    return undefined;
  }
}

export async function getProblemsForTopic(topicSlug: string): Promise<Problem[]> {
  const cacheKey = `problems-topic-${topicSlug}`;
  const cached = getCachedData<Problem[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const problems = await fetchApi<CosmosDbProblem[]>(`/topics/${topicSlug}/problems`);
  const transformedProblems = problems.filter(p => p.slug).map(transformProblem);
  setCachedData(cacheKey, transformedProblems);
  return transformedProblems;
}

/**
 * Problem Sets are simulated on the frontend because a dedicated container 
 * is not yet available in Cosmos DB, mirroring the flexible approach used in development.
 */
export async function getProblemSets(): Promise<ProblemSet[]> {
  try {
    const topics = await getTopics();
    const allTopicIds = topics.map(t => t.slug);
    const totalProblems = topics.reduce((sum, t) => sum + t.problemCount, 0);

    return [
      {
        id: 'dsa-fundamentals',
        slug: 'dsa-fundamentals',
        name: 'DSA Fundamentals',
        description: 'Master the fundamental data structures and algorithms needed for technical interviews.',
        topicIds: allTopicIds,
        problemCount: totalProblems
      },
      {
        id: 'advanced-problems',
        slug: 'advanced-problems',
        name: 'Advanced Problems',
        description: 'Challenge yourself with advanced algorithmic problems for experienced developers.',
        topicIds: allTopicIds,
        problemCount: totalProblems
      }
    ];
  } catch (error) {
    console.error('Error simulating problem sets:', error);
    return [];
  }
}

export async function getProblemSet(slug: string): Promise<ProblemSet | undefined> {
  const sets = await getProblemSets();
  return sets.find(ps => ps.slug === slug);
}

export async function getTopicsForProblemSet(problemSetSlug: string): Promise<Topic[]> {
  const problemSet = await getProblemSet(problemSetSlug);
  if (!problemSet) {
    return [];
  }

  const topicSlugs = problemSet.topicIds;
  if (topicSlugs.length === 0) {
    return [];
  }

  const allTopics = await getTopics();
  return allTopics.filter(t => topicSlugs.includes(t.slug));
}
