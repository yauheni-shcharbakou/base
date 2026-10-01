import type { UserConfig } from 'tsdown';

declare function nodePackageConfig(url: string, overrides?: UserConfig): UserConfig;

export default nodePackageConfig;
