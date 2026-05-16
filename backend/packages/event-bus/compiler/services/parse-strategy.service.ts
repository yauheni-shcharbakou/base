import { dotCase, pascalCase } from 'change-case-all';
import { Node } from 'ts-morph';
import { ContextService } from './context.service';

type EventBusMethod = {
  name: string;
  fullName: string;
  type: string;
  eventId: string;
};

export type ServiceEventBus = {
  id: string;
  name: string;
  hostName: string;
  pattern: string;
  eventBusName: string;
  methods: EventBusMethod[];
};

export class ParseStrategyService {
  constructor(protected readonly contextService: ContextService) {}

  protected getServicePattern(hostName: string, serviceName: string): string {
    return `${hostName}.${serviceName}`;
  }

  protected getServiceEventBusName(serviceId: string): string {
    return pascalCase(`${serviceId}.event.bus`);
  }

  protected getMethodFullName(eventName: string): string {
    return `on${pascalCase(eventName)}`;
  }

  getServices() {
    const strategyFile = this.contextService.getStrategyFile();
    const strategy = strategyFile.getInterfaceOrThrow('EventBusStrategy');

    const services: ServiceEventBus[] = [];

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

            const methods: EventBusMethod[] = [];

            for (const event of serviceProperties) {
              const eventName = event.getName();
              const eventType = event.getType().getText(strategyFile);
              const eventId = dotCase(`${hostName}_${serviceName}_${eventName}`);

              methods.push({
                fullName: this.getMethodFullName(eventName),
                name: eventName,
                eventId,
                type: eventType,
              });
            }

            const serviceId = dotCase(`${hostName}_${serviceName}`);

            const serviceEventBus: ServiceEventBus = {
              id: serviceId,
              name: serviceName,
              hostName,
              pattern: this.getServicePattern(hostName, serviceName),
              eventBusName: this.getServiceEventBusName(serviceId),
              methods,
            };

            services.push(serviceEventBus);
          }
        }
      }
    }

    return services;
  }
}
