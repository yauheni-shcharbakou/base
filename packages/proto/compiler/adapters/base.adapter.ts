import { PUG_EXT_REG_EXP } from 'compiler/constants';
import { ContextService } from 'compiler/services';
import { TransformTaskClass } from 'compiler/tasks';
import { CompilerContext, OnFilePayload, OnFolderPayload, ProtoContext } from 'compiler/types';
import Pug from 'pug';
import { mkdir, rm, writeFile, readdir, readFile } from 'node:fs/promises';
import { Project, SourceFile } from 'ts-morph';
import { join } from 'node:path';
import { dotCase, pascalCase } from 'change-case-all';

export type AdapterParams = {
  name: string;
  targetRoot: string;
  templatePath?: string;
  transformTasks?: TransformTaskClass[];
  restrictedContexts?: CompilerContext[];
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
    return this.contextService.getExecutionContext().entrypointExports.map((item) => {
      const exportAlias = pascalCase(`${this.name}.${dotCase(item)}.proto`);
      return `export * as ${exportAlias} from './${item}';`;
    });
  }

  protected async compileTemplates() {
    if (!this.templatePath) {
      return;
    }

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
    await this.compileTemplates();
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

  async beforeCompilation() {
    this.project.addSourceFilesAtPaths(`${this.targetRoot}/**/*.ts`);
  }

  async onSourceFile(relativePath: string): Promise<void> {
    const filePath = join(this.targetRoot, relativePath);
    const sourceFile = this.project.getSourceFile(filePath);

    if (!sourceFile) {
      throw new Error(`Source file ${filePath} not found`);
    }

    const protoContext = this.contextService.getProtoContext(relativePath);

    await this.executeTransformTasks(sourceFile, protoContext, filePath);

    sourceFile.formatText({ indentSize: 2 });
    sourceFile.fixUnusedIdentifiers();
    sourceFile.fixMissingImports({}, { preferTypeOnlyAutoImports: true });
    sourceFile.organizeImports({}, { preferTypeOnlyAutoImports: true });

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
