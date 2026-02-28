import { usePolling } from './use-polling.js';
import {
  fetchProofServerVersion,
  fetchProofServerReady,
  fetchProofVersions,
  type ProofServerReady,
} from '../lib/proof-server-api.js';

export interface ProofServerInfo {
  version: string | null;
  proofVersions: string[] | null;
  ready: ProofServerReady | null;
}

async function fetchAllProofServerInfo(baseUrl: string): Promise<ProofServerInfo> {
  const [version, ready, proofVersions] = await Promise.all([
    fetchProofServerVersion(baseUrl),
    fetchProofServerReady(baseUrl),
    fetchProofVersions(baseUrl),
  ]);
  return { version, ready, proofVersions };
}

export function useProofServer(proofServerUrl: string) {
  return usePolling(() => fetchAllProofServerInfo(proofServerUrl), 10000);
}
