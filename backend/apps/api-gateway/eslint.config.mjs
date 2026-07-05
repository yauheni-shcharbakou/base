import layerGuard from '@packages/configs/eslint/layer-guard.mjs';
import nestConfig from '@packages/configs/eslint/nest.config.mjs';

export default [...nestConfig(import.meta.url), ...layerGuard()];
