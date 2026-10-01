import nodePackageConfig from '@packages/configs/tsdown/package.config.mjs';

export default [
  // The runtime entry: browser-safe types, imported by the Next admin as well as by Node.
  nodePackageConfig(import.meta.url, { format: ['esm', 'cjs'] }),
  // The build-time API the target packages compile against (`@packages/proto/compiler`). Node
  // only, so cjs only. ts-morph/pug/protobufjs stay external because this package declares them
  // as devDependencies — without that, tsdown inlines them into `dist/compiler.cjs`. Both configs
  // share `dist/`, which tsdown cleans once for the whole array, not per config.
  nodePackageConfig(import.meta.url, { entry: { compiler: 'compiler/index.ts' } }),
];
