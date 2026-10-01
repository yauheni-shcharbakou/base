import { EVENT_BUS_OUTPUT_PATH } from '@compiler/constants';
import { PortsEmitter } from '@compiler/emitters/ports.emitter';
import { parseStrategy } from '@compiler/strategy';

/**
 * Emits this package's own half of the codegen: the abstract `<Service>EventBus` classes and
 * the `EventBusHost` enum. The transports are emitted by the adapter packages, each in its
 * own turbo task against its own `src/generated/`.
 */
const compile = async () => {
  try {
    const { project, context, services } = parseStrategy();

    const portsEmitter = new PortsEmitter(project, context, EVENT_BUS_OUTPUT_PATH);
    await portsEmitter.compile(services);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message, error.stack);
    } else {
      console.error('EventBus compiler error');
    }

    throw error;
  }
};

compile()
  .then()
  .catch(() => process.exit(1));
