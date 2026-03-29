import { PROTO_EXT_REG_EXP, TS_EXT_REG_EXP } from 'compiler/constants';
import { OnFilePayload, OnFolderPayload } from 'compiler/types';
import { EventEmitter } from 'node:events';
import { stat } from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join, relative } from 'node:path';

export const parseProtoTree = async (
  root: string,
  paths: string[],
  prefix?: string,
  eventEmitter?: EventEmitter,
): Promise<Map<string, any>> => {
  const map = new Map();
  let prefixRegExp: RegExp | undefined;

  if (prefix) {
    prefixRegExp = new RegExp(`^${prefix}/`);
  }

  const relativePaths = paths.filter((item) => prefixRegExp?.test(item) || !prefixRegExp);

  for (const relativePath of relativePaths) {
    let importName = relativePath;

    if (prefix) {
      importName = relativePath.replace(prefixRegExp!, '');
    }

    if (/\//g.test(importName)) {
      continue;
    }

    const fileStat = await stat(join(root, relativePath));

    if (fileStat.isDirectory()) {
      const nestedPath = prefix ? join(prefix, importName) : importName;
      map.set(importName, await parseProtoTree(root, relativePaths, nestedPath, eventEmitter));

      const folderPayload: OnFolderPayload = {
        relativePath,
        importName,
        folderTree: map.get(importName),
        hasPrefix: !!prefix,
      };

      eventEmitter?.emit('folder', folderPayload);
      continue;
    }

    importName = importName.replace(PROTO_EXT_REG_EXP, '').replace(TS_EXT_REG_EXP, '');
    map.set(importName, true);

    const filePayload: OnFilePayload = {
      relativePath,
      importName,
      hasPrefix: !!prefix,
    };

    eventEmitter?.emit('file', filePayload);
  }

  return map;
};

export const getRelativeImportPath = (fromFilePath: string, toFilePath: string): string => {
  let path = relative(dirname(fromFilePath), toFilePath);

  if (!path.startsWith('.')) {
    path = './' + path;
  }

  return path;
};

export const runCommand = promisify(exec);
