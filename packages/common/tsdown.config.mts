import { defineConfig } from 'tsdown';
import pkg from '../../package.json' with { type: 'json' };

export default defineConfig({
  entry: 'src/index.ts',
  format: ['esm', 'cjs'],
  dts: true,
  deps: {
    neverBundle: Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }),
  },
});
