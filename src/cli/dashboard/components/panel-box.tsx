import React from 'react';
import { Box, Text } from 'ink';

interface PanelBoxProps {
  title: string;
  focused?: boolean;
  width?: number | string;
  height?: number;
  children: React.ReactNode;
}

export function PanelBox({ title, focused, width, height, children }: PanelBoxProps): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      borderStyle={focused ? 'bold' : 'single'}
      borderColor={focused ? 'cyan' : 'gray'}
      width={width}
      height={height}
      paddingX={1}
    >
      <Text bold color={focused ? 'cyan' : 'white'}>
        {title}
      </Text>
      {children}
    </Box>
  );
}
