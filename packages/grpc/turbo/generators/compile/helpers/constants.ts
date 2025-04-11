import { join } from 'path';

export const GRPC_PACKAGE_ROOT = join(__dirname, '../../../..');
export const REPOSITORY_ROOT = join(GRPC_PACKAGE_ROOT, '../..');
export const NODE_MODULES_ROOT = join(REPOSITORY_ROOT, 'node_modules');
export const PROTO_SRC_ROOT = join(GRPC_PACKAGE_ROOT, 'proto');
export const ADAPTER_DIR_ROOT = join(GRPC_PACKAGE_ROOT, 'adapters');

export const PROTOC_PATH = process.env.PROTOC_PATH ?? 'protoc';
export const PROTOC_PLUGIN_PATH = join(NODE_MODULES_ROOT, '.bin/protoc-gen-ts_proto');

export const PROTO_EXT_REG_EXP = /.proto$/g;

export const TEMPLATES_ROOT = join(__dirname, '..', 'templates');
export const COMMON_TEMPLATES_ROOT = join(TEMPLATES_ROOT, 'common');
