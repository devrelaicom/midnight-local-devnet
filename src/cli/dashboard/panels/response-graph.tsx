import React from 'react';
import { Box, Text } from 'ink';
import { PanelBox } from '../components/panel-box.js';
import { Sparkline } from '../components/sparkline.js';

interface ResponseGraphProps {
  nodeHistory: number[];
  indexerHistory: number[];
  proofServerHistory: number[];
  focused?: boolean;
  width?: number;
}

export function ResponseGraph({
  nodeHistory,
  indexerHistory,
  proofServerHistory,
  focused,
  width,
}: ResponseGraphProps): React.ReactElement {
  const sparkWidth = width ? Math.max(5, width - 20) : 20;
  const lastNode = nodeHistory[nodeHistory.length - 1];
  const lastIndexer = indexerHistory[indexerHistory.length - 1];
  const lastProof = proofServerHistory[proofServerHistory.length - 1];

  return (
    <PanelBox title="Response Times" focused={focused}>
      <Box>
        <Text>node  </Text>
        <Sparkline data={nodeHistory} maxWidth={sparkWidth} color="green" />
        <Text> {lastNode != null ? `${lastNode}ms` : 'N/A'}</Text>
      </Box>
      <Box>
        <Text>idx   </Text>
        <Sparkline data={indexerHistory} maxWidth={sparkWidth} color="blue" />
        <Text> {lastIndexer != null ? `${lastIndexer}ms` : 'N/A'}</Text>
      </Box>
      <Box>
        <Text>proof </Text>
        <Sparkline data={proofServerHistory} maxWidth={sparkWidth} color="yellow" />
        <Text> {lastProof != null ? `${lastProof}ms` : 'N/A'}</Text>
      </Box>
    </PanelBox>
  );
}
