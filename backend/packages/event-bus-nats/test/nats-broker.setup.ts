import { connect } from '@nats-io/transport-node';
import type { TestProject } from 'vitest/node';

const NATS_URL = process.env.NATS_URL ?? 'nats://localhost:4222';

/**
 * Runs once, before Vitest starts its workers. The probe result is provided to the specs, which
 * read it with `inject('natsBroker')` at module scope and pick `describe` vs `describe.skip` — a
 * runtime skip is what keeps a brokerless run honest instead of falsely green. The env overrides
 * are in `vitest.e2e.config.mts`.
 */
export default async function setup(project: TestProject) {
  try {
    const connection = await connect({ servers: [NATS_URL] });
    await connection.close();

    project.provide('natsBroker', true);
  } catch {
    // CI starts every server, so there a skip can only mean a broken environment.
    if (process.env.E2E_REQUIRE_SERVERS === '1') {
      throw new Error(`No NATS broker at ${NATS_URL}, and E2E_REQUIRE_SERVERS forbids skipping.`);
    }

    project.provide('natsBroker', false);

    console.warn(
      `\nNo NATS broker at ${NATS_URL} — skipping the @backend/event-bus-nats e2e suite.\n` +
        'Start one with: docker run --rm -p 4222:4222 nats:latest -js\n',
    );
  }
}
