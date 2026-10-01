import { camelCase, constantCase, dotCase, pascalCase } from 'change-case-all';
import { Node } from 'ts-morph';
import { StrategyContext } from './context';

/** One event of one service, with every name the emitters generate for it. */
export type EventModel = {
  emitterName: string;
  emitterManyName: string;
  handlerName: string;
  externalHandlerName: string;
  externalInterfaceName: string;
  constantName: string;
  type: string;
  eventId: string;
};

/**
 * One service of the strategy, parsed. Not to be confused with the runtime
 * `<Service>EventBus` classes this model is used to generate.
 */
export type ServiceModel = {
  id: string;
  hostName: string;
  transportName: string;
  patternName: string;
  controllerName: string;
  eventBusName: string;
  methods: EventModel[];
};

export class StrategyParser {
  constructor(protected readonly context: StrategyContext) {}

  protected getServiceTransportName(serviceId: string): string {
    return pascalCase(`${serviceId}.transport`);
  }

  protected getServicePatternName(serviceId: string): string {
    return pascalCase(`${serviceId}.event.pattern`);
  }

  protected getServiceControllerName(serviceId: string): string {
    return pascalCase(`${serviceId}.event.controller`);
  }

  protected getServiceEventBusName(serviceId: string): string {
    return pascalCase(`${serviceId}.event.bus`);
  }

  protected getMethodHandlerName(eventName: string): string {
    return camelCase(`on.${eventName}`);
  }

  protected getMethodExternalHandlerName(serviceId: string, eventName: string): string {
    return camelCase(`on.${serviceId}.${eventName}`);
  }

  protected getMethodExternalInterfaceName(serviceId: string, eventName: string): string {
    return pascalCase(`${serviceId}.${eventName}.event.handler`);
  }

  protected getMethodEmitterName(eventName: string): string {
    return camelCase(`emit.${eventName}`);
  }

  protected getMethodEmitterManyName(eventName: string): string {
    return camelCase(`emit.many.${eventName}`);
  }

  protected getMethodConstantName(eventName: string): string {
    return constantCase(eventName);
  }

  getServices() {
    const strategyFile = this.context.getStrategyFile();
    const strategy = strategyFile.getInterfaceOrThrow('EventBusStrategy');

    const services: ServiceModel[] = [];

    for (const host of strategy.getProperties()) {
      const hostName = host.getName();
      const hostType = host.getTypeNode();

      if (hostType && Node.isTypeLiteral(hostType)) {
        const hostProperties = hostType.getProperties();

        if (!hostProperties.length) {
          continue;
        }

        for (const service of hostProperties) {
          const serviceName = service.getName();
          const serviceType = service.getTypeNode();

          if (serviceType && Node.isTypeLiteral(serviceType)) {
            const serviceProperties = serviceType.getProperties();

            if (!serviceProperties.length) {
              continue;
            }

            const serviceId = dotCase(serviceName);
            const methods: EventModel[] = [];

            for (const event of serviceProperties) {
              const eventName = event.getName();
              const eventType = event.getType().getText(strategyFile);
              const eventId = dotCase(`${hostName}_${serviceName}_${eventName}`);

              methods.push({
                emitterName: this.getMethodEmitterName(eventName),
                emitterManyName: this.getMethodEmitterManyName(eventName),
                handlerName: this.getMethodHandlerName(eventName),
                externalHandlerName: this.getMethodExternalHandlerName(serviceId, eventName),
                externalInterfaceName: this.getMethodExternalInterfaceName(serviceId, eventName),
                constantName: this.getMethodConstantName(eventName),
                eventId,
                type: eventType,
              });
            }

            const serviceModel: ServiceModel = {
              id: serviceId,
              transportName: this.getServiceTransportName(serviceId),
              patternName: this.getServicePatternName(serviceId),
              controllerName: this.getServiceControllerName(serviceId),
              hostName,
              eventBusName: this.getServiceEventBusName(serviceId),
              methods,
            };

            services.push(serviceModel);
          }
        }
      }
    }

    return services;
  }
}
