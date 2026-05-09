import { TemplateService } from '@packages/compiler-utils';
import { writeFile } from 'fs/promises';
import { Project, SourceFile } from 'ts-morph';

export type AdapterParams = {
  name: string;
  outputPath: string;
  templatePath?: string;
};

export type AdapterClass = Function & {
  new (
    project: Project,
    name: string,
    eventBusImportSpecifier: string,
    outputPath: string,
    templatePath?: string,
  ): BaseAdapter;
};

export type AdapterFactory = (project: Project, eventBusImportSpecifier: string) => BaseAdapter;

export abstract class BaseAdapter {
  protected constructor(
    protected readonly project: Project,
    protected readonly name: string,
    protected readonly eventBusImportSpecifier: string,
    protected readonly outputPath: string,
    protected readonly templatePath?: string,
  ) {}

  protected readonly templateService = new TemplateService(this.templatePath);

  static createFactory<Adapter extends typeof BaseAdapter>(
    this: Adapter,
    params: AdapterParams,
  ): AdapterFactory {
    return (project: Project, eventBusImportSpecifier: string): BaseAdapter => {
      const Constructor = this as unknown as AdapterClass;
      return new Constructor(
        project,
        params.name,
        eventBusImportSpecifier,
        params.outputPath,
        params.templatePath,
      );
    };
  }

  async onInit() {
    await writeFile(this.outputPath, '/* eslint-disable */\n', { encoding: 'utf-8' });

    if (this.templatePath) {
      await this.templateService.parse();
    }
  }

  protected abstract compile(outputFile: SourceFile): void | Promise<void>;

  async run() {
    await this.onInit();

    const outputFile = this.project.addSourceFileAtPath(this.outputPath);
    await this.compile(outputFile);
  }
}
