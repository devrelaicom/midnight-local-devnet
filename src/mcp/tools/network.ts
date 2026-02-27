// src/mcp/tools/network.ts
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NetworkManager } from '../../core/network-manager.js';

export function registerNetworkTools(server: McpServer, manager: NetworkManager): void {
  server.tool(
    'start-network',
    'Start the local Midnight development network (node, indexer, proof-server). Initializes the genesis master wallet and registers DUST.',
    { pull: z.boolean().optional().describe('Pull latest Docker images before starting') },
    async ({ pull }) => {
      const result = await manager.start({ pull: pull ?? false });
      if (result === 'already-running') {
        return { content: [{ type: 'text' as const, text: 'Network is already running.' }] };
      }
      const services = await manager.getServices();
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            status: 'running',
            services: services.map((s) => ({ name: s.name, url: s.url, port: s.port })),
            config: manager.config,
          }, null, 2),
        }],
      };
    },
  );

  server.tool(
    'stop-network',
    'Stop the local Midnight development network and close all wallets.',
    { removeVolumes: z.boolean().optional().describe('Remove volumes (clean slate)') },
    async ({ removeVolumes }) => {
      await manager.stop({ removeVolumes: removeVolumes ?? false });
      return { content: [{ type: 'text' as const, text: 'Network stopped.' }] };
    },
  );

  server.tool(
    'restart-network',
    'Restart the network. With removeVolumes, performs a clean-slate restart.',
    {
      pull: z.boolean().optional().describe('Pull latest Docker images'),
      removeVolumes: z.boolean().optional().describe('Remove volumes for clean restart'),
    },
    async ({ pull, removeVolumes }) => {
      await manager.restart({
        pull: pull ?? false,
        removeVolumes: removeVolumes ?? false,
      });
      const services = await manager.getServices();
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            status: 'running',
            services: services.map((s) => ({ name: s.name, url: s.url, port: s.port })),
          }, null, 2),
        }],
      };
    },
  );

  server.tool(
    'network-status',
    'Get current network status including per-service container status.',
    {},
    async () => {
      const status = manager.getStatus();
      if (status === 'stopped') {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ status: 'stopped', services: [] }) }],
        };
      }
      const services = await manager.getServices();
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ status, services }, null, 2) }],
      };
    },
  );

  server.tool(
    'network-logs',
    'Get recent logs from network services.',
    {
      service: z.enum(['node', 'indexer', 'proof-server']).optional().describe('Specific service'),
      lines: z.number().optional().describe('Number of log lines (default: 50)'),
    },
    async ({ service, lines }) => {
      const logs = await manager.getLogs({ service, lines });
      return { content: [{ type: 'text' as const, text: logs }] };
    },
  );
}
