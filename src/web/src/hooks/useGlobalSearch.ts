import { useState, useEffect, useCallback } from 'react';
import { getTopics, getProblems } from '../services/dataService';
import type { Topic, Problem } from '../types';

export interface TopicSearchResult {
  type: 'topic';
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  badge?: string;
}

export interface ProblemSearchResult {
  type: 'problem';
  problem: Problem;
}

export type SearchResult = TopicSearchResult | ProblemSearchResult;

export interface UseGlobalSearchResult {
  results: SearchResult[];
  topicResults: TopicSearchResult[];
  problemResults: Problem[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  search: (query: string) => void;
}

export function useGlobalSearch(): UseGlobalSearchResult {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [topicsData, problemsData] = await Promise.all([
          getTopics(),
          getProblems(),
        ]);
        setTopics(topicsData);
        setProblems(problemsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const search = useCallback((query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const q = query.toLowerCase();
    const searchResults: SearchResult[] = [];

    topics.forEach((topic) => {
      const nameMatch = topic.name.toLowerCase().includes(q);
      const descMatch = topic.description.toLowerCase().includes(q);
      const slugMatch = topic.slug.toLowerCase().includes(q);

      if (nameMatch || descMatch || slugMatch) {
        searchResults.push({
          type: 'topic',
          id: topic.id,
          slug: topic.slug,
          title: topic.name,
          subtitle: topic.description.slice(0, 80) + (topic.description.length > 80 ? '...' : ''),
          badge: `${topic.problemCount} problems`,
        });
      }
    });

    problems.forEach((problem) => {
      const titleMatch = problem.title.toLowerCase().includes(q);
      const leetcodeIdMatch = problem.leetcodeId.toString() === q.trim();

      const approach = problem.content?.approach;
      const approachText = Array.isArray(approach)
        ? approach.join(' ')
        : (approach ?? '');
      const approachMatch = approachText.toLowerCase().includes(q);
      const intuitionMatch = problem.content?.intuition?.toLowerCase().includes(q) ?? false;

      if (titleMatch || leetcodeIdMatch || approachMatch || intuitionMatch) {
        searchResults.push({
          type: 'problem',
          problem,
        });
      }
    });

    setResults(searchResults);
  }, [topics, problems]);

  const topicResults = results.filter((r): r is TopicSearchResult => r.type === 'topic');
  const problemResults = results.filter((r): r is ProblemSearchResult => r.type === 'problem').map((r) => r.problem);

  return {
    results,
    topicResults,
    problemResults,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    search,
  };
}