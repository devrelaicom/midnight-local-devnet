export interface SystemHealth {
  peers: number;
  isSyncing: boolean;
  shouldHavePeers: boolean;
}

export interface BlockHeader {
  number: number;
  parentHash: string;
  stateRoot: string;
  extrinsicsRoot: string;
}

async function rpcCall<T>(url: string, method: string, params: unknown[] = []): Promise<T | null> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(5000),
    });
    const json = (await response.json()) as { result: T };
    return json.result;
  } catch {
    return null;
  }
}

export function fetchSystemChain(url: string): Promise<string | null> {
  return rpcCall<string>(url, 'system_chain');
}

export function fetchSystemName(url: string): Promise<string | null> {
  return rpcCall<string>(url, 'system_name');
}

export function fetchSystemVersion(url: string): Promise<string | null> {
  return rpcCall<string>(url, 'system_version');
}

export function fetchSystemHealth(url: string): Promise<SystemHealth | null> {
  return rpcCall<SystemHealth>(url, 'system_health');
}

export async function fetchBestBlockHeader(url: string): Promise<BlockHeader | null> {
  const raw = await rpcCall<{
    number: string;
    parentHash: string;
    stateRoot: string;
    extrinsicsRoot: string;
  }>(url, 'chain_getHeader');
  if (!raw) return null;
  return {
    number: parseInt(raw.number, 16),
    parentHash: raw.parentHash,
    stateRoot: raw.stateRoot,
    extrinsicsRoot: raw.extrinsicsRoot,
  };
}
