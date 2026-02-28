import { Hono } from 'hono';
import { WebSocketServer, type WebSocket as WsWebSocket } from 'ws';
import type { Server } from 'node:http';
import type { NetworkConfig } from '../../core/types.js';
import type { NetworkManager } from '../../core/network-manager.js';
import { StateCollector, type WalletInfo, type PollingConfig, type WalletSyncStatus } from './state-collector.js';
import { generateDashboardHtml } from './html.js';
import { getWalletBalances, getWalletAddress, deriveAddressFromMnemonic } from '../../core/wallet.js';

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
  let pollingTimer: ReturnType<typeof setInterval> | null = null;

  // ---------- Per-service polling intervals ----------
  const intervals: Record<string, number> = {
    node: 5000,
    indexer: 5000,
    proofServer: 5000,
    proofVersions: 600_000,
    docker: 5000,
    health: 5000,
  };
  const validServices = new Set(Object.keys(intervals));
  const lastFetch: Record<string, number> = {};

  // ---------- Wallet sync state ----------
  let walletSyncStatus: WalletSyncStatus = 'idle';
  let walletSyncPromise: Promise<void> | null = null;
  let masterWalletAddress: string | null = null;

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
      const msg = JSON.parse(text) as {
        type?: string;
        action?: string;
        mnemonic?: string;
        service?: string;
        interval?: number;
      };

      if (msg.type === 'command' && msg.action) {
        await handleCommand(ws, msg.action, msg);
      }
    } catch {
      // Ignore malformed messages
    }
  }

  async function handleCommand(
    ws: WsWebSocket,
    action: string,
    msg: { mnemonic?: string; service?: string; interval?: number },
  ) {
    try {
      if (action === 'start') {
        await manager.start({ pull: false });
      } else if (action === 'stop') {
        await manager.stop({ removeVolumes: false });
      } else if (action === 'sync-wallet') {
        const started = handleSyncWallet();
        sendToClient(ws, { type: 'result', action, success: true, started });
        return;
      } else if (action === 'derive-address') {
        const mnemonic = msg.mnemonic;
        if (!mnemonic) {
          sendToClient(ws, { type: 'result', action, success: false, error: 'Missing mnemonic' });
          return;
        }
        try {
          const address = deriveAddressFromMnemonic(mnemonic, config.networkId);
          sendToClient(ws, { type: 'derive-result', address });
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          sendToClient(ws, { type: 'result', action, success: false, error });
        }
        return;
      } else if (action === 'set-polling') {
        const { service, interval } = msg;
        if (!service || !validServices.has(service) || typeof interval !== 'number' || interval < 1000) {
          sendToClient(ws, {
            type: 'result',
            action,
            success: false,
            error: 'Invalid service or interval (min 1000ms)',
          });
          return;
        }
        intervals[service] = interval;
        broadcast({ type: 'polling-updated', service, interval });
        sendToClient(ws, { type: 'result', action, success: true });
        return;
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

  // ---------- Wallet sync ----------
  function handleSyncWallet(): boolean {
    // Prevent concurrent wallet sync operations
    if (walletSyncPromise) return false;

    walletSyncStatus = 'syncing';
    broadcast({ type: 'wallet-sync-status', status: walletSyncStatus });

    walletSyncPromise = (async () => {
      try {
        const ctx = await manager.ensureWallet();
        masterWalletAddress = getWalletAddress(ctx);
        walletSyncStatus = 'synced';
      } catch {
        walletSyncStatus = 'error';
      } finally {
        walletSyncPromise = null;
        broadcast({ type: 'wallet-sync-status', status: walletSyncStatus });
      }
    })();

    return true;
  }

  function sendToClient(ws: WsWebSocket, data: unknown) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  function broadcastRaw(json: string) {
    for (const ws of clients) {
      if (ws.readyState === ws.OPEN) {
        ws.send(json);
      }
    }
  }

  function broadcast(data: unknown) {
    broadcastRaw(JSON.stringify(data));
  }

  // ---------- Tick-based polling + broadcast ----------
  function tick(): void {
    const now = Date.now();
    const polling: PollingConfig = {};

    for (const [key, interval] of Object.entries(intervals)) {
      const shouldFetch = !lastFetch[key] || (now - lastFetch[key]) >= interval;
      (polling as Record<string, boolean>)[key] = shouldFetch;
      if (shouldFetch) lastFetch[key] = now;
    }

    collectAndBroadcast(polling);
  }

  async function collectAndBroadcast(polling?: PollingConfig): Promise<void> {
    try {
      let walletInfo: WalletInfo | undefined;

      const walletCtx = manager.getMasterWallet();
      if (walletCtx) {
        try {
          const balances = await getWalletBalances(walletCtx);
          walletInfo = {
            address: masterWalletAddress,
            connected: true,
            unshielded: balances.unshielded.toString(),
            shielded: balances.shielded.toString(),
            dust: balances.dust.toString(),
          };
        } catch {
          walletInfo = {
            address: masterWalletAddress,
            connected: false,
            unshielded: '0',
            shielded: '0',
            dust: '0',
          };
        }
      }

      const state = await collector.collect({
        walletInfo,
        networkStatus: manager.getStatus(),
        polling,
        walletSyncStatus,
      });

      // JSON.stringify with bigint-safe replacer (just in case)
      const json = JSON.stringify({ type: 'state', data: state }, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      );

      broadcastRaw(json);
    } catch {
      // Swallow polling errors to keep the interval running
    }
  }

  function startPolling(): void {
    // Collect immediately (all services), then use tick-based polling
    collectAndBroadcast();
    pollingTimer = setInterval(tick, 1000);
  }

  function stopPolling(): void {
    if (pollingTimer !== null) {
      clearInterval(pollingTimer);
      pollingTimer = null;
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
