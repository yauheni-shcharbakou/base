import { constantCase } from 'change-case-all';
import { TS_EXT_REG_EXP } from 'compiler/constants';
import { ProtoContext } from 'compiler/types';
import { sep } from 'path';
import Pug from 'pug';
import {
  ImportSpecifierStructure,
  OptionalKind,
  SourceFile,
  StructureKind,
  SyntaxKind,
  VariableStatement,
} from 'ts-morph';

type TemplateOptions = {
  data: Record<string, any>;
  [field: string]: any;
};

export abstract class TransformTask {
  constructor(
    protected readonly sourceFile: SourceFile,
    protected readonly protoContext: ProtoContext,
    protected readonly relativePath: string,
    protected readonly sourceCodeRootPath: string,
    protected readonly templateByName: Map<string, Pug.compileTemplate>,
    protected readonly entryExportsMap: Map<string, Map<string, ImportSpecifierStructure>>,
  ) {
    this.onInit();
  }

  protected onInit(): void {}

  protected renderTemplate(templateName: string, data: TemplateOptions): string {
    return this.templateByName.get(templateName)?.(data) || '';
  }

  protected addOrUpdateImport(
    moduleName: string,
    namedImports: (string | OptionalKind<ImportSpecifierStructure>)[],
  ) {
    const existingImport = this.sourceFile.getImportDeclaration(moduleName);

    const updatedImports: ImportSpecifierStructure[] = namedImports.map((updatedImport) => {
      if (typeof updatedImport === 'string') {
        return {
          name: updatedImport,
          kind: StructureKind.ImportSpecifier,
        };
      }

      return { ...updatedImport, kind: StructureKind.ImportSpecifier };
    });

    if (existingImport) {
      const structure = existingImport.getStructure();

      if (Array.isArray(structure.namedImports)) {
        const importsMap = new Map<string, ImportSpecifierStructure>();

        structure.namedImports.forEach((namedImport) => {
          if (typeof namedImport === 'string') {
            importsMap.set(namedImport, {
              name: namedImport,
              kind: StructureKind.ImportSpecifier,
              isTypeOnly: structure.isTypeOnly,
            });
            return;
          }

          if (typeof namedImport === 'object') {
            importsMap.set(namedImport.name, {
              ...namedImport,
              kind: StructureKind.ImportSpecifier,
              isTypeOnly: structure.isTypeOnly,
            });
          }
        });

        updatedImports.forEach((updatedImport) => {
          const existsDeclaration = importsMap.get(updatedImport.name) ?? {};
          importsMap.set(updatedImport.name, { ...existsDeclaration, ...updatedImport });
        });

        structure.isTypeOnly = false;
        structure.namedImports = Array.from(importsMap.values());
      }

      existingImport.remove();
      this.sourceFile.addImportDeclaration(structure);
      return;
    }

    this.sourceFile.addImportDeclaration({
      moduleSpecifier: moduleName,
      namedImports: updatedImports,
      isTypeOnly: false,
    });
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
    relativePath: string,
    sourceCodeRootPath: string,
    templateByName: Map<string, Pug.compileTemplate>,
    entryExportsMap: Map<string, Map<string, ImportSpecifierStructure>>,
  ): TransformTask;
};
