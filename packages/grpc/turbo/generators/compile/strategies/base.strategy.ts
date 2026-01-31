import { PlopTypes } from '@turbo/gen';
import { writeFileSync, mkdirSync } from 'fs';
import { Type } from '../helpers/types';
import { BaseTransformer } from '../transformers/base.transformer';
import { ProjectOptions, SourceFile } from 'ts-morph';
import { TEMPLATES_ROOT } from '../helpers/constants';
import { join } from 'path';

export abstract class BaseStrategy {
  public readonly targetRoot: string;
  protected readonly strategyTemplatesRoot: string;

  protected constructor(
    public readonly name: string,
    protected readonly root: string,
    protected readonly transformers: Type<BaseTransformer>[],
  ) {
    this.targetRoot = join(root, 'src');
    this.strategyTemplatesRoot = join(TEMPLATES_ROOT, this.name);
  }

  protected async executeTransformers(
    sourceFile: SourceFile,
    fileId: string,
    filePath: string,
  ): Promise<void> {
    for (const Transformer of this.transformers) {
      const transformer = new Transformer(sourceFile, fileId, filePath, this.targetRoot);

      if (await transformer.canTransform()) {
        await transformer.transform();
      }
    }
  }

  abstract onFile(relativePath: string, importName: string, hasPrefix: boolean): void;

  getProjectOptions(): ProjectOptions {
    return {};
  }

  onFolder(
    relativePath: string,
    importName: string,
    folderTree: Map<string, any>,
    hasPrefix: boolean,
  ): void {
    const exports = Array.from(folderTree.keys())
      .map((item) => `export * from './${item}';\n`)
      .join('');

    const folderPath = join(this.targetRoot, relativePath);
    const filePath = join(folderPath, 'index.ts');

    mkdirSync(folderPath, { recursive: true });
    writeFileSync(filePath, exports, { encoding: 'utf-8' });
  }

  getActions(): PlopTypes.ActionType[] {
    return [
      {
        type: 'addMany',
        destination: this.targetRoot,
        base: this.strategyTemplatesRoot,
        templateFiles: [this.strategyTemplatesRoot, join(this.strategyTemplatesRoot, '**/.*')],
        force: true,
      },
    ];
  }

  async onSourceFile(sourceFile: SourceFile, fileId: string, filePath: string): Promise<void> {
    await this.executeTransformers(sourceFile, fileId, filePath);
  }
}
