export interface ProofServerHealth {
  status: string;
  timestamp: string;
}

export interface ProofServerReady {
  status: 'ok' | 'busy';
  jobsProcessing: number;
  jobsPending: number;
  jobCapacity: number;
  timestamp: string;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return await response.json() as T;
  } catch {
    return null;
  }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

export function fetchProofServerHealth(baseUrl: string): Promise<ProofServerHealth | null> {
  return fetchJson<ProofServerHealth>(`${baseUrl}/health`);
}

export async function fetchProofServerVersion(baseUrl: string): Promise<string | null> {
  return fetchText(`${baseUrl}/version`);
}

export async function fetchProofServerReady(baseUrl: string): Promise<ProofServerReady | null> {
  try {
    const response = await fetch(`${baseUrl}/ready`, { signal: AbortSignal.timeout(5000) });
    // /ready returns JSON even on 503
    return await response.json() as ProofServerReady;
  } catch {
    return null;
  }
}

export async function fetchProofVersions(baseUrl: string): Promise<string[] | null> {
  const text = await fetchText(`${baseUrl}/proof-versions`);
  if (!text) return null;
  try {
    return JSON.parse(text) as string[];
  } catch {
    return null;
  }
}
