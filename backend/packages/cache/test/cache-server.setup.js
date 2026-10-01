const net = require('node:net');

const REDIS_URL = process.env.CACHE_REDIS_URL ?? process.env.REDIS_URL ?? 'redis://localhost:6379';
const PROBE_TIMEOUT_MS = 2000;

/**
 * Asks the server for a `PING` over a raw socket rather than through ioredis: a failed ioredis
 * connection leaves reconnect machinery behind that keeps jest from exiting on the skip path,
 * which is exactly the path that has to stay quiet. A socket destroys cleanly.
 *
 * Any RESP reply counts as an answer — a password-protected server replies `-NOAUTH`, and that
 * still means the suite has a Redis to talk to.
 */
const isServerUp = () =>
  new Promise((resolve) => {
    const { hostname, port } = new URL(REDIS_URL);
    const socket = net.createConnection({ host: hostname, port: Number(port) || 6379 });

    const finish = (result) => {
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
 * Runs once, before jest forks its workers — the only place these two jobs can be done.
 *
 * `cache.config.ts` validates env at module load, so every override has to be in place before
 * the spec is imported; a `beforeAll` would already be too late. And the probe result has to
 * land in `process.env` for the spec to read it synchronously at module scope and pick
 * `describe` vs `describe.skip` — a runtime skip is what keeps a serverless run honest instead
 * of falsely green.
 */
module.exports = async () => {
  // Its own prefix, so the suite cannot touch what a developer is running locally and its own
  // cleanup is a scan over a known prefix.
  process.env.CACHE_KEY_PREFIX = 'cache-e2e';
  // Short enough that an expiry can be waited out inside a test.
  process.env.CACHE_TTL = '2';
  process.env.CACHE_DRIVER = 'redis';

  if (await isServerUp()) {
    process.env.CACHE_E2E_SERVER = '1';
    return;
  }

  // CI starts every server, so there a skip can only mean a broken environment.
  if (process.env.E2E_REQUIRE_SERVERS === '1') {
    throw new Error(`No Redis at ${REDIS_URL}, and E2E_REQUIRE_SERVERS forbids skipping.`);
  }

  process.env.CACHE_E2E_SERVER = '0';

  console.warn(
    `\nNo Redis at ${REDIS_URL} — skipping the @backend/cache e2e suite.\n` +
      'Start one with: docker run --rm -p 6379:6379 redis:latest\n',
  );
};
