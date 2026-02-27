// src/mcp/server.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NetworkManager } from '../core/network-manager.js';
import { registerNetworkTools } from './tools/network.js';
import { registerHealthTools } from './tools/health.js';
import { registerWalletTools } from './tools/wallet.js';
import { registerFundingTools } from './tools/funding.js';
import { registerAccountTools } from './tools/accounts.js';
import { registerResources } from './resources/config.js';

export function createServer(manager: NetworkManager): McpServer {
  const server = new McpServer(
    {
      name: 'midnight-local-devnet',
      version: '0.1.0',
    },
    {
      capabilities: {
        logging: {},
        resources: {},
        tools: {},
      },
    },
  );

  registerNetworkTools(server, manager);
  registerHealthTools(server);
  registerWalletTools(server, manager);
  registerFundingTools(server, manager);
  registerAccountTools(server, manager);
  registerResources(server, manager);

  return server;
}
