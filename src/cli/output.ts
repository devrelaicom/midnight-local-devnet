export interface OutputOptions {
  json?: boolean;
}

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

export function output(data: unknown, opts: OutputOptions): void {
  if (opts.json) {
    process.stdout.write(JSON.stringify(data, bigintReplacer, 2) + '\n');
  } else {
    console.log(data);
  }
}

export function outputError(error: unknown, opts: OutputOptions): void {
  const message = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
  if (opts.json) {
    process.stdout.write(JSON.stringify({ error: message }, null, 2) + '\n');
  } else {
    console.error('Error:', message);
  }
}
