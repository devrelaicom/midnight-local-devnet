import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NetworkConfig } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DOCKER_COMPOSE_DIR = path.resolve(__dirname, '../../docker');
export const DOCKER_COMPOSE_FILE = 'standalone.yml';

// Dev-only genesis seed (private key = 1). Never use on a live network.
export const GENESIS_SEED = '0000000000000000000000000000000000000000000000000000000000000001';
export const DEFAULT_NIGHT_AMOUNT = 50_000n * 10n ** 6n; // 50,000 NIGHT in smallest unit
export const MAX_ACCOUNTS_PER_BATCH = 10;

export const DOCKER_IMAGES = {
  node: 'midnightntwrk/midnight-node:0.20.0',
  indexer: 'midnightntwrk/indexer-standalone:3.0.0',
  proofServer: 'midnightntwrk/proof-server:7.0.0',
} as const;

export const defaultConfig: NetworkConfig = {
  indexer: 'http://127.0.0.1:8088/api/v3/graphql',
  indexerWS: 'ws://127.0.0.1:8088/api/v3/graphql/ws',
  node: 'http://127.0.0.1:9944',
  proofServer: 'http://127.0.0.1:6300',
  networkId: 'undeployed',
};
