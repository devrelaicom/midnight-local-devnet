#!/usr/bin/env node
// src/index.ts
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './mcp/server.js';
import { NetworkManager } from './core/network-manager.js';
import { createLogger } from './core/logger.js';
import { setLogger as setWalletLogger } from './core/wallet.js';
import { setLogger as setFundingLogger } from './core/funding.js';
import { setLogger as setAccountsLogger } from './core/accounts.js';

async function main() {
  const manager = new NetworkManager();

  const logger = createLogger();
  setWalletLogger(logger);
  setFundingLogger(logger);
  setAccountsLogger(logger);
  manager.setLogger(logger);

  // Detect if network is already running (recovers state after restart)
  await manager.detectRunningNetwork();

  const server = createServer(manager);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Graceful shutdown: close wallet but leave Docker containers running
  const shutdown = async () => {
    await manager.shutdown();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
