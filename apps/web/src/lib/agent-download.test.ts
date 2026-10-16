import { describe, expect, it } from 'vitest';
import {
  LOCAL_AGENT_DOWNLOAD_PATH,
  RELEASE_AGENT_DOWNLOAD_URL,
  resolveAgentDownloadUrl,
} from '@/lib/agent-download';

describe('resolveAgentDownloadUrl', () => {
  it('prefers an explicitly configured URL', () => {
    expect(resolveAgentDownloadUrl('https://example.invalid/agent.exe', 'example.com')).toBe(
      'https://example.invalid/agent.exe',
    );
  });

  it('uses the locally built executable for local development', () => {
    expect(resolveAgentDownloadUrl(undefined, 'localhost')).toBe(LOCAL_AGENT_DOWNLOAD_PATH);
  });

  it('uses the published release asset for deployed builds', () => {
    expect(resolveAgentDownloadUrl(undefined, 'app.example.com')).toBe(RELEASE_AGENT_DOWNLOAD_URL);
    expect(resolveAgentDownloadUrl(undefined, undefined)).toBe(RELEASE_AGENT_DOWNLOAD_URL);
  });
});
