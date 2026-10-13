import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../server';

describe('Agent installer script (GET /api/agent/install.ps1)', () => {
  let app: FastifyInstance;
  let script: string;

  before(async () => {
    app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/agent/install.ps1' });
    assert.equal(res.statusCode, 200);
    script = res.body;
  });

  after(async () => {
    await app.close();
  });

  it('serves the bootstrap as plain text so `iwr | iex` works', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/agent/install.ps1' });
    assert.match(String(res.headers['content-type']), /text\/plain/);
  });

  it('reads the snippet variables and exports the agent variables', () => {
    // The /api/token snippet sets RICOZ_* ; the agent itself reads ENROLLMENT_TOKEN / API_URL.
    assert.match(script, /\$env:RICOZ_ENROLL_TOKEN/);
    assert.match(script, /\$env:RICOZ_API_URL/);
    assert.match(script, /SetEnvironmentVariable\('ENROLLMENT_TOKEN'/);
    assert.match(script, /SetEnvironmentVariable\('API_URL'/);
  });

  it('downloads, extracts and starts the agent binary', () => {
    assert.match(script, /Invoke-WebRequest/);
    assert.match(script, /Expand-Archive/);
    assert.match(script, /RicozEndpointAgent\.exe/);
    assert.match(script, /Start-Process/);
  });

  it('fails loudly when no enrollment token is supplied', () => {
    assert.match(script, /throw 'RICOZ_ENROLL_TOKEN is not set/);
  });

  it('never leaks database or signing secrets into the public script', () => {
    assert.ok(!script.includes('DATABASE_URL'), 'DATABASE_URL must not appear');
    assert.ok(!script.includes('JWT_SECRET'), 'JWT_SECRET must not appear');
    assert.ok(!script.includes('AGENT_ENROLLMENT_SECRET'), 'AGENT_ENROLLMENT_SECRET must not appear');
  });
});
