import { TransformTask } from 'compiler/tasks';

export class FixBrowserEmptyFilesTask extends TransformTask {
  transform(): void {
    if (!this.sourceFile.getExportSymbols().length) {
      this.sourceFile.addExportDeclaration({});
    }
  }
}
