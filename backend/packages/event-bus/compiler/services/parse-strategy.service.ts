import { ImportService } from '@packages/compiler-utils';
import { dotCase, pascalCase } from 'change-case-all';
import { writeFile } from 'fs/promises';
import { Node, Project } from 'ts-morph';
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
  eventBusName: string;
  methods: EventBusMethod[];
};

export class ParseStrategyService {
  constructor(
    // protected readonly project: Project,
    protected readonly contextService: ContextService,
    // protected readonly strategyDirPath: string,
    // protected readonly eventBusOutputPath: string,
  ) {}

  // private async declareImports() {
  //   await writeFile(this.eventBusOutputPath, '/* eslint-disable */\n', { encoding: 'utf-8' });
  //   const outputFile = this.project.addSourceFileAtPath(this.eventBusOutputPath);

  //   const importService = new ImportService(outputFile);
  //   importService.addOrUpdate('rxjs', [{ name: 'Observable', isTypeOnly: true }]);

  //   outputFile.addImportDeclarations(this.contextService.getStrategyImportStructures());
  //   return outputFile;
  // }

  getServices() {
    // const outputFile = await this.declareImports();
    // this.project.addSourceFilesAtPaths(`${this.strategyDirPath}/**/*.ts`);

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

            const interfaceMap = new Map<string, { event: string; type: string }>();
            const methods: EventBusMethod[] = [];

            for (const event of serviceProperties) {
              const eventName = event.getName();
              const eventType = event.getType().getText(strategyFile);

              const fullEventName = dotCase(`${hostName}_${serviceName}_${eventName}`);

              interfaceMap.set(eventName, {
                event: fullEventName,
                type: eventType,
              });

              methods.push({
                fullName: `on${pascalCase(eventName)}`,
                name: eventName,
                eventId: fullEventName,
                type: eventType,
              });
            }

            const serviceId = dotCase(host.getName() + '.' + service.getName());

            const serviceEventBus: ServiceEventBus = {
              id: serviceId,
              name: serviceName,
              hostName,
              eventBusName: pascalCase(`${serviceId}.event.bus`),
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
