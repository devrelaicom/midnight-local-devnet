export interface NetworkConfig {
  readonly indexer: string;
  readonly indexerWS: string;
  readonly node: string;
  readonly proofServer: string;
  readonly networkId: string;
}

export type NetworkStatus = 'stopped' | 'starting' | 'running' | 'stopping';

export type ServiceName = 'node' | 'indexer' | 'proof-server';

export interface ServiceStatus {
  name: ServiceName;
  containerName: string;
  status: 'running' | 'stopped' | 'unhealthy' | 'unknown';
  port: number;
  url: string;
}

export interface NetworkState {
  status: NetworkStatus;
  services: ServiceStatus[];
}

export interface WalletBalances {
  unshielded: bigint;
  shielded: bigint;
  dust: bigint;
  total: bigint;
}

export interface FundedAccount {
  name: string;
  address: string;
  amount: bigint;
  txHash: string;
  hasDust: boolean;
}

export interface GeneratedAccount {
  name: string;
  mnemonic?: string;
  privateKey?: string;
  address: string;
}

export interface AccountsFileFormat {
  accounts: Array<{
    name: string;
    mnemonic?: string;
    privateKey?: string;
  }>;
}

export class DevnetError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly suggestion?: string,
  ) {
    super(message);
    this.name = 'DevnetError';
  }
}
