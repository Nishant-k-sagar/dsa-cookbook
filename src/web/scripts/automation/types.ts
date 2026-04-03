export const SEED_SCHEMA_VERSION = 1;
export const GENERATED_SCHEMA_VERSION = 1;

export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type Importance = 'Crucial' | 'Optional';

export interface LeetCodeProblemSummary {
  id: number;
  slug: string;
  title: string;
  difficulty: Difficulty;
  tags: string[];
  paidOnly: boolean;
  totalAccepted?: number;
  totalSubmitted?: number;
  acceptanceRate?: number;
  frequency?: number;
}

export interface LeetCodeTopicTag {
  name: string;
  slug: string;
}

export interface LeetCodeCodeSnippet {
  langSlug: string;
  code: string;
}

export interface LeetCodeProblem {
  questionId: number;
  title: string;
  difficulty: Difficulty;
  content: string;
  exampleTestcases: string;
  hints: string[];
  topicTags: LeetCodeTopicTag[];
  codeSnippets: LeetCodeCodeSnippet[];
}

export interface SeedProblem {
  platform: 'LeetCode';
  id: number;
  slug: string;
  title: string;
  category: string;
}

export interface SeedFile {
  schemaVersion: number;
  topic: string;
  topicSlug: string;
  generatedAt: string;
  problems: SeedProblem[];
}

export interface ProblemContent {
  statement: string;
  constraints: string;
  examples: string;
  hints: string[];
  key_observations: string[];
  intuition: string;
  approach: string[];
  pseudocode: string[];
  connection_to_subtopic: string;
}

export interface ProblemCode {
  cpp: string;
}

export interface GeneratedProblem {
  id: string;
  title: string;
  topic_id: string;
  subtopic_id: string;
  leetcode_id: number;
  leetcode_slug: string;
  leetcode_url: string;
  source: string;
  difficulty: Difficulty;
  importance: Importance;
  rating: number;
  difficulty_bucket: string;
  tags: string[];
  time_complexity: string;
  space_complexity: string;
  pitfalls: string[];
  content: ProblemContent;
  code: ProblemCode;
}

export interface Subtopic {
  id: string;
  title: string;
  description: string;
}

export interface TopicContent {
  id: string;
  title: string;
  summary: string;
  lc_rating_range: [number, number];
  target_audience: string;
  prerequisites: string[];
  patterns: string[];
  subtopics: Subtopic[];
  time_complexity: string;
  space_complexity: string;
  pitfalls: string[];
  edge_cases: string[];
  content: {
    introduction: string;
    key_patterns: string;
    common_pitfalls: string;
    when_to_use: string;
    related_topics: string;
  };
  problemCount: number;
}

export interface GeneratedFile {
  schemaVersion: number;
  topic: TopicContent;
  problems: GeneratedProblem[];
}

export interface TopicConfig {
  name: string;
  slug: string;
  tags: string[];
  problemCount: number;
}

export const TOPIC_CONFIGS: TopicConfig[] = [
  {
    name: 'Arrays',
    slug: 'arrays',
    tags: ['Array', 'Hash Table'],
    problemCount: 8
  },
  {
    name: 'Dynamic Programming',
    slug: 'dynamic-programming',
    tags: ['Dynamic Programming'],
    problemCount: 16
  },
  {
    name: 'Trees',
    slug: 'trees',
    tags: ['Tree', 'Binary Tree', 'Binary Search Tree'],
    problemCount: 16
  },
  {
    name: 'Binary Search',
    slug: 'binary-search',
    tags: ['Binary Search'],
    problemCount: 8
  },
  {
    name: 'Two Pointers',
    slug: 'two-pointers',
    tags: ['Two Pointers', 'String'],
    problemCount: 8
  },
  {
    name: 'Sliding Window',
    slug: 'sliding-window',
    tags: ['Sliding Window'],
    problemCount: 8
  },
  {
    name: 'Linked List',
    slug: 'linked-list',
    tags: ['Linked List'],
    problemCount: 8
  },
  {
    name: 'Stack',
    slug: 'stack',
    tags: ['Stack'],
    problemCount: 8
  },
  {
    name: 'Queue',
    slug: 'queue',
    tags: ['Queue', 'Deque'],
    problemCount: 8
  },
  {
    name: 'Recursion',
    slug: 'recursion',
    tags: ['Recursion'],
    problemCount: 8
  },
  {
    name: 'Hash Table',
    slug: 'hash-table',
    tags: ['Hash Table'],
    problemCount: 8
  },
  {
    name: 'Sorting',
    slug: 'sorting',
    tags: ['Sort'],
    problemCount: 8
  },
  {
    name: 'Greedy',
    slug: 'greedy',
    tags: ['Greedy'],
    problemCount: 8
  },
  {
    name: 'Graph',
    slug: 'graph',
    tags: ['Depth-First Search', 'Breadth-First Search', 'Graph'],
    problemCount: 8
  },
  {
    name: 'Backtracking',
    slug: 'backtracking',
    tags: ['Backtracking'],
    problemCount: 8
  },
  {
    name: 'Heap / Priority Queue',
    slug: 'heap-priority-queue',
    tags: ['Heap', 'Priority Queue'],
    problemCount: 8
  }
];
