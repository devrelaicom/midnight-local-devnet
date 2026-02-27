// src/mcp/tools/health.ts
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { checkAllHealth } from '../../core/health.js';
import { defaultConfig, DOCKER_IMAGES } from '../../core/config.js';

export function registerHealthTools(server: McpServer): void {
  server.tool(
    'health-check',
    'Check health of all network services by hitting their endpoints.',
    {},
    async () => {
      const health = await checkAllHealth();
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
          text: JSON.stringify({ ...defaultConfig, images: DOCKER_IMAGES }, null, 2),
        }],
      };
    },
  );
}
