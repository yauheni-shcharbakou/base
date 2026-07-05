import { constantCase } from 'change-case-all';
import { writeFile } from 'fs/promises';
import {
  ClassDeclarationStructure,
  MethodDeclarationStructure,
  OptionalKind,
  Project,
  SourceFile,
} from 'ts-morph';
import { ContextService } from './context.service';
import { ServiceEventBus } from './parse-strategy.service';

export class EventBusService {
  constructor(
    protected readonly project: Project,
    private readonly contextService: ContextService,
    protected readonly eventBusOutputPath: string,
  ) {}

  private declareImports(outputFile: SourceFile) {
    outputFile.addImportDeclarations(this.contextService.getStrategyImportStructures());
    return outputFile;
  }

  async compile(services: ServiceEventBus[]) {
    await writeFile(this.eventBusOutputPath, '/* eslint-disable */\n', { encoding: 'utf-8' });
    const outputFile = this.project.addSourceFileAtPath(this.eventBusOutputPath);

    outputFile.replaceWithText('/* eslint-disable */\n');

    this.declareImports(outputFile);

    const classes: OptionalKind<ClassDeclarationStructure>[] = [
      {
        name: 'EventBus',
        isExported: true,
        isAbstract: true,
      },
    ];

    const hostNames = new Set<string>();

    for (const service of services) {
      classes.push({
        name: service.eventBusName,
        isExported: true,
        isAbstract: true,
        methods: service.methods.reduce(
          (
            acc: OptionalKind<MethodDeclarationStructure>[],
            method,
          ): OptionalKind<MethodDeclarationStructure>[] => {
            acc.push(
              {
                name: method.emitterName,
                isAbstract: true,
                parameters: [{ name: 'event', type: method.type }],
                returnType: 'Promise<any>',
              },
              {
                name: method.emitterManyName,
                isAbstract: true,
                parameters: [{ name: 'events', type: `${method.type}[]` }],
                returnType: 'Promise<any[]>',
              },
            );

            return acc;
          },
          [],
        ),
        extends: 'EventBus',
      });

      hostNames.add(service.hostName);
    }

    outputFile.addClasses(classes);

    outputFile.addEnum({
      isExported: true,
      name: 'EventBusHost',
      members: Array.from(hostNames).map((hostName) => ({
        name: constantCase(hostName),
        value: hostName,
      })),
    });

    outputFile.organizeImports();
    outputFile.fixMissingImports();
    await outputFile.save();
  }
}
