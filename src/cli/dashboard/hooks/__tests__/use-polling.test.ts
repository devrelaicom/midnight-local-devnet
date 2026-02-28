import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// usePolling is a React hook — test the polling logic function directly
import { createPoller } from '../use-polling.js';

describe('createPoller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls fetcher immediately', async () => {
    const fetcher = vi.fn().mockResolvedValue('data');
    const onData = vi.fn();
    const onError = vi.fn();
    const stop = createPoller(fetcher, 5000, onData, onError);

    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(onData).toHaveBeenCalledWith('data');

    stop();
  });

  it('calls fetcher at interval', async () => {
    const fetcher = vi.fn().mockResolvedValue('data');
    const onData = vi.fn();
    const onError = vi.fn();
    const stop = createPoller(fetcher, 1000, onData, onError);

    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetcher).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetcher).toHaveBeenCalledTimes(3);

    stop();
  });

  it('calls onError when fetcher throws', async () => {
    const error = new Error('fail');
    const fetcher = vi.fn().mockRejectedValue(error);
    const onData = vi.fn();
    const onError = vi.fn();
    const stop = createPoller(fetcher, 1000, onData, onError);

    await vi.advanceTimersByTimeAsync(0);
    expect(onError).toHaveBeenCalledWith(error);
    expect(onData).not.toHaveBeenCalled();

    stop();
  });

  it('stops polling when stop is called', async () => {
    const fetcher = vi.fn().mockResolvedValue('data');
    const onData = vi.fn();
    const onError = vi.fn();
    const stop = createPoller(fetcher, 1000, onData, onError);

    await vi.advanceTimersByTimeAsync(0);
    stop();

    await vi.advanceTimersByTimeAsync(5000);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
