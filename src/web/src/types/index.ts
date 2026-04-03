export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export type ProblemStatus = 'TODO' | 'ATTEMPTED' | 'SOLVED';

export interface Topic {
  id: string;
  slug: string;
  name: string;
  description: string;
  problemCount: number;
  solvedCount: number;
  icon?: string;
}

export interface ProblemExample {
  input: string;
  output: string;
  explanation?: string;
}

export interface Problem {
  id: string;
  slug: string;
  leetcodeId: number;
  leetcodeUrl: string;
  title: string;
  difficulty: Difficulty;
  status?: ProblemStatus;

  // LeetCode fields (direct copy)
  statement: string;
  constraints: string[];
  examples: ProblemExample[];
  hints: string[];

  // Mistral-generated content (Call 1)
  content: {
    intuition: string;
    keyObservations: string[];
    approach: string[];
    pseudocode: string[];
    pitfalls: string[];
    timeComplexity: string;
    spaceComplexity: string;
  };

  // Mistral-generated code (Call 2)
  code: {
    cpp: string;
    python?: string;
    java?: string;
  };

  topicSlug?: string;
}

export interface ProblemSet {
  id: string;
  slug: string;
  name: string;
  description: string;
  topicIds: string[];
  problemCount: number;
}

export interface GraphData {
  topics: Topic[];
  problems: Problem[];
  problemSets: ProblemSet[];
  topicToProblems: Record<string, string[]>;
  problemSetToTopics: Record<string, string[]>;
}

export interface TopicFilter {
  difficulty?: Difficulty;
  status?: ProblemStatus;
  search?: string;
}

export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export interface CosmosDbConfig {
  endpoint: string;
  key: string;
  databaseId: string;
}
