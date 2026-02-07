import { BaseAdapter } from 'compiler/adapters/base.adapter';
import { PROTO_SRC_ROOT, PROTOC_PATH, PROTOC_PLUGIN_PATH } from 'compiler/constants';
import { OnFilePayload } from 'compiler/types';
import { runCommand } from 'compiler/utils';

export class BrowserAdapter extends BaseAdapter {
  async onFile(payload: OnFilePayload): Promise<void> {
    const command = [
      PROTOC_PATH,
      `--plugin=${PROTOC_PLUGIN_PATH}`,
      `--ts_proto_out=${this.targetRoot}`,
      '--ts_proto_opt=useDate=true',
      '--ts_proto_opt=snakeToCamel=false',
      '--ts_proto_opt=unrecognizedEnum=false',
      '--ts_proto_opt=stringEnums=true',
      '--ts_proto_opt=useMapType=true',
      '--ts_proto_opt=onlyTypes=true',
      '--ts_proto_opt=outputServices=false',
      '--ts_proto_opt=typePrefix=Grpc',
      `./${payload.relativePath}`,
    ].join(' ');

    await runCommand(command, { cwd: PROTO_SRC_ROOT, encoding: 'utf-8' });
    await super.onFile(payload);
  }
}
