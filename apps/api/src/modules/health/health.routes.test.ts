import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../server';

/**
 * Contract: GET /api/health returns a BARE object (no {success,data} envelope)
 * so orchestrators and the web dashboard can consume it directly.
 * The dashboard client (`getSystemHealth`) parses this exact shape —
 * do not wrap it without updating the client.
 */
describe('Health probe contract (GET /api/health)', () => {
  let app: FastifyInstance;

  before(async () => {
    app = await buildApp();
  });

  after(async () => {
    await app.close();
  });

  it('returns a bare payload with no envelope', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    assert.equal(res.statusCode, 200);
    const body = res.json() as Record<string, unknown>;
    assert.ok(!('success' in body), 'health payload must not be wrapped in an envelope');
    assert.ok(!('data' in body), 'health payload must not be wrapped in an envelope');
    assert.equal(body.status, 'ok');
    assert.equal(body.database, 'up');
    assert.equal(typeof body.timestamp, 'string');
    assert.equal(typeof body.uptime, 'number');
    assert.equal(typeof body.version, 'string');
  });
});
