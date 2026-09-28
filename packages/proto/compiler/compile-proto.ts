import { AdapterFactory, BaseAdapter } from '@compiler/adapters/base.adapter';
import { PROTO_SRC_ROOT } from '@compiler/constants';
import { ContextService } from '@compiler/services';
import { OnFilePayload, OnFolderPayload } from '@compiler/types';
import { parseProtoTree } from '@compiler/utils';
import { PROTO_EXT_REG_EXP } from '@packages/compiler-utils';
import { EventEmitter } from 'node:events';
import { readdir } from 'node:fs/promises';

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

const parseProtoFiles = async (contextService: ContextService, adapter: BaseAdapter) => {
  const eventEmitter = new EventEmitter();
  const folderRequests: (() => Promise<void>)[] = [];
  const fileRequests: (() => Promise<void>)[] = [];

  eventEmitter.on('file', (filePayload: OnFilePayload) => {
    fileRequests.push(async () => adapter.onFile(filePayload));
  });

  eventEmitter.on('folder', (folderPayload: OnFolderPayload) => {
    folderRequests.push(async () => adapter.onFolder(folderPayload));
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

/**
 * Generates one target from `pkg/`: the adapter's `targetRoot` is wiped, filled by protoc,
 * rewritten by the adapter's transform tasks and given its root `index.ts`.
 *
 * One adapter per call, and each target package calls it from its own `compile` task — the only
 * arrangement in which a task's declared `outputs` are everything it writes. Rejects on the first
 * failure; the caller exits non-zero, so a broken codegen fails its turbo task.
 */
export const compileProto = async (adapterFactory: AdapterFactory): Promise<void> => {
  const contextService = new ContextService();
  const adapter = adapterFactory(contextService);

  await adapter.onInit();
  await parseProtoFiles(contextService, adapter);
  await parseGoogleFiles(contextService, adapter);
  await adapter.beforeCompilation();

  await Promise.all(
    contextService.getExecutionContext().files.map(async (relativePath: string) => {
      await adapter.onSourceFile(relativePath);
    }),
  );

  await adapter.onFinish();
};
