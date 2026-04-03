import type { GraphData, Topic, Problem, ProblemSet } from '../types';

const GRAPH_PATH = '/data/graph.json';

let cachedGraph: GraphData | null = null;

async function fetchGraph(): Promise<GraphData> {
  if (cachedGraph) {
    return cachedGraph;
  }

  const response = await fetch(GRAPH_PATH);

  if (!response.ok) {
    throw new Error(`Failed to fetch graph data: ${response.statusText}`);
  }

  cachedGraph = await response.json();
  return cachedGraph!;
}

export async function getTopics(): Promise<Topic[]> {
  const graph = await fetchGraph();
  return graph.topics;
}

export async function getTopic(slug: string): Promise<Topic | undefined> {
  const graph = await fetchGraph();
  return graph.topics.find(t => t.slug === slug);
}

export async function getProblems(): Promise<Problem[]> {
  const graph = await fetchGraph();
  const seen = new Set<string>();
  const uniqueProblems: Problem[] = [];
  for (const problem of graph.problems) {
    if (!seen.has(problem.slug)) {
      seen.add(problem.slug);
      uniqueProblems.push(problem);
    }
  }
  return uniqueProblems;
}

export async function getProblem(slug: string): Promise<Problem | undefined> {
  const graph = await fetchGraph();
  const problem = graph.problems.find(p => p.slug === slug);
  if (!problem) return undefined;
  
  const topicSlug = Object.entries(graph.topicToProblems)
    .find(([, pids]) => pids.includes(problem.id))?.[0];
  
  return { ...problem, topicSlug } as Problem;
}

export async function getProblemsForTopic(topicSlug: string): Promise<Problem[]> {
  const graph = await fetchGraph();
  const problemIds = graph.topicToProblems[topicSlug] || [];
  return graph.problems.filter(p => problemIds.includes(p.id));
}

export async function getProblemSets(): Promise<ProblemSet[]> {
  const graph = await fetchGraph();
  return graph.problemSets;
}

export async function getProblemSet(slug: string): Promise<ProblemSet | undefined> {
  const graph = await fetchGraph();
  return graph.problemSets.find(ps => ps.slug === slug);
}

export async function getTopicsForProblemSet(problemSetSlug: string): Promise<Topic[]> {
  const graph = await fetchGraph();
  const topicIds = graph.problemSetToTopics[problemSetSlug] || [];
  return graph.topics.filter(t => topicIds.includes(t.id));
}

export function clearCache(): void {
  cachedGraph = null;
}