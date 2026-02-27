import { defaultConfig } from './config.js';
import type { NetworkConfig } from './types.js';

export interface ServiceHealth {
  healthy: boolean;
  responseTime?: number;
  error?: string;
}

export interface HealthReport {
  node: ServiceHealth;
  indexer: ServiceHealth;
  proofServer: ServiceHealth;
  allHealthy: boolean;
}

async function checkEndpoint(url: string): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return {
      healthy: response.ok,
      responseTime: Date.now() - start,
    };
  } catch (err) {
    return {
      healthy: false,
      responseTime: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function checkAllHealth(config?: NetworkConfig): Promise<HealthReport> {
  const cfg = config ?? defaultConfig;
  const [node, indexer, proofServer] = await Promise.all([
    checkEndpoint(`${cfg.node}/health`),
    checkEndpoint(cfg.indexer),
    checkEndpoint(`${cfg.proofServer}/version`),
  ]);

  return {
    node,
    indexer,
    proofServer,
    allHealthy: node.healthy && indexer.healthy && proofServer.healthy,
  };
}
