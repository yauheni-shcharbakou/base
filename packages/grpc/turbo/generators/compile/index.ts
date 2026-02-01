import { PlopTypes } from '@turbo/gen';
import { EventEmitter } from 'events';
import { mkdir, readdir, rm } from 'fs/promises';
import * as _ from 'lodash';
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
  const strategies: BaseStrategy[] = [new NestStrategy(), new JsStrategy(), new TypesStrategy()];

  plop.setActionType('cleanup', async (answers: GrpcCompilerAnswers) => {
    await Promise.all(
      _.map(strategies, async (strategy) => {
        await rm(strategy.targetRoot, { recursive: true, force: true });
        await mkdir(strategy.targetRoot, { recursive: true });
      }),
    );

    return 'cleanup strategies';
  });

  plop.setActionType('ts-proto', async (answers: GrpcCompilerAnswers) => {
    const eventEmitter = new EventEmitter();

    _.forEach(strategies, (strategy) => {
      eventEmitter.on('file', strategy.onFile.bind(strategy));
      eventEmitter.on('folder', strategy.onFolder.bind(strategy));
    });

    const protoFiles = await readdir(PROTO_SRC_ROOT, { recursive: true });

    eventEmitter.on(
      'file',
      async (relativePath: string, importName: string, hasPrefix: boolean) => {
        const filePath = relativePath.replace(PROTO_EXT_REG_EXP, '.ts');

        answers.files.add(filePath);
        await answers.context.createData(filePath);

        if (!hasPrefix) {
          answers.indexExports.add(importName);
        }
      },
    );

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

    await parseProtoTree(PROTO_SRC_ROOT, protoFiles, undefined, eventEmitter);
    eventEmitter.removeAllListeners();

    for (const strategy of strategies) {
      const eventEmitter = new EventEmitter();

      eventEmitter.on('folder', strategy.onFolder.bind(strategy));

      eventEmitter.on(
        'file',
        async (relativePath: string, importName: string, hasPrefix: boolean) => {
          answers.files.add(relativePath);
          await answers.context.createData(relativePath);

          if (!hasPrefix) {
            answers.indexExports.add(importName);
          }
        },
      );

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

      eventEmitter.removeAllListeners();
    }

    return 'run ts-proto';
  });

  plop.setActionType('ts-morph', async (answers: GrpcCompilerAnswers) => {
    for (const strategy of strategies) {
      const project = new Project(strategy.getProjectOptions());

      for (const appFile of Array.from(answers.files)) {
        const contextData = answers.context.getData(appFile);
        const filePath = join(strategy.targetRoot, appFile);
        const sourceFile = project.addSourceFileAtPath(filePath);
        await strategy.onSourceFile(sourceFile, contextData, filePath);
        await sourceFile.save();

        console.info(
          `[grpc.${strategy.name}] File ${filePath.replace(strategy.targetRoot, '')} compiled`,
        );
      }
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
    actions: _.reduce(
      strategies,
      (acc: PlopTypes.ActionType[], strategy) => _.concat(acc, strategy.getActions()),
      [{ type: 'cleanup' }, { type: 'ts-proto' }, { type: 'ts-morph' }],
    ),
  });
};
