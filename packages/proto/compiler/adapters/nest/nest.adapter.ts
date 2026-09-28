import { BaseAdapter } from '@compiler/adapters/base.adapter';
import {
  PROTO_INCLUDE_ROOT,
  PROTO_SRC_ROOT,
  PROTOC_PATH,
  PROTOC_PLUGIN_PATH,
} from '@compiler/constants';
import { OnFilePayload } from '@compiler/types';
import { runCommand } from '@compiler/utils';
import { Project } from 'ts-morph';

export class NestAdapter extends BaseAdapter {
  protected getProject(): Project {
    return new Project({
      compilerOptions: {
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      },
    });
  }

  async onFile(payload: OnFilePayload): Promise<void> {
    const command = [
      PROTOC_PATH,
      `--plugin=${PROTOC_PLUGIN_PATH}`,
      '--proto_path=.',
      `--proto_path=${PROTO_INCLUDE_ROOT}`,
      `--ts_proto_out=${this.targetRoot}`,
      '--ts_proto_opt=nestJs=true',
      // No tool versions in the header, so any protoc regenerates the same files.
      '--ts_proto_opt=annotateFilesWithVersion=false',
      '--ts_proto_opt=useDate=true',
      '--ts_proto_opt=snakeToCamel=false',
      '--ts_proto_opt=unrecognizedEnum=false',
      '--ts_proto_opt=stringEnums=true',
      '--ts_proto_opt=useMapType=false',
      '--ts_proto_opt=addGrpcMetadata=true',
      '--ts_proto_opt=useSnakeTypeName=false',
      `./${payload.relativePath}`,
    ].join(' ');

    await runCommand(command, { cwd: PROTO_SRC_ROOT, encoding: 'utf-8' });
    await super.onFile(payload);
  }
}
