import { usePolling } from './use-polling.js';

export interface IndexerInfo {
  ready: boolean;
  responseTime: number | null;
}

async function fetchIndexerInfo(indexerUrl: string): Promise<IndexerInfo> {
  const origin = new URL(indexerUrl).origin;
  const start = Date.now();
  try {
    const response = await fetch(`${origin}/ready`, { signal: AbortSignal.timeout(5000) });
    return {
      ready: response.ok,
      responseTime: Date.now() - start,
    };
  } catch {
    return { ready: false, responseTime: Date.now() - start };
  }
}

export function useIndexerInfo(indexerUrl: string) {
  return usePolling(() => fetchIndexerInfo(indexerUrl), 10000);
}
