import { createConnection } from 'node:net';
import type { TestProject } from 'vitest/node';

const REDIS_URL = process.env.CACHE_REDIS_URL ?? process.env.REDIS_URL ?? 'redis://localhost:6379';
const PROBE_TIMEOUT_MS = 2000;

/**
 * Asks the server for a `PING` over a raw socket rather than through ioredis: a failed ioredis
 * connection leaves reconnect machinery behind that keeps the run from exiting on the skip path,
 * which is exactly the path that has to stay quiet. A socket destroys cleanly.
 *
 * Any RESP reply counts as an answer — a password-protected server replies `-NOAUTH`, and that
 * still means the suite has a Redis to talk to.
 */
const isServerUp = () =>
  new Promise<boolean>((resolve) => {
    const { hostname, port } = new URL(REDIS_URL);
    const socket = createConnection({ host: hostname, port: Number(port) || 6379 });

    const finish = (result: boolean) => {
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(PROBE_TIMEOUT_MS);
    socket.on('connect', () => socket.write('PING\r\n'));
    socket.on('data', (chunk) => finish(/^[+-]/.test(chunk.toString())));
    socket.on('error', () => finish(false));
    socket.on('timeout', () => finish(false));
  });

/**
 * Runs once, before Vitest starts its workers. The probe result is provided to the specs, which
 * read it with `inject('cacheServer')` at module scope and pick `describe` vs `describe.skip` — a
 * runtime skip is what keeps a serverless run honest instead of falsely green. The env overrides
 * are in `vitest.e2e.config.mts`.
 */
export default async function setup(project: TestProject) {
  if (await isServerUp()) {
    project.provide('cacheServer', true);
    return;
  }

  // CI starts every server, so there a skip can only mean a broken environment.
  if (process.env.E2E_REQUIRE_SERVERS === '1') {
    throw new Error(`No Redis at ${REDIS_URL}, and E2E_REQUIRE_SERVERS forbids skipping.`);
  }

  project.provide('cacheServer', false);

  console.warn(
    `\nNo Redis at ${REDIS_URL} — skipping the @backend/cache e2e suite.\n` +
      'Start one with: docker run --rm -p 6379:6379 redis:latest\n',
  );
}
