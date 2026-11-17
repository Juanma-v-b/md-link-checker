import type { AddressInfo } from 'node:net';
import { createServer } from 'node:http';
import type { Server } from 'node:http';

export interface TestServer {
  baseUrl: string;
  /** Number of requests received per path. */
  requests: Map<string, number>;
  /** User-Agent header of every request, in arrival order. */
  userAgents: string[];
  close: () => Promise<void>;
}

/**
 * Tiny HTTP server used by the integration tests. It keeps the suite offline
 * and deterministic: every status code, redirect, timeout and user agent we
 * care about is produced locally.
 */
export async function startTestServer(): Promise<TestServer> {
  const requests = new Map<string, number>();
  const userAgents: string[] = [];

  const server: Server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    requests.set(path, (requests.get(path) ?? 0) + 1);
    userAgents.push(request.headers['user-agent'] ?? '');

    switch (path) {
      case '/ok':
        response.writeHead(200, { 'content-type': 'text/html' });
        response.end('<h1>ok</h1>');
        return;

      case '/redirect':
        response.writeHead(302, { location: '/ok' });
        response.end();
        return;

      case '/loop':
        response.writeHead(302, { location: '/loop' });
        response.end();
        return;

      case '/missing':
        response.writeHead(404);
        response.end('not found');
        return;

      case '/blocked':
        response.writeHead(403);
        response.end('forbidden');
        return;

      case '/rate-limited':
        response.writeHead(429);
        response.end('slow down');
        return;

      case '/error':
        response.writeHead(500);
        response.end('boom');
        return;

      case '/slow': {
        const timer = setTimeout(() => {
          if (!response.destroyed) {
            response.writeHead(200);
            response.end('late');
          }
        }, 250);
        response.on('close', () => clearTimeout(timer));
        return;
      }

      default:
        response.writeHead(404);
        response.end('not found');
        return;
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    userAgents,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      }),
  };
}
