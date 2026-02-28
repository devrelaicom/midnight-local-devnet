import type { Command } from 'commander';
import type { NetworkManager } from '../../core/network-manager.js';
import { createServer } from 'node:net';

async function findOpenPort(start: number, maxAttempts = 10): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = start + i;
    const available = await new Promise<boolean>((resolve) => {
      const server = createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close(() => resolve(true));
      });
      server.listen(port, '127.0.0.1');
    });
    if (available) return port;
  }
  throw new Error(`No open port found in range ${start}-${start + maxAttempts - 1}`);
}

export function registerDashboardCommand(program: Command, manager: NetworkManager): void {
  program
    .command('dashboard')
    .description('Open browser dashboard for the local devnet')
    .option('--port <port>', 'Port to serve dashboard on', '31780')
    .option('--no-open', 'Do not auto-open the browser')
    .action(async (opts) => {
      const { createDashboardApp } = await import('../dashboard/server.js');
      const { serve } = await import('@hono/node-server');
      const open = (await import('open')).default;

      const preferredPort = parseInt(opts.port, 10);
      const port = await findOpenPort(preferredPort);

      // Detect if network is already running before creating the app
      await manager.detectRunningNetwork();

      const { app, setupWebSocket, startPolling, shutdown } = createDashboardApp({
        config: manager.config,
        manager,
        port,
      });

      const server = serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }, (info) => {
        const url = `http://localhost:${info.port}`;
        console.log(`Dashboard running at ${url}`);
        console.log('Press Ctrl+C to stop\n');

        if (opts.open !== false) {
          open(url).catch(() => {
            // Ignore browser open errors
          });
        }
      });

      const wss = setupWebSocket(server as any);
      startPolling();

      const gracefulShutdown = async () => {
        console.log('\nShutting down dashboard...');
        shutdown();
        wss.close();
        await new Promise<void>((resolve) => (server as any).close(() => resolve()));
        await manager.shutdown();
        process.exit(0);
      };

      process.on('SIGINT', gracefulShutdown);
      process.on('SIGTERM', gracefulShutdown);
    });
}
