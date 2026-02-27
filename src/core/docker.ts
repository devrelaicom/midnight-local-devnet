// src/core/docker.ts
import { execFile as execFileCb } from 'node:child_process';
import { DOCKER_COMPOSE_DIR, DOCKER_COMPOSE_FILE } from './config.js';
import { DevnetError, type ServiceStatus, type ServiceName } from './types.js';

function execFile(
  cmd: string,
  args: string[],
  opts: { timeout?: number } = {},
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFileCb(cmd, args, opts, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout: stdout as string, stderr: stderr as string });
      }
    });
  });
}

const COMPOSE_ARGS = [
  'compose',
  '-f',
  `${DOCKER_COMPOSE_DIR}/${DOCKER_COMPOSE_FILE}`,
];

const CONTAINER_TO_SERVICE: Record<string, { name: ServiceName; port: number; url: string }> = {
  'midnight-node': { name: 'node', port: 9944, url: 'http://127.0.0.1:9944' },
  'midnight-indexer': { name: 'indexer', port: 8088, url: 'http://127.0.0.1:8088/api/v3/graphql' },
  'midnight-proof-server': { name: 'proof-server', port: 6300, url: 'http://127.0.0.1:6300' },
};

export async function isDockerRunning(): Promise<boolean> {
  try {
    await execFile('docker', ['info'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function assertDocker(): Promise<void> {
  const running = await isDockerRunning();
  if (!running) {
    throw new DevnetError(
      'Docker is not running.',
      'DOCKER_NOT_RUNNING',
      'Please start Docker Desktop.',
    );
  }
}

export async function composeUp(opts: { pull: boolean }): Promise<void> {
  await assertDocker();
  if (opts.pull) {
    await execFile('docker', [...COMPOSE_ARGS, 'pull'], { timeout: 300_000 });
  }
  await execFile('docker', [...COMPOSE_ARGS, 'up', '-d', '--wait'], { timeout: 300_000 });
}

export async function composeDown(opts: { removeVolumes: boolean }): Promise<void> {
  const args = [...COMPOSE_ARGS, 'down'];
  if (opts.removeVolumes) {
    args.push('-v');
  }
  await execFile('docker', args, { timeout: 60_000 });
}

export async function composePs(): Promise<ServiceStatus[]> {
  let stdout: string;
  try {
    const result = await execFile(
      'docker',
      [...COMPOSE_ARGS, 'ps', '--format', 'json'],
      { timeout: 10_000 },
    );
    stdout = result.stdout;
  } catch {
    return [];
  }

  if (!stdout.trim()) return [];

  let containers: Array<{ Name: string; State: string; Status: string }>;
  try {
    containers = JSON.parse(stdout);
  } catch {
    // docker compose ps --format json may output one JSON object per line
    containers = stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }

  if (!Array.isArray(containers)) {
    containers = [containers];
  }

  return containers.map((c) => {
    const svc = CONTAINER_TO_SERVICE[c.Name];
    return {
      name: svc?.name ?? (c.Name as ServiceName),
      containerName: c.Name,
      status: c.State === 'running' ? ('running' as const) : ('stopped' as const),
      port: svc?.port ?? 0,
      url: svc?.url ?? '',
    };
  });
}

export async function composeLogs(opts: {
  service?: ServiceName;
  lines?: number;
}): Promise<string> {
  const args = [...COMPOSE_ARGS, 'logs', '--tail', String(opts.lines ?? 50)];
  if (opts.service) {
    args.push(opts.service);
  }
  const { stdout } = await execFile('docker', args, { timeout: 10_000 });
  return stdout;
}
