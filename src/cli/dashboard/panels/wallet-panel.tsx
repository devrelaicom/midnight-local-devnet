import React from 'react';
import { Box, Text } from 'ink';
import { PanelBox } from '../components/panel-box.js';
import type { WalletState } from '../hooks/use-wallet-state.js';

interface WalletPanelProps {
  wallet: WalletState;
  focused?: boolean;
  compact?: boolean;
}

function formatBalance(value: bigint): string {
  const whole = value / 10n ** 6n;
  return whole.toLocaleString();
}

export function WalletPanel({ wallet, focused, compact }: WalletPanelProps): React.ReactElement {
  if (wallet.connecting) {
    return (
      <PanelBox title="Wallet" focused={focused}>
        <Text color="yellow">Connecting...</Text>
      </PanelBox>
    );
  }

  if (wallet.error) {
    return (
      <PanelBox title="Wallet" focused={focused}>
        <Text color="red">Unavailable</Text>
        <Text color="gray">{wallet.error}</Text>
      </PanelBox>
    );
  }

  if (!wallet.balances) {
    return (
      <PanelBox title="Wallet" focused={focused}>
        <Text color="gray">No data</Text>
      </PanelBox>
    );
  }

  const b = wallet.balances;

  if (compact) {
    return (
      <Box flexDirection="column">
        <Text bold color="cyan">{`Wallet (${wallet.address ?? 'master'})`}</Text>
        <Text>NIGHT {formatBalance(b.total)}</Text>
        <Text>DUST  {formatBalance(b.dust)}</Text>
      </Box>
    );
  }

  return (
    <PanelBox title="Wallet" focused={focused}>
      <Text color="cyan" bold>{`> ${wallet.address ?? 'master'}`}</Text>
      <Text>  NIGHT  <Text color="green">{formatBalance(b.unshielded)}</Text> (unshielded)</Text>
      <Text>  NIGHT  <Text color="green">{formatBalance(b.shielded)}</Text> (shielded)</Text>
      <Text>  DUST   <Text color="yellow">{formatBalance(b.dust)}</Text></Text>
      <Text>  Total  <Text bold>{formatBalance(b.total)}</Text></Text>
    </PanelBox>
  );
}
