import { join } from 'path';

export const PACKAGE_ROOT = join(__dirname, '..', '..');
export const NODE_MODULES_ROOT = join(PACKAGE_ROOT, 'node_modules');
export const PROTO_SRC_ROOT = join(PACKAGE_ROOT, 'pkg');
// The well-known types `pkg/` imports, copied from protoc's bundled `include/`. Searched before that
// bundled copy, whose comments differ between protoc releases and end up in the generated code.
export const PROTO_INCLUDE_ROOT = join(PACKAGE_ROOT, 'compiler', 'include');

export const PROTOC_PATH = process.env.PROTOC_PATH ?? 'protoc';
export const PROTOC_PLUGIN_PATH = join(NODE_MODULES_ROOT, '.bin', 'protoc-gen-ts_proto');
