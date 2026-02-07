import { BaseAdapter } from 'compiler/adapters/base.adapter';
import { PROTO_SRC_ROOT, PROTOC_PATH, PROTOC_PLUGIN_PATH } from 'compiler/constants';
import { OnFilePayload } from 'compiler/types';
import { runCommand } from 'compiler/utils';
import { SourceFile } from 'ts-morph';

export class JsAdapter extends BaseAdapter {
  protected addSideEffects(sourceFile: SourceFile): void | Promise<void> {
    sourceFile.addImportDeclaration({ moduleSpecifier: 'server-only' });
  }

  async onFile(payload: OnFilePayload): Promise<void> {
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
      `./${payload.relativePath}`,
    ].join(' ');

    await runCommand(command, { cwd: PROTO_SRC_ROOT, encoding: 'utf-8' });
    await super.onFile(payload);
  }
}
