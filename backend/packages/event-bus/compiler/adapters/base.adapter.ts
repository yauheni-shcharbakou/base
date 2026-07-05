import { ContextService, ServiceEventBus } from '@compiler/services';
import { TemplateService, ImportService } from '@packages/compiler-utils';
import { Project, SourceFile } from 'ts-morph';

export type AdapterParams = {
  name: string;
  outputPath: string;
  templatePath?: string;
};

export type AdapterClass = {
  new (
    contextService: ContextService,
    services: ServiceEventBus[],
    name: string,
    outputPath: string,
    templatePath?: string,
  ): BaseAdapter;
};

export type AdapterFactory = (
  contextService: ContextService,
  services: ServiceEventBus[],
) => BaseAdapter;

export abstract class BaseAdapter {
  protected readonly project: Project;
  protected readonly outputFile: SourceFile;
  protected readonly templateService: TemplateService;
  protected readonly importService: ImportService;

  protected constructor(
    protected readonly contextService: ContextService,
    protected readonly services: ServiceEventBus[],
    protected readonly name: string,
    protected readonly outputPath: string,
    protected readonly templatePath?: string,
  ) {
    this.project = this.getProject();
    this.outputFile = this.project.addSourceFileAtPath(outputPath);
    this.templateService = new TemplateService(this.templatePath);
    this.importService = new ImportService(this.outputFile);
  }

  protected getProject() {
    return new Project({
      compilerOptions: {
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      },
    });
  }

  static createFactory<Adapter extends typeof BaseAdapter>(
    this: Adapter,
    params: AdapterParams,
  ): AdapterFactory {
    return (contextService: ContextService, services: ServiceEventBus[]): BaseAdapter => {
      const Constructor = this as unknown as AdapterClass;
      return new Constructor(
        contextService,
        services,
        params.name,
        params.outputPath,
        params.templatePath,
      );
    };
  }

  async onInit() {
    this.outputFile.replaceWithText('/* eslint-disable */\n');
    this.outputFile.addImportDeclarations(this.contextService.getExternalImportStructures());

    this.importService.addOrUpdate(
      this.contextService.getEventBusImportSpecifier(),
      this.contextService.getEventBusImports(),
    );

    if (this.templatePath) {
      await this.templateService.parse();
    }
  }

  protected abstract compile(): void | Promise<void>;

  async run() {
    await this.onInit();
    await this.compile();

    this.outputFile.organizeImports();
    this.outputFile.fixMissingImports();
    await this.outputFile.save();
  }
}
