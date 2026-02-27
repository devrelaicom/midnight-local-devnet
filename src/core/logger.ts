// src/core/logger.ts
import pino from 'pino';

export function createLogger(level: string = 'info', destination: NodeJS.WritableStream = process.stdout): pino.Logger {
  return pino({
    level,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        destination: destination === process.stderr ? 2 : 1,
      },
    },
  });
}
