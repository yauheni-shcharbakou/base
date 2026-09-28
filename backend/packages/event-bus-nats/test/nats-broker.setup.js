const { connect } = require('@nats-io/transport-node');

const NATS_URL = process.env.NATS_URL ?? 'nats://localhost:4222';

/**
 * Runs once, before jest forks its workers — which is the only place these two jobs can be done.
 *
 * `nats.config.ts` validates env at module load, so `NATS_MAX_DELIVER` has to be set before the
 * spec is imported; a `beforeAll` would already be too late. And the broker probe has to land in
 * `process.env` for the spec to read it synchronously at module scope and pick `describe` vs
 * `describe.skip` — a runtime skip is what keeps a brokerless run honest instead of falsely green.
 */
module.exports = async () => {
  // A short redelivery ladder instead of the production ten, and the production delivery policy
  // pinned explicitly so the suite does not depend on the developer's environment.
  process.env.NATS_MAX_DELIVER = '3';
  process.env.NATS_DELIVER_POLICY = 'all';

  try {
    const connection = await connect({ servers: [NATS_URL] });
    await connection.close();

    process.env.NATS_E2E_BROKER = '1';
  } catch {
    // CI starts every server, so there a skip can only mean a broken environment.
    if (process.env.E2E_REQUIRE_SERVERS === '1') {
      throw new Error(`No NATS broker at ${NATS_URL}, and E2E_REQUIRE_SERVERS forbids skipping.`);
    }

    process.env.NATS_E2E_BROKER = '0';

    console.warn(
      `\nNo NATS broker at ${NATS_URL} — skipping the @backend/event-bus-nats e2e suite.\n` +
        'Start one with: docker run --rm -p 4222:4222 nats:latest -js\n',
    );
  }
};
