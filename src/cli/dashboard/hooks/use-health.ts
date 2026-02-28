import { useRef } from 'react';
import { usePolling } from './use-polling.js';
import { checkAllHealth, type HealthReport } from '../../../core/health.js';
import type { NetworkConfig } from '../../../core/types.js';

export interface HealthWithHistory {
  current: HealthReport;
  nodeHistory: number[];
  indexerHistory: number[];
  proofServerHistory: number[];
}

const MAX_HISTORY = 30;

export function useHealth(config: NetworkConfig) {
  const nodeHistory = useRef<number[]>([]);
  const indexerHistory = useRef<number[]>([]);
  const proofServerHistory = useRef<number[]>([]);

  const polling = usePolling(async (): Promise<HealthWithHistory> => {
    const report = await checkAllHealth(config);

    if (report.node.responseTime != null) {
      nodeHistory.current.push(report.node.responseTime);
      if (nodeHistory.current.length > MAX_HISTORY) nodeHistory.current.shift();
    }
    if (report.indexer.responseTime != null) {
      indexerHistory.current.push(report.indexer.responseTime);
      if (indexerHistory.current.length > MAX_HISTORY) indexerHistory.current.shift();
    }
    if (report.proofServer.responseTime != null) {
      proofServerHistory.current.push(report.proofServer.responseTime);
      if (proofServerHistory.current.length > MAX_HISTORY) proofServerHistory.current.shift();
    }

    return {
      current: report,
      nodeHistory: [...nodeHistory.current],
      indexerHistory: [...indexerHistory.current],
      proofServerHistory: [...proofServerHistory.current],
    };
  }, 10000);

  return polling;
}
