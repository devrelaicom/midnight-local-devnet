import { useState, useEffect } from 'react';
import type { NetworkManager } from '../../../core/network-manager.js';
import type { WalletBalances } from '../../../core/types.js';
import { getWalletBalances } from '../../../core/wallet.js';

export interface WalletState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  balances: WalletBalances | null;
  address: string | null;
}

export function useWalletState(manager: NetworkManager): WalletState {
  const [state, setState] = useState<WalletState>({
    connected: false,
    connecting: false,
    error: null,
    balances: null,
    address: null,
  });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const connect = async () => {
      if (manager.getStatus() !== 'running') {
        setState({ connected: false, connecting: false, error: 'Network not running', balances: null, address: null });
        return;
      }

      setState((prev) => ({ ...prev, connecting: true, error: null }));

      try {
        const wallet = await manager.ensureWallet();
        if (cancelled) return;

        const balances = await getWalletBalances(wallet);
        if (cancelled) return;

        setState({ connected: true, connecting: false, error: null, balances, address: 'master' });

        timer = setInterval(async () => {
          if (cancelled) return;
          try {
            const b = await getWalletBalances(wallet);
            if (!cancelled) {
              setState((prev) => ({ ...prev, balances: b }));
            }
          } catch {
            // Ignore polling errors
          }
        }, 10000);
      } catch (err) {
        if (!cancelled) {
          setState({
            connected: false,
            connecting: false,
            error: err instanceof Error ? err.message : 'Wallet connection failed',
            balances: null,
            address: null,
          });
        }
      }
    };

    void connect();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [manager, manager.getStatus()]);

  return state;
}
