import { execSync } from 'child_process';
import { jsTransformers } from '../transformers';
import { BaseStrategy } from './base.strategy';
import { join } from 'path';
import {
  FRONTEND_PACKAGES_DIR_ROOT,
  GRPC_PACKAGE_ROOT,
  PROTO_SRC_ROOT,
  PROTOC_PATH,
  PROTOC_PLUGIN_PATH,
} from '../helpers/constants';

export class TypesStrategy extends BaseStrategy {
  constructor() {
    super('types', GRPC_PACKAGE_ROOT, jsTransformers);
  }

  onFile(relativePath: string, importName: string, hasPrefix: boolean): void {
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
      `./${relativePath}`,
    ].join(' ');

    execSync(command, { cwd: PROTO_SRC_ROOT, encoding: 'utf-8' });
  }
}
