import { EventEmitter } from 'events';
import { stat } from 'fs/promises';
import { dirname, join, relative } from 'path';
import { PROTO_EXT_REG_EXP, TS_EXT_REG_EXP } from './constants';

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
      importName = relativePath.replace(prefixRegExp, '');
    }

    if (/\//g.test(importName)) {
      continue;
    }

    const fileStat = await stat(join(root, relativePath));

    if (fileStat.isDirectory()) {
      const nestedPath = prefix ? join(prefix, importName) : importName;
      map.set(importName, await parseProtoTree(root, relativePaths, nestedPath, eventEmitter));
      eventEmitter?.emit('folder', relativePath, importName, map.get(importName), !!prefix);
      continue;
    }

    importName = importName.replace(PROTO_EXT_REG_EXP, '').replace(TS_EXT_REG_EXP, '');
    map.set(importName, true);
    eventEmitter?.emit('file', relativePath, importName, !!prefix);
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
