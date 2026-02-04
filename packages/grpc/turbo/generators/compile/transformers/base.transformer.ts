import { constantCase } from 'change-case-all';
import { ContextData } from '../context';
import { getRelativeImportPath } from '../helpers/utils';
import { join } from 'path';
import { SourceFile, VariableStatement } from 'ts-morph';

export abstract class BaseTransformer {
  protected readonly importFromCompilerPath: string;

  constructor(
    protected readonly sourceFile: SourceFile,
    protected readonly contextData: ContextData,
    protected readonly filePath: string,
    protected readonly sourceCodeRootPath: string,
  ) {
    this.importFromCompilerPath = getRelativeImportPath(
      this.filePath,
      join(sourceCodeRootPath, '__compiler__'),
    );

    this.onInit();
  }

  protected onInit(): void {}

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
    if (!this.contextData.packageId) {
      return;
    }

    const packageNameConst = constantCase(`${this.contextData.packageId}.package.name`);
    return this.sourceFile.getVariableDeclaration(packageNameConst)?.getInitializer()?.getText();
  }

  canTransform(): boolean | Promise<boolean> {
    return true;
  }

  abstract transform(): void | Promise<void>;
}
