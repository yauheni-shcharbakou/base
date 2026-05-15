import { join } from 'path';
import {
  ImportDeclarationStructure,
  ImportSpecifierStructure,
  OptionalKind,
  Project,
  SourceFile,
} from 'ts-morph';

export class ContextService {
  protected readonly strategyFile: SourceFile;
  protected readonly strategyImportStructures: ImportDeclarationStructure[] = [];
  protected readonly externalImportStructures: ImportDeclarationStructure[] = [];
  protected readonly eventBusImports: (string | OptionalKind<ImportSpecifierStructure>)[] = [];

  constructor(
    protected readonly project: Project,
    protected readonly strategyDirPath: string,
    protected readonly eventBusImportSpecifier: string,
  ) {
    this.project.addSourceFilesAtPaths(`${this.strategyDirPath}/**/*.ts`);

    const strategyFilePath = join(this.strategyDirPath, 'strategy.ts');
    this.strategyFile = this.project.getSourceFileOrThrow(strategyFilePath);

    this.strategyFile.getImportDeclarations().forEach((declaration) => {
      const struct = declaration.getStructure();

      this.strategyImportStructures.push(struct);

      if (/^@(packages|backend)\//g.test(struct.moduleSpecifier)) {
        this.externalImportStructures.push(struct);
      } else {
        if (Array.isArray(struct.namedImports)) {
          this.eventBusImports.push(
            ...struct.namedImports.reduce(
              (acc: (string | OptionalKind<ImportSpecifierStructure>)[], item) => {
                if (typeof item === 'string' || typeof item === 'object') {
                  acc.push(item);
                }

                return acc;
              },
              [],
            ),
          );
        }
      }
    });
  }

  getStrategyFile(): SourceFile {
    return this.strategyFile;
  }

  getStrategyImportStructures(): ImportDeclarationStructure[] {
    return this.strategyImportStructures;
  }

  getExternalImportStructures(): ImportDeclarationStructure[] {
    return this.externalImportStructures;
  }

  getEventBusImports(): (string | OptionalKind<ImportSpecifierStructure>)[] {
    return this.eventBusImports;
  }

  getEventBusImportSpecifier(): string {
    return this.eventBusImportSpecifier;
  }
}
