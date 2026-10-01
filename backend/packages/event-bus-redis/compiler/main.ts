import { RedisAdapter } from '@compiler/redis.adapter';
import { parseStrategy } from '@backend/event-bus/compiler';
import { join } from 'path';

/**
 * Emits this package's `src/generated/index.ts` — the Redis transports, subscriber/handler
 * interfaces, `RedisClientFactory` and `REDIS_HOST_EVENTS`. Runs as this package's own turbo
 * `compile` task, so the output it writes is the output that task declares.
 */
const compile = async () => {
  try {
    const { context, services } = parseStrategy();

    const adapter = RedisAdapter.createFactory({
      name: 'redis',
      outputPath: join(__dirname, '..', 'src', 'generated', 'index.ts'),
      templatePath: join(__dirname, 'templates'),
    })(context, services);

    await adapter.run();
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message, error.stack);
    } else {
      console.error('Redis event-bus compiler error');
    }

    throw error;
  }
};

compile()
  .then()
  .catch(() => process.exit(1));
