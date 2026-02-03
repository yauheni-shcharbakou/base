import { execSync } from 'child_process';
import { ContextData } from '../context';
import { SourceFile } from 'ts-morph';
import { jsTransformers } from '../transformers';
import { BaseStrategy } from './base.strategy';
import { join } from 'path';
import {
  FRONTEND_PACKAGES_DIR_ROOT,
  PROTO_SRC_ROOT,
  PROTOC_PATH,
  PROTOC_PLUGIN_PATH,
} from '../helpers/constants';

export class JsStrategy extends BaseStrategy {
  constructor() {
    super('js', join(FRONTEND_PACKAGES_DIR_ROOT, 'grpc'), jsTransformers, ['backend']);
  }

  onFile(relativePath: string, importName: string, hasPrefix: boolean): void {
    const command = [
      PROTOC_PATH,
      `--plugin=${PROTOC_PLUGIN_PATH}`,
      `--ts_proto_out=${this.targetRoot}`,
      '--ts_proto_opt=useDate=true',
      '--ts_proto_opt=snakeToCamel=false',
      '--ts_proto_opt=useMapType=true',
      '--ts_proto_opt=unrecognizedEnum=false',
      '--ts_proto_opt=stringEnums=true',
      '--ts_proto_opt=useMapType=true',
      '--ts_proto_opt=addGrpcMetadata=true',
      '--ts_proto_opt=outputServices=grpc-js',
      '--ts_proto_opt=typePrefix=Grpc',
      `./${relativePath}`,
    ].join(' ');

    execSync(command, { cwd: PROTO_SRC_ROOT, encoding: 'utf-8' });
  }

  async onSourceFile(
    sourceFile: SourceFile,
    contextData: ContextData,
    filePath: string,
  ): Promise<void> {
    await super.onSourceFile(sourceFile, contextData, filePath);
    sourceFile.addImportDeclaration({ moduleSpecifier: 'server-only' });
  }
}
