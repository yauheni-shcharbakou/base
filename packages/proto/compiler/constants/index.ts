import { join } from 'path';

export const PACKAGE_ROOT = join(__dirname, '..', '..');
export const REPOSITORY_ROOT = join(PACKAGE_ROOT, '..', '..');
export const NODE_MODULES_ROOT = join(PACKAGE_ROOT, 'node_modules');
export const PROTO_SRC_ROOT = join(PACKAGE_ROOT, 'pkg');

export const BACKEND_PACKAGES_DIR_ROOT = join(REPOSITORY_ROOT, 'backend', 'packages');
export const FRONTEND_PACKAGES_DIR_ROOT = join(REPOSITORY_ROOT, 'frontend', 'packages');

export const PROTOC_PATH = process.env.PROTOC_PATH ?? 'protoc';
export const PROTOC_PLUGIN_PATH = join(NODE_MODULES_ROOT, '.bin', 'protoc-gen-ts_proto');

export const PROTO_EXT_REG_EXP = /.proto$/g;
export const TS_EXT_REG_EXP = /.ts$/g;
export const PUG_EXT_REG_EXP = /.pug$/g;
