import { useState, useEffect, useCallback } from 'react';

interface UseAsyncDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAsyncData<T>(
  fetchFn: () => Promise<T>,
  dependencies: unknown[] = []
): UseAsyncDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchFn();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [fetchFn, ...dependencies]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { data, loading, error, refetch: loadData };
}