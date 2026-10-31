import { useState, useEffect, useRef } from 'react';

// Centralized simple SWR-like cache using sessionStorage
const memoryCache: Record<string, unknown> = {};

export function useAppCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  dependencies: unknown[] = []
) {
  const [data, setData] = useState<T | null>(() => {
    // Try memory first
    if (memoryCache[key]) return memoryCache[key];
    // Try sessionStorage
    try {
      const cached = sessionStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        memoryCache[key] = parsed;
        return parsed;
      }
    } catch (e) { /* ignore */ }
    return null;
  });

  const [isLoading, setIsLoading] = useState(!data);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const revalidate = async (silent = true) => {
    if (!silent) setIsLoading(true);
    setIsValidating(true);
    setError(null);
    try {
      const result = await fetcher();
      if (!mounted.current) return result;
      
      setData(result);
      memoryCache[key] = result;
      try {
        sessionStorage.setItem(key, JSON.stringify(result));
      } catch (e) { /* ignore */ }
      
      return result;
    } catch (err: unknown) {
      if (mounted.current) setError(err);
      throw err;
    } finally {
      if (mounted.current) {
        setIsLoading(false);
        setIsValidating(false);
      }
    }
  };

  useEffect(() => {
    if (!data) setIsLoading(true);
    revalidate(!!data).catch(() => {});
  }, dependencies); // Re-run when dependencies change

  return { data, isLoading, isValidating, error, revalidate, mutate: setData };
}
