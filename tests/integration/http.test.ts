import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkUrl } from '../../src/validation/http.js';
import { startTestServer, type TestServer } from './support/server.js';

let server: TestServer;

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
});

function check(path: string, timeoutMs = 5_000) {
  return checkUrl(`${server.baseUrl}${path}`, { timeoutMs });
}

describe('checkUrl', () => {
  it('accepts a 200 response', async () => {
    await expect(check('/ok')).resolves.toMatchObject({
      ok: true,
      status: 200,
      finalUrl: `${server.baseUrl}/ok`,
    });
  });

  it('follows redirects transparently', async () => {
    await expect(check('/redirect')).resolves.toMatchObject({
      ok: true,
      status: 200,
      finalUrl: `${server.baseUrl}/ok`,
    });
  });

  it('reports a 404 as an error', async () => {
    await expect(check('/missing')).resolves.toEqual({
      ok: false,
      failure: {
        code: 'HTTP_ERROR',
        severity: 'error',
        message: 'request failed with status 404',
        status: 404,
      },
    });
  });

  it('reports a 500 as an error', async () => {
    const outcome = await check('/error');

    expect(outcome.ok).toBe(false);
    expect(outcome).toMatchObject({ failure: { code: 'HTTP_ERROR', status: 500 } });
  });

  it.each([
    ['/blocked', 403],
    ['/rate-limited', 429],
  ])('treats %s as a warning because bots are often blocked', async (path, status) => {
    await expect(check(path)).resolves.toEqual({
      ok: false,
      failure: {
        code: 'HTTP_BLOCKED',
        severity: 'warning',
        message: `request blocked with status ${status}`,
        status,
      },
    });
  });

  it('reports a redirect loop', async () => {
    const outcome = await check('/loop');

    expect(outcome).toMatchObject({ ok: false, failure: { code: 'REDIRECT_LOOP' } });
  });

  it('warns instead of failing when a request times out', async () => {
    const outcome = await check('/slow', 50);

    expect(outcome).toMatchObject({
      ok: false,
      failure: { code: 'HTTP_TIMEOUT', severity: 'warning' },
    });
  });

  it('sends a descriptive user agent', async () => {
    await check('/ok');

    expect(server.userAgents.at(-1)).toMatch(/^mdlinks\/\d+\.\d+\.\d+/);
  });

  it('rejects a malformed URL without throwing', async () => {
    await expect(checkUrl('http://exa mple.com', { timeoutMs: 100 })).resolves.toMatchObject({
      ok: false,
      failure: { code: 'NETWORK_ERROR' },
    });
  });

  it('reports connection failures', async () => {
    const outcome = await checkUrl('http://127.0.0.1:1/', { timeoutMs: 1_000 });

    expect(outcome).toMatchObject({ ok: false, failure: { code: 'NETWORK_ERROR' } });
  });
});
