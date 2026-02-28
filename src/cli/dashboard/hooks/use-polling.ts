import { useState, useEffect, useRef } from 'react';

export function createPoller<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
  onData: (data: T) => void,
  onError: (error: unknown) => void,
): () => void {
  let stopped = false;

  const poll = async () => {
    if (stopped) return;
    try {
      const data = await fetcher();
      if (!stopped) onData(data);
    } catch (err) {
      if (!stopped) onError(err);
    }
  };

  // Initial fetch
  void poll();

  const timer = setInterval(() => void poll(), intervalMs);

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

export interface PollingState<T> {
  data: T | null;
  error: unknown | null;
  loading: boolean;
}

export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number): PollingState<T> {
  const [state, setState] = useState<PollingState<T>>({ data: null, error: null, loading: true });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    const stop = createPoller(
      () => fetcherRef.current(),
      intervalMs,
      (data) => setState({ data, error: null, loading: false }),
      (error) => setState((prev) => ({ ...prev, error, loading: false })),
    );
    return stop;
  }, [intervalMs]);

  return state;
}
