// Build-time API consumed by the target packages (@backend/proto, @frontend/proto), each of which
// generates its own flavor in its own turbo task. Reached as `@packages/proto/compiler`; nothing
// here is part of the runtime entrypoint, which ships browser-safe types only.
//
// The Browser adapter stays internal: it is driven only by this package's own `main.ts`.
export type { AdapterFactory, AdapterParams } from './adapters/base.adapter';
export { BaseAdapter } from './adapters/base.adapter';
export { compileProto } from './compile-proto';
export { PROTO_INCLUDE_ROOT, PROTO_SRC_ROOT, PROTOC_PATH } from './constants';
export { ContextService } from './services';
export type { TransformTaskClass } from './tasks';
export { CommonTask, RemoveOptionalityTask, TransformTask } from './tasks';
export type { OnFilePayload, OnFolderPayload, ProtoContext, ProtoContextService } from './types';
export type { ProtocParams } from './utils';
export { getProtocPluginPath, runProtoc } from './utils';
