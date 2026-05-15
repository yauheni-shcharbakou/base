import { AdapterFactory } from '@compiler/adapters/base.adapter';
import { Nats } from '@compiler/adapters/nats';
import { ContextService, EventBusService, ParseStrategyService } from '@compiler/services';
import { Project } from 'ts-morph';
import { EVENT_BUS_OUTPUT_PATH, EVENT_BUS_IMPORT_SPECIFIER, PACKAGE_SRC_ROOT } from './constants';

const compile = async (adapterFactories: AdapterFactory[]) => {
  try {
    const project = new Project({
      compilerOptions: {
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      },
    });

    const contextService = new ContextService(
      project,
      PACKAGE_SRC_ROOT,
      EVENT_BUS_IMPORT_SPECIFIER,
    );

    const parseStrategyService = new ParseStrategyService(contextService);
    const services = parseStrategyService.getServices();

    const eventBusService = new EventBusService(project, contextService, EVENT_BUS_OUTPUT_PATH);
    await eventBusService.compile(services);

    for (const adapterFactory of adapterFactories) {
      const adapter = adapterFactory(contextService, services);
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
