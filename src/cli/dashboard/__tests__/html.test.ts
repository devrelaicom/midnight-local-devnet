import { describe, it, expect } from 'vitest';
import { generateDashboardHtml } from '../html.js';

describe('generateDashboardHtml', () => {
  const html = generateDashboardHtml({ wsUrl: 'ws://localhost:31780/ws' });

  it('returns a complete HTML document', () => {
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });

  it('includes the Midnight color palette CSS variables', () => {
    expect(html).toContain('--mn-void');
    expect(html).toContain('--mn-surface');
    expect(html).toContain('--mn-accent');
    expect(html).toContain('#09090f');
    expect(html).toContain('#3b3bff');
  });

  it('includes Google Fonts (Inter + JetBrains Mono)', () => {
    expect(html).toContain('fonts.googleapis.com');
    expect(html).toContain('Inter');
    expect(html).toContain('JetBrains+Mono');
  });

  it('includes Preact and HTM imports from CDN', () => {
    expect(html).toContain('preact');
    expect(html).toContain('htm');
  });

  it('includes WebSocket connection logic with the provided URL', () => {
    expect(html).toContain('ws://localhost:31780/ws');
    expect(html).toContain('WebSocket');
  });

  it('includes all dashboard section components', () => {
    expect(html).toContain('NodeCard');
    expect(html).toContain('IndexerCard');
    expect(html).toContain('ProofServerCard');
    expect(html).toContain('WalletCard');
    expect(html).toContain('LogViewer');
  });

  it('includes Lucide icons from CDN', () => {
    expect(html).toContain('lucide');
  });
});
