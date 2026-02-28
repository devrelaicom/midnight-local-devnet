import { useState, useEffect, useRef } from 'react';
import { usePolling } from './use-polling.js';
import {
  fetchSystemChain,
  fetchSystemName,
  fetchSystemVersion,
  fetchSystemHealth,
  fetchBestBlockHeader,
  type SystemHealth,
} from '../lib/substrate-rpc.js';

export interface NodeInfo {
  chainName: string | null;
  nodeName: string | null;
  version: string | null;
  health: SystemHealth | null;
  bestBlock: number | null;
  avgBlockTime: number | null;
}

async function fetchNodeInfo(nodeUrl: string): Promise<NodeInfo> {
  const [chainName, nodeName, version, health, header] = await Promise.all([
    fetchSystemChain(nodeUrl),
    fetchSystemName(nodeUrl),
    fetchSystemVersion(nodeUrl),
    fetchSystemHealth(nodeUrl),
    fetchBestBlockHeader(nodeUrl),
  ]);

  return {
    chainName,
    nodeName,
    version,
    health,
    bestBlock: header?.number ?? null,
    avgBlockTime: null,
  };
}

export function useNodeInfo(nodeUrl: string) {
  const blockHistory = useRef<{ block: number; time: number }[]>([]);
  const polling = usePolling(() => fetchNodeInfo(nodeUrl), 5000);

  useEffect(() => {
    if (polling.data?.bestBlock != null) {
      const now = Date.now();
      const history = blockHistory.current;
      history.push({ block: polling.data.bestBlock, time: now });
      if (history.length > 20) history.shift();
    }
  }, [polling.data?.bestBlock]);

  const avgBlockTime = (() => {
    const history = blockHistory.current;
    if (history.length < 2) return null;
    const first = history[0];
    const last = history[history.length - 1];
    const blockDiff = last.block - first.block;
    if (blockDiff <= 0) return null;
    return (last.time - first.time) / blockDiff / 1000;
  })();

  return {
    ...polling,
    data: polling.data ? { ...polling.data, avgBlockTime } : null,
  };
}
