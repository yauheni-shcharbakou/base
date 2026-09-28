import { BaseAdapter } from '@compiler/adapters/base.adapter';
import {
  PROTO_INCLUDE_ROOT,
  PROTO_SRC_ROOT,
  PROTOC_PATH,
  PROTOC_PLUGIN_PATH,
} from '@compiler/constants';
import { OnFilePayload } from '@compiler/types';
import { runCommand } from '@compiler/utils';
import { SourceFile } from 'ts-morph';

export class ClientAdapter extends BaseAdapter {
  protected addSideEffects(sourceFile: SourceFile): void | Promise<void> {
    sourceFile.insertText(0, '// @ts-nocheck\n');
  }

  async onFile(payload: OnFilePayload): Promise<void> {
    const command = [
      PROTOC_PATH,
      `--plugin=${PROTOC_PLUGIN_PATH}`,
      '--proto_path=.',
      `--proto_path=${PROTO_INCLUDE_ROOT}`,
      `--ts_proto_out=${this.targetRoot}`,
      // No tool versions in the header, so any protoc regenerates the same files.
      '--ts_proto_opt=annotateFilesWithVersion=false',
      '--ts_proto_opt=useDate=true',
      '--ts_proto_opt=snakeToCamel=false',
      '--ts_proto_opt=useMapType=true',
      '--ts_proto_opt=unrecognizedEnum=false',
      '--ts_proto_opt=stringEnums=true',
      '--ts_proto_opt=useMapType=true',
      '--ts_proto_opt=addGrpcMetadata=true',
      '--ts_proto_opt=outputServices=grpc-js',
      `./${payload.relativePath}`,
    ].join(' ');

    await runCommand(command, { cwd: PROTO_SRC_ROOT, encoding: 'utf-8' });
    await super.onFile(payload);
  }
}
