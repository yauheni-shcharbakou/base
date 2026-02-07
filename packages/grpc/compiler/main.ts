import { AdapterFactory, BaseAdapter } from 'compiler/adapters/base.adapter';
import { Browser } from 'compiler/adapters/browser';
import { Js } from 'compiler/adapters/js';
import { Nest } from 'compiler/adapters/nest';
import { PROTO_EXT_REG_EXP, PROTO_SRC_ROOT } from 'compiler/constants';
import { ContextService } from 'compiler/services';
import { OnFilePayload, OnFolderPayload } from 'compiler/types';
import { parseProtoTree } from 'compiler/utils';
import { EventEmitter } from 'events';
import { readdir } from 'fs/promises';

const getAdapters = (contextService: ContextService, adapterFactories: AdapterFactory[]) => {
  return adapterFactories.reduce((acc: BaseAdapter[], adapterFactory) => {
    const instance = adapterFactory(contextService);

    if (instance.canRun()) {
      acc.push(instance);
    }

    return acc;
  }, []);
};

const fileSubscriber = (contextService: ContextService) => {
  return (filePayload: OnFilePayload) => {
    contextService.addFile(filePayload.relativePath.replace(PROTO_EXT_REG_EXP, '.ts'));

    if (!filePayload.hasPrefix) {
      contextService.addEntrypointExport(filePayload.importName);
    }
  };
};

const folderSubscriber = (contextService: ContextService) => {
  return (folderPayload: OnFolderPayload) => {
    if (!folderPayload.hasPrefix) {
      contextService.addEntrypointExport(folderPayload.importName);
    }
  };
};

const parseProtoFiles = async (contextService: ContextService, adapters: BaseAdapter[]) => {
  const eventEmitter = new EventEmitter();
  const folderRequests: (() => Promise<void>)[] = [];
  const fileRequests: (() => Promise<void>)[] = [];

  adapters.forEach((adapter) => {
    eventEmitter.on('file', (filePayload: OnFilePayload) => {
      fileRequests.push(async () => adapter.onFile(filePayload));
    });

    eventEmitter.on('folder', (folderPayload: OnFolderPayload) => {
      folderRequests.push(async () => adapter.onFolder(folderPayload));
    });
  });

  eventEmitter.on('file', fileSubscriber(contextService));
  eventEmitter.on('folder', folderSubscriber(contextService));

  const protoFiles = await readdir(PROTO_SRC_ROOT, { recursive: true });
  await parseProtoTree(PROTO_SRC_ROOT, protoFiles, undefined, eventEmitter);
  await contextService.parseProto(protoFiles);

  for (const fileRequest of fileRequests) {
    await fileRequest();
  }

  await Promise.all(folderRequests.map(async (folderRequest) => folderRequest()));

  eventEmitter.removeAllListeners();
};

const parseGoogleFiles = async (contextService: ContextService, adapter: BaseAdapter) => {
  const eventEmitter = new EventEmitter();
  const folderRequests: (() => Promise<void>)[] = [];

  eventEmitter.on('folder', (folderPayload: OnFolderPayload) => {
    folderRequests.push(async () => adapter.onFolder(folderPayload));
  });

  eventEmitter.on('file', fileSubscriber(contextService));
  eventEmitter.on('folder', folderSubscriber(contextService));

  const adapterFiles = await readdir(adapter.targetRoot, { recursive: true });

  await parseProtoTree(
    adapter.targetRoot,
    adapterFiles.filter((filePath) => filePath.startsWith('google')),
    undefined,
    eventEmitter,
  );

  await Promise.all(folderRequests.map(async (folderRequest) => folderRequest()));

  eventEmitter.removeAllListeners();
};

const startCompiler = async (adapterFactories: AdapterFactory[]) => {
  try {
    const contextService = new ContextService();
    const adapters = getAdapters(contextService, adapterFactories);

    await Promise.all(adapters.map(async (adapter) => adapter.onInit()));
    await parseProtoFiles(contextService, adapters);

    for (const adapter of adapters) {
      await parseGoogleFiles(contextService, adapter);
    }

    for (const adapter of adapters) {
      await Promise.all(
        contextService.getExecutionContext().files.map(async (relativePath: string) => {
          await adapter.onSourceFile(relativePath);
        }),
      );

      await adapter.onFinish();
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message, error.stack);
      return;
    }

    console.error('Grpc compiler error');
  }
};

startCompiler([Browser, Js, Nest]).then();
