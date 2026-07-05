import { join } from 'path';

export const REPOSITORY_ROOT = join(__dirname, '..', '..', '..');

export const COMMON_PACKAGES_DIR_ROOT = join(REPOSITORY_ROOT, 'packages');
export const BACKEND_PACKAGES_DIR_ROOT = join(REPOSITORY_ROOT, 'backend', 'packages');
export const FRONTEND_PACKAGES_DIR_ROOT = join(REPOSITORY_ROOT, 'frontend', 'packages');

export const PROTO_EXT_REG_EXP = /.proto$/g;
export const TS_EXT_REG_EXP = /.ts$/g;
export const PUG_EXT_REG_EXP = /.pug$/g;
