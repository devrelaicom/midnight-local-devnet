// src/core/network-manager.ts
import type { Logger } from 'pino';
import type { NetworkConfig, NetworkStatus, ServiceStatus } from './types.js';
import { DevnetError } from './types.js';
import { defaultConfig } from './config.js';
import { composeUp, composeDown, composePs, composeLogs } from './docker.js';
import {
  initMasterWallet,
  registerNightForDust,
  closeWallet,
  type WalletContext,
} from './wallet.js';

export class NetworkManager {
  private status: NetworkStatus = 'stopped';
  private masterWallet: WalletContext | null = null;
  private logger: Logger | null = null;
  public readonly config: NetworkConfig;

  constructor(config?: NetworkConfig) {
    this.config = config ?? defaultConfig;
  }

  setLogger(l: Logger): void {
    this.logger = l;
  }

  getStatus(): NetworkStatus {
    return this.status;
  }

  getMasterWallet(): WalletContext | null {
    return this.masterWallet;
  }

  async detectRunningNetwork(): Promise<void> {
    try {
      const services = await composePs();
      const allRunning =
        services.length >= 3 &&
        services.every((s) => s.status === 'running');

      if (allRunning) {
        this.logger?.info('Detected running network containers');
        this.status = 'running';
      }
    } catch {
      // Docker not available or compose not set up — stay stopped
    }
  }

  async ensureWallet(): Promise<WalletContext> {
    if (this.status !== 'running') {
      throw new DevnetError(
        'Network is not running. Call start-network first.',
        'NETWORK_NOT_RUNNING',
      );
    }

    if (!this.masterWallet) {
      this.logger?.info('Auto-initializing master wallet...');
      this.masterWallet = await initMasterWallet(this.config);
      await registerNightForDust(this.masterWallet);
    }

    return this.masterWallet;
  }

  async start(opts: { pull: boolean }): Promise<'started' | 'already-running'> {
    if (this.status === 'running') {
      return 'already-running';
    }

    this.status = 'starting';
    try {
      await composeUp({ pull: opts.pull });
      this.masterWallet = await initMasterWallet(this.config);
      await registerNightForDust(this.masterWallet);
      this.status = 'running';
      this.logger?.info('Network started and master wallet initialized');
      return 'started';
    } catch (err) {
      this.status = 'stopped';
      throw err;
    }
  }

  async stop(opts: { removeVolumes: boolean }): Promise<void> {
    this.status = 'stopping';
    try {
      if (this.masterWallet) {
        await closeWallet(this.masterWallet);
        this.masterWallet = null;
      }
      await composeDown({ removeVolumes: opts.removeVolumes });
    } finally {
      this.status = 'stopped';
    }
  }

  async restart(opts: { pull: boolean; removeVolumes: boolean }): Promise<void> {
    await this.stop({ removeVolumes: opts.removeVolumes });
    await this.start({ pull: opts.pull });
  }

  async getServices(): Promise<ServiceStatus[]> {
    return composePs();
  }

  async getLogs(opts: { service?: 'node' | 'indexer' | 'proof-server'; lines?: number }): Promise<string> {
    return composeLogs(opts);
  }

  async shutdown(): Promise<void> {
    if (this.masterWallet) {
      await closeWallet(this.masterWallet);
      this.masterWallet = null;
    }
  }
}
