// src/index.ts
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './mcp/server.js';
import { NetworkManager } from './core/network-manager.js';

async function main() {
  const manager = new NetworkManager();

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
