import { BACKEND_PACKAGES_DIR_ROOT } from '@packages/compiler-utils';
import { join } from 'path';

export const PUG_EXT_REG_EXP = /.pug$/g;

// Anchored on the repository layout rather than on `__dirname`: this module is bundled into
// `dist/compiler.cjs` and consumed by the adapter packages, so a path relative to the emitting
// file would resolve against `dist/` there instead of `compiler/`.
export const PACKAGE_ROOT = join(BACKEND_PACKAGES_DIR_ROOT, 'event-bus');
export const COMPILER_ROOT = join(PACKAGE_ROOT, 'compiler');
export const PACKAGE_SRC_ROOT = join(PACKAGE_ROOT, 'src');

export const STRATEGY_ROOT = join(PACKAGE_SRC_ROOT, 'strategy');
export const STRATEGY_FILE_PATH = join(STRATEGY_ROOT, 'index.ts');
export const EVENT_BUS_OUTPUT_PATH = join(PACKAGE_SRC_ROOT, 'generated', 'index.ts');
export const EVENT_BUS_IMPORT_SPECIFIER = '@backend/event-bus';
