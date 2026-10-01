import nodePackageConfig from '@packages/configs/tsdown/package.config.mjs';

export default nodePackageConfig(import.meta.url, {
  // Named entries, not an array: an array preserves each entry's source directory
  // (`dist/src/index.cjs`, `dist/compiler/index.cjs`) and would move the runtime entry
  // out from under `main`. The keys are the file names the `exports` map points at.
  //
  // The compiler entry is the build-time API the adapter packages compile against; runtime
  // consumers only ever reach `.`, so ts-morph/pug never enter their graph. Both are declared
  // in this package's devDependencies, which is what keeps them external — without that,
  // tsdown inlines them and `dist/compiler.cjs` grows to ~13 MB. The adapter packages carry
  // the same devDependencies, so the externals resolve on their side.
  entry: { index: 'src/index.ts', compiler: 'compiler/index.ts' },
});
