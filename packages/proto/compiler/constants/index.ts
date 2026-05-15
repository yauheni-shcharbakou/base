import { join } from 'path';

export const PACKAGE_ROOT = join(__dirname, '..', '..');
export const NODE_MODULES_ROOT = join(PACKAGE_ROOT, 'node_modules');
export const PROTO_SRC_ROOT = join(PACKAGE_ROOT, 'pkg');

export const PROTOC_PATH = process.env.PROTOC_PATH ?? 'protoc';
export const PROTOC_PLUGIN_PATH = join(NODE_MODULES_ROOT, '.bin', 'protoc-gen-ts_proto');
