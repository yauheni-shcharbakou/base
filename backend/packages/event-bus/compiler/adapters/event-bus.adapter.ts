import { ServiceModel, StrategyContext } from '@compiler/strategy';
import { FormatService, ImportService, TemplateService } from '@packages/compiler-utils';
import { mkdir, writeFile } from 'fs/promises';
import { dirname } from 'path';
import { Project, SourceFile } from 'ts-morph';

export type EventBusAdapterParams = {
  name: string;
  outputPath: string;
  templatePath?: string;
};

type EventBusAdapterClass = {
  new (
    context: StrategyContext,
    services: ServiceModel[],
    name: string,
    outputPath: string,
    templatePath?: string,
  ): EventBusAdapter;
};

export type EventBusAdapterFactory = (
  context: StrategyContext,
  services: ServiceModel[],
) => EventBusAdapter;

export abstract class EventBusAdapter {
  protected readonly project: Project;
  protected readonly templateService: TemplateService;
  protected readonly formatService = new FormatService();
  protected outputFile: SourceFile;
  protected importService: ImportService;

  protected constructor(
    protected readonly context: StrategyContext,
    protected readonly services: ServiceModel[],
    protected readonly name: string,
    protected readonly outputPath: string,
    protected readonly templatePath?: string,
  ) {
    this.project = this.getProject();
    this.templateService = new TemplateService(this.templatePath);
  }

  protected getProject() {
    return new Project({
      compilerOptions: {
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      },
    });
  }

  static createFactory<Adapter extends typeof EventBusAdapter>(
    this: Adapter,
    params: EventBusAdapterParams,
  ): EventBusAdapterFactory {
    return (context: StrategyContext, services: ServiceModel[]): EventBusAdapter => {
      const Constructor = this as unknown as EventBusAdapterClass;
      return new Constructor(
        context,
        services,
        params.name,
        params.outputPath,
        params.templatePath,
      );
    };
  }

  async onInit() {
    // The adapter owns its output file the way `PortsEmitter` owns the event-bus one:
    // adding a new adapter must not require its `generated/` file to exist beforehand.
    await mkdir(dirname(this.outputPath), { recursive: true });
    await writeFile(this.outputPath, '/* eslint-disable */\n', { encoding: 'utf-8' });

    this.outputFile = this.project.addSourceFileAtPath(this.outputPath);
    this.importService = new ImportService(this.outputFile);

    this.outputFile.addImportDeclarations(this.context.getExternalImportStructures());

    this.importService.addOrUpdate(
      this.context.getEventBusImportSpecifier(),
      this.context.getEventBusImports(),
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
    await this.formatService.saveSourceFile(this.outputFile);
  }
}
