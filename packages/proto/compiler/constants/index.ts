import { dirname, join } from 'path';

// Resolved rather than derived from `__dirname`: this module runs both from source (this
// package's own `compile`) and bundled into `dist/compiler.cjs` (the target packages'), and
// the two sit at different depths. The self-reference lands on the same directory either way.
export const PACKAGE_ROOT = dirname(require.resolve('@packages/proto/package.json'));
export const PROTO_SRC_ROOT = join(PACKAGE_ROOT, 'pkg');
// The well-known types `pkg/` imports, copied from protoc's bundled `include/`. Searched before that
// bundled copy, whose comments differ between protoc releases and end up in the generated code.
export const PROTO_INCLUDE_ROOT = join(PACKAGE_ROOT, 'compiler', 'include');

export const PROTOC_PATH = process.env.PROTOC_PATH ?? 'protoc';
