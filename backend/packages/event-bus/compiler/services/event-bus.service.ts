import { ImportService } from '@packages/compiler-utils';
import { dotCase, pascalCase } from 'change-case-all';
import { log } from 'console';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import {
  InterfaceDeclarationStructure,
  MethodSignatureStructure,
  Node,
  OptionalKind,
  Project,
  SourceFile,
  StructureKind,
} from 'ts-morph';
import { ServiceEventBus } from './parse-strategy.service';
import { ContextService } from './context.service';

// type EventBusMethod = {
//   name: string;
//   type: string;
//   event: string;
// };

// type ServiceEventBus = {
//   id: string;
//   name: string;
//   eventBusName: string;
//   methods: EventBusMethod[];
// };

// export type HostEventBus = {
//   name: string;
//   services: ServiceEventBus[];
// };

export class EventBusService {
  constructor(
    protected readonly project: Project,
    private readonly contextService: ContextService,
    // private readonly strategyDirPath: string,
    protected readonly eventBusOutputPath: string,
  ) {}

  private declareImports(outputFile: SourceFile) {
    const importService = new ImportService(outputFile);
    importService.addOrUpdate('rxjs', [{ name: 'Observable', isTypeOnly: true }]);
    outputFile.addImportDeclarations(this.contextService.getStrategyImportStructures());
    return outputFile;
  }

  // private async generateOutputContent(outputFile: SourceFile, services: ServiceEventBus[]) {
  //   outputFile.addInterfaces(
  //     services.map((service): OptionalKind<InterfaceDeclarationStructure> => {
  //       return {
  //         name: service.eventBusName,
  //         isExported: true,
  //         methods: service.methods.map((method): OptionalKind<MethodSignatureStructure> => {
  //           return {
  //             name: method.fullName,
  //             parameters: [{ name: 'event', type: method.type }],
  //             returnType: 'Observable<any>',
  //           };
  //         }),
  //       };
  //     }),
  //   );

  //   outputFile.organizeImports();
  //   outputFile.fixMissingImports();
  //   await outputFile.save();
  // }

  async compile(services: ServiceEventBus[]) {
    await writeFile(this.eventBusOutputPath, '/* eslint-disable */\n', { encoding: 'utf-8' });
    const outputFile = this.project.addSourceFileAtPath(this.eventBusOutputPath);

    outputFile.replaceWithText('/* eslint-disable */\n');

    this.declareImports(outputFile);

    const interfaces: OptionalKind<InterfaceDeclarationStructure>[] = [];
    const hostNames = new Set<string>();
    const serviceNames = new Set<string>();

    for (const service of services) {
      interfaces.push({
        name: service.eventBusName,
        isExported: true,
        methods: service.methods.map((method): OptionalKind<MethodSignatureStructure> => {
          return {
            name: method.fullName,
            parameters: [{ name: 'event', type: method.type }],
            returnType: 'Observable<any>',
          };
        }),
      });

      hostNames.add(`'${service.hostName}'`);
      serviceNames.add(`'${service.hostName}.${service.name}'`);
    }

    outputFile.addInterfaces(interfaces);

    outputFile.addTypeAliases([
      {
        isExported: true,
        name: 'EventBusHost',
        type: Array.from(hostNames).join(' | '),
      },
      {
        isExported: true,
        name: 'EventBusService',
        type: Array.from(serviceNames).join(' | '),
      },
    ]);

    outputFile.organizeImports();
    outputFile.fixMissingImports();
    await outputFile.save();

    // const strategyFilePath = join(this.strategyDirPath, 'strategy.ts');
    // const strategyFile = this.project.addSourceFileAtPath(strategyFilePath);
    // const outputFile = this.project.getSourceFileOrThrow(this.eventBusOutputPath);

    // this.project.addSourceFilesAtPaths(`${this.strategyDirPath}/**/*.ts`);

    // const strategy = strategyFile.getInterfaceOrThrow('EventBusStrategy');

    // const hostDataArray: HostEventBus[] = [];
    // const services: ServiceEventBus[] = [];

    // for (const host of strategy.getProperties()) {
    //   const hostName = host.getName();
    //   const hostType = host.getTypeNode();

    //   if (hostType && Node.isTypeLiteral(hostType)) {
    //     const hostProperties = hostType.getProperties();

    //     if (!hostProperties.length) {
    //       continue;
    //     }

    //     const hostData: HostEventBus = {
    //       name: hostName,
    //       services: [],
    //     };

    //     for (const service of hostProperties) {
    //       const serviceName = service.getName();
    //       const serviceType = service.getTypeNode();

    //       if (serviceType && Node.isTypeLiteral(serviceType)) {
    //         const serviceProperties = serviceType.getProperties();

    //         if (!serviceProperties.length) {
    //           continue;
    //         }

    //         const interfaceMap = new Map<string, { event: string; type: string }>();
    //         const methods: EventBusMethod[] = [];

    //         for (const event of serviceProperties) {
    //           const eventName = event.getName();
    //           const eventType = event.getType().getText(outputFile);

    //           const fullEventName = dotCase(`${hostName}_${serviceName}_${eventName}`);

    //           interfaceMap.set(eventName, {
    //             event: fullEventName,
    //             type: eventType,
    //           });

    //           methods.push({
    //             name: eventName,
    //             event: fullEventName,
    //             type: eventType,
    //           });
    //         }

    //         const serviceId = dotCase(host.getName() + '.' + service.getName());

    //         const serviceEventBus: ServiceEventBus = {
    //           id: serviceId,
    //           name: serviceName,
    //           eventBusName: pascalCase(`${serviceId}.event.bus`),
    //           methods,
    //         };

    //         hostData.services.push(serviceEventBus);
    //         services.push(serviceEventBus);

    //         // outputFile.addStatements(
    //         //   templateByName.get('controller')({
    //         //     data: {
    //         //       service: {
    //         //         id: serviceName,
    //         //         nameSpace: dotCase(`${hostName}_${serviceName}`),
    //         //       },
    //         //       methods: Array.from(interfaceMap.entries()).map(([name, { event, type }]) => {
    //         //         return { name, event, type };
    //         //       }),
    //         //     },
    //         //     pascalCase,
    //         //     constantCase,
    //         //     kebabCase,
    //         //   }),
    //         // );
    //       }
    //     }

    //     hostDataArray.push(hostData);
    //   }
    // }

    // log(services);

    // await this.generateOutputContent(outputFile, services);
  }
}
