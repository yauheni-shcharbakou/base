import type { ImportSpecifierStructure, OptionalKind, SourceFile } from 'ts-morph';

export class ImportService {
  constructor(protected readonly sourceFile: Omit<SourceFile, '#private'>) {}

  addOrUpdate(
    moduleName: string,
    namedImports: (string | OptionalKind<ImportSpecifierStructure>)[],
  ) {
    const existingImport = this.sourceFile.getImportDeclaration(moduleName);

    const updatedImports: OptionalKind<ImportSpecifierStructure>[] = namedImports.map(
      (updatedImport) => {
        if (typeof updatedImport === 'string') {
          return { name: updatedImport };
        }

        return updatedImport;
      },
    );

    if (existingImport) {
      const structure = existingImport.getStructure();

      if (Array.isArray(structure.namedImports)) {
        const importsMap = new Map<string, OptionalKind<ImportSpecifierStructure>>();

        structure.namedImports.forEach((namedImport) => {
          if (typeof namedImport === 'string') {
            importsMap.set(namedImport, {
              name: namedImport,
              isTypeOnly: structure.isTypeOnly,
            });

            return;
          }

          if (typeof namedImport === 'object') {
            importsMap.set(namedImport.name, {
              ...namedImport,
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
}
