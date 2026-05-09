import { NatsAdapter } from '@compiler/adapters/nats/nats.adapter';
import { PACKAGE_SRC_ROOT } from '@compiler/constants';
import { join } from 'path';

export const Nats = NatsAdapter.createFactory({
  name: 'nats',
  outputPath: join(PACKAGE_SRC_ROOT, 'nats', 'generated', 'index.ts'),
  templatePath: join(__dirname, 'templates'),
});
