export type ProtoContextService = {
  id: string;
  name: string;
};

export type ProtoContext = {
  services: ProtoContextService[];
  packageId?: string;
  protoPath?: string;
};

export type CompilerContext = 'backend' | 'frontend' | 'all';

export type ExecutionContext = {
  compiler: CompilerContext;
  files: string[];
  entrypointExports: string[];
};

export type OnFilePayload = {
  relativePath: string;
  importName: string;
  hasPrefix: boolean;
};

export type OnFolderPayload = {
  relativePath: string;
  importName: string;
  folderTree: Map<string, any>;
  hasPrefix: boolean;
};
