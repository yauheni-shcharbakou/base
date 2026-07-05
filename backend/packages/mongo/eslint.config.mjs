import nestConfig from '@packages/configs/eslint/nest.config.mjs';
import layerGuard from '@packages/configs/eslint/layer-guard.mjs';

export default [...nestConfig(import.meta.url), ...layerGuard()];
