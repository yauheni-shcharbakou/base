import type { ViteUserConfig } from 'vitest/config';

declare function nestVitestConfig(url: string, test?: ViteUserConfig['test']): ViteUserConfig;

export default nestVitestConfig;
