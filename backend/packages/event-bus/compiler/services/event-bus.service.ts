import { ImportService } from '@packages/compiler-utils';
import { constantCase } from 'change-case-all';
import { writeFile } from 'fs/promises';
import {
  InterfaceDeclarationStructure,
  MethodSignatureStructure,
  OptionalKind,
  Project,
  SourceFile,
} from 'ts-morph';
import { ServiceEventBus } from './parse-strategy.service';
import { ContextService } from './context.service';

export class EventBusService {
  constructor(
    protected readonly project: Project,
    private readonly contextService: ContextService,
    protected readonly eventBusOutputPath: string,
  ) {}

  private declareImports(outputFile: SourceFile) {
    const importService = new ImportService(outputFile);
    importService.addOrUpdate('rxjs', [{ name: 'Observable', isTypeOnly: true }]);
    outputFile.addImportDeclarations(this.contextService.getStrategyImportStructures());
    return outputFile;
  }

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

      hostNames.add(service.hostName);
      serviceNames.add(`'${service.pattern}'`);
    }

    outputFile.addInterfaces(interfaces);

    outputFile.addEnum({
      isExported: true,
      name: 'EventBusHost',
      members: Array.from(hostNames).map((hostName) => ({
        name: constantCase(hostName),
        value: hostName,
      })),
    });

    outputFile.addTypeAlias({
      isExported: true,
      name: 'EventBusService',
      type: Array.from(serviceNames).join(' | '),
    });

    outputFile.organizeImports();
    outputFile.fixMissingImports();
    await outputFile.save();
  }
}
