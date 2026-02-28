import { Hono } from 'hono';
import { WebSocketServer, type WebSocket as WsWebSocket } from 'ws';
import type { Server } from 'node:http';
import type { NetworkConfig } from '../../core/types.js';
import type { NetworkManager } from '../../core/network-manager.js';
import { StateCollector, type WalletInfo } from './state-collector.js';
import { generateDashboardHtml } from './html.js';
import { getWalletBalances } from '../../core/wallet.js';

export interface DashboardServerOptions {
  config: NetworkConfig;
  manager: NetworkManager;
  port: number;
}

export function createDashboardApp(opts: DashboardServerOptions) {
  const { config, manager, port } = opts;
  const app = new Hono();
  const collector = new StateCollector(config);
  const clients = new Set<WsWebSocket>();
  let pollingInterval: ReturnType<typeof setInterval> | null = null;

  // ---------- GET / — serve dashboard HTML ----------
  app.get('/', (c) => {
    const html = generateDashboardHtml({ wsUrl: `ws://localhost:${port}/ws` });
    return c.html(html);
  });

  // ---------- WebSocket setup ----------
  function setupWebSocket(server: Server): WebSocketServer {
    const wss = new WebSocketServer({ server, path: '/ws' });

    wss.on('connection', (ws: WsWebSocket) => {
      clients.add(ws);

      ws.on('close', () => {
        clients.delete(ws);
      });

      ws.on('message', (raw: Buffer | ArrayBuffer | Buffer[]) => {
        handleClientMessage(ws, raw);
      });
    });

    return wss;
  }

  // ---------- Client message handling ----------
  async function handleClientMessage(ws: WsWebSocket, raw: Buffer | ArrayBuffer | Buffer[]) {
    try {
      const text = typeof raw === 'string' ? raw : raw.toString();
      const msg = JSON.parse(text) as { type?: string; action?: string };

      if (msg.type === 'command' && msg.action) {
        await handleCommand(ws, msg.action);
      }
    } catch {
      // Ignore malformed messages
    }
  }

  async function handleCommand(ws: WsWebSocket, action: string) {
    try {
      if (action === 'start') {
        await manager.start({ pull: false });
      } else if (action === 'stop') {
        await manager.stop({ removeVolumes: false });
      } else {
        sendToClient(ws, { type: 'result', action, success: false, error: `Unknown action: ${action}` });
        return;
      }
      sendToClient(ws, { type: 'result', action, success: true });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      sendToClient(ws, { type: 'result', action, success: false, error });
    }
  }

  function sendToClient(ws: WsWebSocket, data: unknown) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  // ---------- Polling + broadcast ----------
  async function collectAndBroadcast(): Promise<void> {
    try {
      let walletInfo: WalletInfo | undefined;

      const walletCtx = manager.getMasterWallet();
      if (walletCtx) {
        try {
          const balances = await getWalletBalances(walletCtx);
          walletInfo = {
            address: null, // Address extraction requires wallet SDK; use null for MVP
            connected: true,
            unshielded: balances.unshielded.toString(),
            shielded: balances.shielded.toString(),
            dust: balances.dust.toString(),
          };
        } catch {
          walletInfo = {
            address: null,
            connected: false,
            unshielded: '0',
            shielded: '0',
            dust: '0',
          };
        }
      }

      const state = await collector.collect(walletInfo, manager.getStatus());

      // JSON.stringify with bigint-safe replacer (just in case)
      const json = JSON.stringify({ type: 'state', data: state }, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      );

      for (const ws of clients) {
        if (ws.readyState === ws.OPEN) {
          ws.send(json);
        }
      }
    } catch {
      // Swallow polling errors to keep the interval running
    }
  }

  function startPolling(): void {
    // Collect immediately, then every 3 seconds
    collectAndBroadcast();
    pollingInterval = setInterval(collectAndBroadcast, 3000);
  }

  function stopPolling(): void {
    if (pollingInterval !== null) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  }

  function shutdown(): void {
    stopPolling();
    for (const ws of clients) {
      ws.close();
    }
    clients.clear();
  }

  return {
    app,
    setupWebSocket,
    startPolling,
    stopPolling,
    shutdown,
  };
}
