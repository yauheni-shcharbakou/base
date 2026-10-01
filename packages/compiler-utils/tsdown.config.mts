import nodePackageConfig from '@packages/configs/tsdown/package.config.mjs';

// `ts-morph` and `pug` are peer-ish here — declared as devDependencies rather than dependencies
// because the consuming package supplies them — but the factory reads devDependencies too, so
// they stay external without a hand-written addition.
export default nodePackageConfig(import.meta.url, { format: ['esm', 'cjs'] });
