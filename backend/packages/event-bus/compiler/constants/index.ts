import { join } from 'path';

export const PUG_EXT_REG_EXP = /.pug$/g;

export const COMPILER_ROOT = join(__dirname, '..');
export const PACKAGE_SRC_ROOT = join(__dirname, '..', '..', 'src');

export const STRATEGY_ROOT = join(PACKAGE_SRC_ROOT, 'strategy');
export const STRATEGY_FILE_PATH = join(STRATEGY_ROOT, 'index.ts');
export const EVENT_BUS_OUTPUT_PATH = join(PACKAGE_SRC_ROOT, 'generated', 'index.ts');
export const EVENT_BUS_IMPORT_SPECIFIER = '@backend/event-bus';
