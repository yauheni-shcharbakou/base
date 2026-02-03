import { join } from 'path';
import zod from 'zod';

export const GRPC_PACKAGE_ROOT = join(__dirname, '../../../..');
export const REPOSITORY_ROOT = join(GRPC_PACKAGE_ROOT, '../..');
export const NODE_MODULES_ROOT = join(REPOSITORY_ROOT, 'node_modules');
export const PROTO_SRC_ROOT = join(GRPC_PACKAGE_ROOT, 'proto');

export const BACKEND_PACKAGES_DIR_ROOT = join(REPOSITORY_ROOT, 'backend', 'packages');
export const FRONTEND_PACKAGES_DIR_ROOT = join(REPOSITORY_ROOT, 'frontend', 'packages');

export const PROTOC_PATH = process.env.PROTOC_PATH ?? 'protoc';
export const PROTOC_PLUGIN_PATH = join(NODE_MODULES_ROOT, '.bin', 'protoc-gen-ts_proto');

export const PROTO_EXT_REG_EXP = /.proto$/g;
export const TS_EXT_REG_EXP = /.ts$/g;

export const TEMPLATES_ROOT = join(__dirname, '..', 'templates');

export const env = zod
  .object({ GRPC_COMPILER_CONTEXT: zod.enum(['backend', 'frontend', 'all']).default('all') })
  .parse(process.env);
