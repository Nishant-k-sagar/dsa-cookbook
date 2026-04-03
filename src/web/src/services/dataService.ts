import type { Topic, Problem, ProblemSet } from '../types';
import * as localAdapter from './localAdapter';
import * as cosmosAdapter from './cosmosAdapter';

const DATA_SOURCE = import.meta.env.VITE_DATA_SOURCE;

async function getTopics(): Promise<Topic[]> {
  if (DATA_SOURCE === 'cosmosdb') {
    return cosmosAdapter.getTopics();
  }
  return localAdapter.getTopics();
}

async function getTopic(slug: string): Promise<Topic | undefined> {
  if (DATA_SOURCE === 'cosmosdb') {
    return cosmosAdapter.getTopic(slug);
  }
  return localAdapter.getTopic(slug);
}

async function getProblems(): Promise<Problem[]> {
  if (DATA_SOURCE === 'cosmosdb') {
    return cosmosAdapter.getProblems();
  }
  return localAdapter.getProblems();
}

async function getProblem(slug: string): Promise<Problem | undefined> {
  if (DATA_SOURCE === 'cosmosdb') {
    return cosmosAdapter.getProblem(slug);
  }
  return localAdapter.getProblem(slug);
}

async function getProblemsForTopic(topicSlug: string): Promise<Problem[]> {
  if (DATA_SOURCE === 'cosmosdb') {
    return cosmosAdapter.getProblemsForTopic(topicSlug);
  }
  return localAdapter.getProblemsForTopic(topicSlug);
}

async function getProblemSets(): Promise<ProblemSet[]> {
  if (DATA_SOURCE === 'cosmosdb') {
    return cosmosAdapter.getProblemSets();
  }
  return localAdapter.getProblemSets();
}

async function getProblemSet(slug: string): Promise<ProblemSet | undefined> {
  if (DATA_SOURCE === 'cosmosdb') {
    return cosmosAdapter.getProblemSet(slug);
  }
  return localAdapter.getProblemSet(slug);
}

async function getTopicsForProblemSet(problemSetSlug: string): Promise<Topic[]> {
  if (DATA_SOURCE === 'cosmosdb') {
    return cosmosAdapter.getTopicsForProblemSet(problemSetSlug);
  }
  return localAdapter.getTopicsForProblemSet(problemSetSlug);
}

function clearCache(): void {
  if (DATA_SOURCE === 'cosmosdb') {
    cosmosAdapter.clearCache();
    return;
  }
  localAdapter.clearCache();
}

export {
  getTopics,
  getTopic,
  getProblems,
  getProblem,
  getProblemsForTopic,
  getProblemSets,
  getProblemSet,
  getTopicsForProblemSet,
  clearCache,
};