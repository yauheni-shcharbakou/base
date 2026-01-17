import { getRelativeImportPath } from '../helpers/utils';
import { join } from 'path';
import { SourceFile } from 'ts-morph';

export abstract class BaseTransformer {
  protected readonly importFromCompilerPath: string;

  constructor(
    protected readonly sourceFile: SourceFile,
    protected readonly fileId: string,
    protected readonly filePath: string,
    sourceCodeRootPath: string,
  ) {
    this.importFromCompilerPath = getRelativeImportPath(
      this.filePath,
      join(sourceCodeRootPath, '__compiler__'),
    );

    this.onInit();
  }

  protected onInit(): void {}

  protected addOrUpdateImport(moduleName: string, namedImports: string[]) {
    const existingImport = this.sourceFile.getImportDeclaration(moduleName);

    if (existingImport) {
      existingImport.addNamedImports(namedImports);
    } else {
      this.sourceFile.addImportDeclaration({
        moduleSpecifier: moduleName,
        namedImports: namedImports,
      });
    }
  }

  canTransform(): boolean | Promise<boolean> {
    return true;
  }

  abstract transform(): void | Promise<void>;
}
