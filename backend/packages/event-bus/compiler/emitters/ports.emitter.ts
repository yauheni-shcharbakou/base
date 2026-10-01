import { FormatService } from '@packages/compiler-utils';
import { constantCase } from 'change-case-all';
import { writeFile } from 'fs/promises';
import {
  ClassDeclarationStructure,
  MethodDeclarationStructure,
  OptionalKind,
  Project,
  SourceFile,
} from 'ts-morph';
import { ServiceModel, StrategyContext } from '@compiler/strategy';

/**
 * Emits the ports half of the codegen — the abstract `<Service>EventBus` classes and the
 * `EventBusHost` enum — into this package's own `src/generated/index.ts`. The transports are
 * emitted by the adapter packages, each through its own `EventBusAdapter` subclass.
 */
export class PortsEmitter {
  private readonly formatService = new FormatService();

  constructor(
    protected readonly project: Project,
    private readonly context: StrategyContext,
    protected readonly eventBusOutputPath: string,
  ) {}

  private declareImports(outputFile: SourceFile) {
    outputFile.addImportDeclarations(this.context.getStrategyImportStructures());
    return outputFile;
  }

  async compile(services: ServiceModel[]) {
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
    await this.formatService.saveSourceFile(outputFile);
  }
}
