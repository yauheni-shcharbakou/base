import { constantCase } from 'change-case-all';
import { ProtoContext } from '@compiler/types';
import { TS_EXT_REG_EXP } from '@packages/compiler-utils';
import { sep } from 'path';
import {
  ImportSpecifierStructure,
  OptionalKind,
  SourceFile,
  StructureKind,
  VariableStatement,
} from 'ts-morph';
import { ImportService, TemplateService } from '@packages/compiler-utils';

type TemplateOptions = {
  data: Record<string, any>;
  [field: string]: any;
};

export abstract class TransformTask {
  protected readonly importService: ImportService;

  constructor(
    protected readonly sourceFile: SourceFile,
    protected readonly protoContext: ProtoContext,
    protected readonly templateService: TemplateService,
    protected readonly relativePath: string,
    protected readonly sourceCodeRootPath: string,
    protected readonly entryExportsMap: Map<string, Map<string, ImportSpecifierStructure>>,
  ) {
    this.importService = new ImportService(sourceFile);
  }

  protected getVariableStatement(name: string): VariableStatement | undefined {
    return this.sourceFile.getVariableStatement((stmt) => {
      return stmt.getDeclarations().some((decl) => decl.getName() === name);
    });
  }

  protected getPackageNameValue(): string | undefined {
    if (!this.protoContext.packageId) {
      return;
    }

    const packageNameConst = constantCase(`${this.protoContext.packageId}.package.name`);
    return this.sourceFile.getVariableDeclaration(packageNameConst)?.getInitializer()?.getText();
  }

  protected addEntryExports(...items: (string | OptionalKind<ImportSpecifierStructure>)[]) {
    const exportPath = '.' + sep + this.relativePath.replace(TS_EXT_REG_EXP, '');
    const exportItems =
      this.entryExportsMap.get(exportPath) ?? new Map<string, ImportSpecifierStructure>();

    items.forEach((item) => {
      if (typeof item === 'string') {
        const existsItem = exportItems.get(item) ?? {};
        exportItems.set(item, { ...existsItem, name: item, kind: StructureKind.ImportSpecifier });
        return;
      }

      const existsItem = exportItems.get(item.name) ?? {};
      exportItems.set(item.name, { ...existsItem, ...item, kind: StructureKind.ImportSpecifier });
    });

    this.entryExportsMap.set(exportPath, exportItems);
  }

  canTransform(): boolean | Promise<boolean> {
    return true;
  }

  abstract transform(): void | Promise<void>;
}

export type TransformTaskClass = Function & {
  new (
    sourceFile: SourceFile,
    context: ProtoContext,
    templateService: TemplateService,
    relativePath: string,
    sourceCodeRootPath: string,
    entryExportsMap: Map<string, Map<string, ImportSpecifierStructure>>,
  ): TransformTask;
};
