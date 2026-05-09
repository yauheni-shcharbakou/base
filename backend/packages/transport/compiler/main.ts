import { AdapterFactory } from '@compiler/adapters/base.adapter';
import { Nats } from '@compiler/adapters/nats';
import { PACKAGE_SRC_ROOT } from '@compiler/constants';
import { EventBusService } from '@compiler/services';
import { join } from 'path';
import { Project } from 'ts-morph';

const STRATEGY_DIR_PATH = join(PACKAGE_SRC_ROOT, 'event-bus', 'strategy');
const EVENT_BUS_OUTPUT_PATH = join(PACKAGE_SRC_ROOT, 'event-bus', 'generated', 'index.ts');
const EVENT_BUS_IMPORT_SPECIFIER = '@/event-bus';

const compile = async (adapterFactories: AdapterFactory[]) => {
  try {
    const project = new Project({
      compilerOptions: {
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      },
    });

    const eventBusService = new EventBusService(project, STRATEGY_DIR_PATH, EVENT_BUS_OUTPUT_PATH);

    const strategy = await eventBusService.compileStrategy();

    for (const adapterFactory of adapterFactories) {
      const adapter = adapterFactory(project, EVENT_BUS_IMPORT_SPECIFIER);
      await adapter.run();
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message, error.stack);
    } else {
      console.error('EventBus compiler error');
    }

    throw error;
  }
};

compile([Nats])
  .then()
  .catch(() => process.exit(1));
