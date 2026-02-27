// src/mcp/tools/health.ts
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NetworkManager } from '../../core/network-manager.js';
import { checkAllHealth } from '../../core/health.js';
import { DOCKER_IMAGES } from '../../core/config.js';

export function registerHealthTools(server: McpServer, manager: NetworkManager): void {
  server.tool(
    'health-check',
    'Check health of all network services by hitting their endpoints.',
    {},
    async () => {
      const health = await checkAllHealth(manager.config);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(health, null, 2) }],
      };
    },
  );

  server.tool(
    'get-network-config',
    'Get all endpoint URLs, network ID, and Docker image versions for connecting a DApp.',
    {},
    async () => {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ ...manager.config, images: DOCKER_IMAGES }, null, 2),
        }],
      };
    },
  );
}
