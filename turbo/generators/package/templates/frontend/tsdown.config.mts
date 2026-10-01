import nodePackageConfig from '@packages/configs/tsdown/package.config.mjs';

export default nodePackageConfig(import.meta.url, { format: ['esm', 'cjs'] });
