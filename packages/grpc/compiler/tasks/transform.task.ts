import { constantCase } from 'change-case-all';
import { ProtoContext } from 'compiler/types';
import { getRelativeImportPath } from 'compiler/utils';
import { join } from 'node:path';
import Pug from 'pug';
import { SourceFile, VariableStatement } from 'ts-morph';

type TemplateOptions = {
  data: Record<string, any>;
  [field: string]: any;
};

export abstract class TransformTask {
  protected readonly importFromCompilerPath: string;

  constructor(
    protected readonly sourceFile: SourceFile,
    protected readonly protoContext: ProtoContext,
    protected readonly filePath: string,
    protected readonly sourceCodeRootPath: string,
    protected readonly templateByName: Map<string, Pug.compileTemplate>,
  ) {
    this.importFromCompilerPath = getRelativeImportPath(
      this.filePath,
      join(sourceCodeRootPath, '__compiler__'),
    );

    this.onInit();
  }

  protected onInit(): void {}

  protected renderTemplate(templateName: string, data: TemplateOptions): string {
    return this.templateByName.get(templateName)?.(data) || '';
  }

  protected addOrUpdateImport(moduleName: string, namedImports: string[], type = false) {
    const existingImport = this.sourceFile.getImportDeclaration(moduleName);

    if (existingImport) {
      existingImport.addNamedImports(namedImports);
    } else {
      this.sourceFile.addImportDeclaration({
        moduleSpecifier: moduleName,
        namedImports: namedImports,
        isTypeOnly: type,
      });
    }
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

  canTransform(): boolean | Promise<boolean> {
    return true;
  }

  abstract transform(): void | Promise<void>;
}

export type TransformTaskClass = Function & {
  new (
    sourceFile: SourceFile,
    context: ProtoContext,
    filePath: string,
    sourceCodeRootPath: string,
    templateByName: Map<string, Pug.compileTemplate>,
  ): TransformTask;
};
