import { describe, it, expect, vi, beforeEach } from 'vitest';

const LOCAL = 'http://localhost:3001/api';
const DEPLOYED = 'https://ricoz-api.onrender.com/api';

async function loadApi() {
  vi.resetModules();
  return import('./api');
}

describe('API base URL resolution', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('defaults to localhost outside the browser', async () => {
    const api = await loadApi();
    expect(api.API_BASE_URL).toBe(LOCAL);
    expect(api.API_BASE_URL_MISCONFIGURED).toBe(false);
  });

  it('honors NEXT_PUBLIC_API_URL when set', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.com/api/');
    const api = await loadApi();
    expect(api.API_BASE_URL).toBe('https://api.example.com/api');
  });

  it('defaults deployed hosts to the production API', async () => {
    vi.stubGlobal('window', { location: { hostname: 'app.example.com' } });
    const api = await loadApi();
    expect(api.API_BASE_URL).toBe(DEPLOYED);
    expect(api.API_BASE_URL_MISCONFIGURED).toBe(false);
  });

  it('flags a localhost override on a deployed host', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', LOCAL);
    vi.stubGlobal('window', { location: { hostname: 'app.example.com' } });
    const api = await loadApi();
    expect(api.API_BASE_URL_MISCONFIGURED).toBe(true);
  });

  it('keeps localhost builds working on localhost', async () => {
    vi.stubGlobal('window', { location: { hostname: 'localhost' } });
    const api = await loadApi();
    expect(api.API_BASE_URL).toBe(LOCAL);
    expect(api.API_BASE_URL_MISCONFIGURED).toBe(false);
  });
});
