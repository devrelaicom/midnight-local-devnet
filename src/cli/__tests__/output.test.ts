import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { output, outputError } from '../output.js';

type StdoutWriteMock = MockInstance<typeof process.stdout.write>;

describe('output()', () => {
  let stdoutWrite: StdoutWriteMock;

  beforeEach(() => {
    stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints JSON to stdout when json is true', () => {
    const data = { name: 'test', value: 42 };
    output(data, { json: true });
    const written = stdoutWrite.mock.calls[0][0] as string;
    expect(JSON.parse(written)).toEqual(data);
  });

  it('converts bigint values to strings in JSON mode', () => {
    const data = { balance: 1000000n };
    output(data, { json: true });
    const written = stdoutWrite.mock.calls[0][0] as string;
    expect(JSON.parse(written)).toEqual({ balance: '1000000' });
  });

  it('calls console.log in human mode (json false)', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    output('hello', { json: false });
    expect(spy).toHaveBeenCalledWith('hello');
  });

  it('calls console.log in human mode (json undefined)', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    output('hello', {});
    expect(spy).toHaveBeenCalledWith('hello');
  });
});

describe('outputError()', () => {
  let stdoutWrite: StdoutWriteMock;

  beforeEach(() => {
    stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    process.exitCode = undefined;
  });
  afterEach(() => {
    process.exitCode = undefined;
    vi.restoreAllMocks();
  });

  it('prints JSON error to stdout and sets exitCode when json is true', () => {
    outputError(new Error('boom'), { json: true });
    const written = stdoutWrite.mock.calls[0][0] as string;
    expect(JSON.parse(written)).toEqual({ error: 'boom' });
    expect(process.exitCode).toBe(1);
  });

  it('handles string errors in JSON mode', () => {
    outputError('something broke', { json: true });
    const written = stdoutWrite.mock.calls[0][0] as string;
    expect(JSON.parse(written)).toEqual({ error: 'something broke' });
  });

  it('prints to stderr in human mode', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    outputError(new Error('boom'), { json: false });
    expect(spy).toHaveBeenCalledWith('Error:', 'boom');
    expect(process.exitCode).toBe(1);
  });
});
