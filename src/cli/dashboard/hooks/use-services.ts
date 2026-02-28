import { usePolling, type PollingState } from './use-polling.js';
import { composePs } from '../../../core/docker.js';
import type { ServiceStatus } from '../../../core/types.js';

export function useServices(): PollingState<ServiceStatus[]> {
  return usePolling(() => composePs(), 5000);
}
