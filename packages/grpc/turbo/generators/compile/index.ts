import { PlopTypes } from '@turbo/gen';
import { EventEmitter } from 'events';
import { mkdir, readdir, rm } from 'fs/promises';
import { Context } from './context';
import { TypesStrategy } from './strategies/types.strategy';
import { JsStrategy } from './strategies/js.strategy';
import { NestStrategy } from './strategies/nest.strategy';
import { BaseStrategy } from './strategies/base.strategy';
import { join } from 'path';
import { Project } from 'ts-morph';
import { parseProtoTree } from './helpers/utils';
import { GrpcCompilerAnswers } from './helpers/types';
import { PROTO_EXT_REG_EXP, PROTO_SRC_ROOT } from './helpers/constants';

export const compileGenerator = (plop: PlopTypes.NodePlopAPI) => {
  const strategies: BaseStrategy[] = [
    new NestStrategy(),
    new JsStrategy(),
    new TypesStrategy(),
  ].filter((strategy) => strategy.canRun());

  plop.setActionType('cleanup', async (answers: GrpcCompilerAnswers) => {
    await Promise.all(
      strategies.map(async (strategy) => {
        await rm(strategy.targetRoot, { recursive: true, force: true });
        await mkdir(strategy.targetRoot, { recursive: true });
      }),
    );

    return 'cleanup strategies';
  });

  plop.setActionType('ts-proto', async (answers: GrpcCompilerAnswers) => {
    const eventEmitter = new EventEmitter();
    let subscriptions: (() => Promise<void>)[] = [];

    strategies.forEach((strategy) => {
      eventEmitter.on('file', strategy.onFile.bind(strategy));
      eventEmitter.on('folder', strategy.onFolder.bind(strategy));
    });

    eventEmitter.on('file', (relativePath: string, importName: string, hasPrefix: boolean) => {
      subscriptions.push(async () => {
        const filePath = relativePath.replace(PROTO_EXT_REG_EXP, '.ts');

        answers.files.add(filePath);
        await answers.context.createData(filePath);

        if (!hasPrefix) {
          answers.indexExports.add(importName);
        }
      });
    });

    eventEmitter.on(
      'folder',
      (
        relativePath: string,
        importName: string,
        folderTree: Map<string, any>,
        hasPrefix: boolean,
      ) => {
        if (!hasPrefix) {
          answers.indexExports.add(importName);
        }
      },
    );

    const protoFiles = await readdir(PROTO_SRC_ROOT, { recursive: true });
    await parseProtoTree(PROTO_SRC_ROOT, protoFiles, undefined, eventEmitter);
    await Promise.all(subscriptions.map((sub) => sub()));

    eventEmitter.removeAllListeners();
    subscriptions = [];

    for (const strategy of strategies) {
      const eventEmitter = new EventEmitter();

      eventEmitter.on('folder', strategy.onFolder.bind(strategy));

      eventEmitter.on('file', (relativePath: string, importName: string, hasPrefix: boolean) => {
        subscriptions.push(async () => {
          answers.files.add(relativePath);
          await answers.context.createData(relativePath);

          if (!hasPrefix) {
            answers.indexExports.add(importName);
          }
        });
      });

      eventEmitter.on(
        'folder',
        (
          relativePath: string,
          importName: string,
          folderTree: Map<string, any>,
          hasPrefix: boolean,
        ) => {
          if (!hasPrefix) {
            answers.indexExports.add(importName);
          }
        },
      );

      const adapterFiles = await readdir(strategy.targetRoot, { recursive: true });

      await parseProtoTree(
        strategy.targetRoot,
        adapterFiles.filter((filePath) => filePath.startsWith('google')),
        undefined,
        eventEmitter,
      );

      await Promise.all(subscriptions.map((sub) => sub()));
      eventEmitter.removeAllListeners();
    }

    return 'run ts-proto';
  });

  plop.setActionType('ts-morph', async (answers: GrpcCompilerAnswers) => {
    for (const strategy of strategies) {
      const project = new Project(strategy.getProjectOptions());

      await Promise.all(
        Array.from(answers.files).map(async (appFile) => {
          const contextData = answers.context.getData(appFile);
          const filePath = join(strategy.targetRoot, appFile);
          const sourceFile = project.addSourceFileAtPath(filePath);
          await strategy.onSourceFile(sourceFile, contextData, filePath);
          await sourceFile.save();

          console.info(
            `[grpc.${strategy.name}] File ${filePath.replace(strategy.targetRoot, '')} compiled`,
          );
        }),
      );
    }

    return 'run ts-morph';
  });

  plop.setGenerator('compile', {
    description: 'Compile gRPC adapters',
    prompts: async () => ({
      files: new Set<string>(),
      indexExports: new Set<string>(),
      context: new Context(),
    }),
    actions: strategies.reduce(
      (acc: PlopTypes.ActionType[], strategy) => acc.concat(strategy.getActions()),
      [{ type: 'cleanup' }, { type: 'ts-proto' }, { type: 'ts-morph' }],
    ),
  });
};
