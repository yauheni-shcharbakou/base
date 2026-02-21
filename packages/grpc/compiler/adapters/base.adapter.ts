import { GRPC_PACKAGE_ROOT, PUG_EXT_REG_EXP } from 'compiler/constants';
import { ContextService } from 'compiler/services';
import { TransformTaskClass } from 'compiler/tasks';
import { CompilerContext, OnFilePayload, OnFolderPayload, ProtoContext } from 'compiler/types';
import Pug from 'pug';
import { mkdir, rm, cp, writeFile, readdir, readFile } from 'node:fs/promises';
import { Project, SourceFile } from 'ts-morph';
import { join } from 'node:path';

export type AdapterParams = {
  name: string;
  targetRoot: string;
  transformTasks?: TransformTaskClass[];
  restrictedContexts?: CompilerContext[];
  templatePath?: string;
};

export type AdapterClass = Function & {
  new (
    contextService: ContextService,
    name: string,
    targetRoot: string,
    templatePath?: string,
    transformTasks?: TransformTaskClass[],
    restrictedContexts?: CompilerContext[],
  ): BaseAdapter;
};

export type AdapterFactory = (contextService: ContextService) => BaseAdapter;

export abstract class BaseAdapter {
  protected readonly project: Project;
  protected hasAssets = false;
  protected readonly templateByName = new Map<string, Pug.compileTemplate>();

  protected constructor(
    protected readonly contextService: ContextService,
    protected readonly name: string,
    public readonly targetRoot: string,
    protected readonly templatePath?: string,
    protected readonly transformTasks: TransformTaskClass[] = [],
    protected readonly restrictedContexts: CompilerContext[] = [],
  ) {
    this.project = this.getProject();
  }

  protected getProject(): Project {
    return new Project();
  }

  protected async executeTransformTasks(
    sourceFile: SourceFile,
    protoContext: ProtoContext,
    filePath: string,
  ): Promise<void> {
    for (const Task of this.transformTasks) {
      const transformer = new Task(
        sourceFile,
        protoContext,
        filePath,
        this.targetRoot,
        this.templateByName,
      );

      if (await transformer.canTransform()) {
        await transformer.transform();
      }
    }
  }

  protected getEntrypointContent(): string[] {
    const executionContext = this.contextService.getExecutionContext();
    const rows = executionContext.entrypointExports.map((item) => `export * from './${item}';`);

    if (this.hasAssets) {
      rows.push("export * from './__compiler__';");
    }

    return rows;
  }

  protected addSideEffects(sourceFile: SourceFile): void | Promise<void> {}

  static createFactory<Adapter extends typeof BaseAdapter>(
    this: Adapter,
    params: AdapterParams,
  ): AdapterFactory {
    return (contextService: ContextService): BaseAdapter => {
      const Constructor = this as unknown as AdapterClass;

      return new Constructor(
        contextService,
        params.name,
        params.targetRoot,
        params.templatePath,
        params.transformTasks,
        params.restrictedContexts,
      );
    };
  }

  canRun(): boolean {
    return !this.restrictedContexts.includes(this.contextService.getExecutionContext().compiler);
  }

  async onInit(): Promise<void> {
    await rm(this.targetRoot, { recursive: true, force: true });
    await mkdir(this.targetRoot, { recursive: true });

    const assetsSrcPath = join(GRPC_PACKAGE_ROOT, 'compiler', 'adapters', this.name, 'assets');
    const assetsDestPath = join(this.targetRoot, '__compiler__');

    let assetsFiles: string[] | undefined;

    try {
      assetsFiles = await readdir(assetsSrcPath, { recursive: true });
    } catch (error) {}

    if (assetsFiles?.length) {
      this.hasAssets = true;
      await cp(assetsSrcPath, assetsDestPath, { force: true, recursive: true });
    }

    if (this.templatePath) {
      try {
        const templateFiles = await readdir(this.templatePath, { recursive: true });

        await Promise.all(
          templateFiles.map(async (templateFile) => {
            if (!templateFile.endsWith('.pug')) {
              return;
            }

            const pathToTemplate = join(this.templatePath!, templateFile);
            const templateContent = await readFile(pathToTemplate, { encoding: 'utf-8' });

            this.templateByName.set(
              templateFile.replace(PUG_EXT_REG_EXP, ''),
              Pug.compile(templateContent, { pretty: false }),
            );
          }),
        );
      } catch (error) {}
    }

    console.info(`[grpc.${this.name}] Initialization completed`);
  }

  async onFile(payload: OnFilePayload): Promise<void> {
    console.info(`[grpc.${this.name}] File ${payload.relativePath} transformed`);
  }

  async onFolder(payload: OnFolderPayload): Promise<void> {
    const content = Array.from(payload.folderTree.keys())
      .map((item) => `export * from './${item}';`)
      .join('\n');

    const folderPath = join(this.targetRoot, payload.relativePath);
    const filePath = join(folderPath, 'index.ts');

    await mkdir(folderPath, { recursive: true });
    await writeFile(filePath, content, { encoding: 'utf-8' });
  }

  async onSourceFile(relativePath: string): Promise<void> {
    const filePath = join(this.targetRoot, relativePath);
    const sourceFile = this.project.addSourceFileAtPath(filePath);
    const protoContext = this.contextService.getProtoContext(relativePath);

    await this.executeTransformTasks(sourceFile, protoContext, filePath);

    sourceFile.formatText({ indentSize: 2 });
    sourceFile.organizeImports();

    await this.addSideEffects(sourceFile);
    await sourceFile.save();

    console.info(`[grpc.${this.name}] File ${relativePath} compiled`);
  }

  async onFinish(): Promise<void> {
    const content = this.getEntrypointContent().join('\n');
    await writeFile(join(this.targetRoot, 'index.ts'), content, { encoding: 'utf-8' });

    console.info(`[grpc.${this.name}] Finished`);
  }
}
