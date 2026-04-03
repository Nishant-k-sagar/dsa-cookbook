import { useState, useEffect, useMemo } from 'react';
import { getTopics } from '../services/dataService';
import type { Topic } from '../types';
import { useDebounce } from './useDebounce';

interface UseTopicsWithSearchResult {
  topics: Topic[];
  filteredTopics: Topic[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export function useTopicsWithSearch(): UseTopicsWithSearchResult {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadTopics() {
      try {
        const data = await getTopics();
        setTopics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load topics');
      } finally {
        setLoading(false);
      }
    }
    loadTopics();
  }, []);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const filteredTopics = useMemo(() => {
    if (!debouncedSearchQuery) return topics;
    const sanitizedQuery = debouncedSearchQuery
      .replace(/[<>]/g, '')
      .trim()
      .toLowerCase();
    if (!sanitizedQuery) return topics;
    return topics.filter((topic: Topic) =>
      topic.name.toLowerCase().includes(sanitizedQuery) ||
      topic.description.toLowerCase().includes(sanitizedQuery)
    );
  }, [topics, debouncedSearchQuery]);

  return {
    topics,
    filteredTopics,
    loading,
    error,
    searchQuery,
    setSearchQuery,
  };
}
