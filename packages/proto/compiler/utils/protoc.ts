import { PROTO_INCLUDE_ROOT, PROTO_SRC_ROOT, PROTOC_PATH } from '@compiler/constants';
import { exec } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';

export const runCommand = promisify(exec);

/** `node_modules/.bin/protoc-gen-ts_proto` of the package rooted at `packageRoot`. */
export const getProtocPluginPath = (packageRoot: string): string => {
  return join(packageRoot, 'node_modules', '.bin', 'protoc-gen-ts_proto');
};

export type ProtocParams = {
  /** The target's own `protoc-gen-ts_proto` — see `getProtocPluginPath`. */
  pluginPath: string;
  outDir: string;
  /** The adapter's ts-proto options, each passed as `--ts_proto_opt=<option>`. */
  options: string[];
};

/**
 * Runs protoc + ts-proto over one file of `pkg/`, given relative to it.
 *
 * The flags here are the ones every target needs for its output to be reproducible, so no
 * adapter can drop one: `pkg/` and the vendored well-known types as the only `--proto_path`s
 * searched before protoc's bundled copy, and no tool versions in the generated headers.
 */
export const runProtoc = async (relativePath: string, params: ProtocParams): Promise<void> => {
  const command = [
    PROTOC_PATH,
    `--plugin=${params.pluginPath}`,
    '--proto_path=.',
    `--proto_path=${PROTO_INCLUDE_ROOT}`,
    `--ts_proto_out=${params.outDir}`,
    '--ts_proto_opt=annotateFilesWithVersion=false',
    ...params.options.map((option) => `--ts_proto_opt=${option}`),
    `./${relativePath}`,
  ].join(' ');

  await runCommand(command, { cwd: PROTO_SRC_ROOT, encoding: 'utf-8' });
};
