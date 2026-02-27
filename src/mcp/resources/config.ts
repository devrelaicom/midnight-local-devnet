// src/mcp/resources/config.ts
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NetworkManager } from '../../core/network-manager.js';
import { defaultConfig, DOCKER_IMAGES } from '../../core/config.js';

export function registerResources(server: McpServer, manager: NetworkManager): void {
  server.resource(
    'devnet-config',
    'devnet://config',
    { description: 'Current network configuration including endpoints and image versions.', mimeType: 'application/json' },
    async (uri) => ({
      contents: [{
        uri: uri.href,
        text: JSON.stringify({ ...defaultConfig, images: DOCKER_IMAGES }, null, 2),
      }],
    }),
  );

  server.resource(
    'devnet-status',
    'devnet://status',
    { description: 'Live network status including services and health.', mimeType: 'application/json' },
    async (uri) => {
      const status = manager.getStatus();
      let services: unknown[] = [];
      if (status !== 'stopped') {
        try {
          services = await manager.getServices();
        } catch {
          // Network might be partially up
        }
      }
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify({ status, services }, null, 2),
        }],
      };
    },
  );
}
