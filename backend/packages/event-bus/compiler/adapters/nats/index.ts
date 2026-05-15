import { NatsAdapter } from '@compiler/adapters/nats/nats.adapter';
import { BACKEND_PACKAGES_DIR_ROOT } from '@packages/compiler-utils';
import { join } from 'path';

export const Nats = NatsAdapter.createFactory({
  name: 'nats',
  outputPath: join(BACKEND_PACKAGES_DIR_ROOT, 'nats', 'src', 'generated', 'index.ts'),
  templatePath: join(__dirname, 'templates'),
});
