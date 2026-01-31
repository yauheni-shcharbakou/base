import { execSync } from 'child_process';
import { ProjectOptions } from 'ts-morph';
import { nestTransformers } from '../transformers';
import { BaseStrategy } from './base.strategy';
import { join } from 'path';
import {
  BACKEND_PACKAGES_DIR_ROOT,
  PROTO_SRC_ROOT,
  PROTOC_PATH,
  PROTOC_PLUGIN_PATH,
} from '../helpers/constants';

export class NestStrategy extends BaseStrategy {
  constructor() {
    super('nest', join(BACKEND_PACKAGES_DIR_ROOT, 'grpc'), nestTransformers);
  }

  getProjectOptions(): ProjectOptions {
    return {
      compilerOptions: {
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      },
    };
  }

  onFile(relativePath: string, importName: string, hasPrefix: boolean): void {
    const command = [
      PROTOC_PATH,
      `--plugin=${PROTOC_PLUGIN_PATH}`,
      `--ts_proto_out=${this.targetRoot}`,
      '--ts_proto_opt=nestJs=true',
      '--ts_proto_opt=useDate=true',
      '--ts_proto_opt=snakeToCamel=false',
      '--ts_proto_opt=unrecognizedEnum=false',
      '--ts_proto_opt=stringEnums=true',
      '--ts_proto_opt=useMapType=true',
      '--ts_proto_opt=addGrpcMetadata=true',
      '--ts_proto_opt=useSnakeTypeName=false',
      '--ts_proto_opt=outputJsonMethods=true',
      `./${relativePath}`,
    ].join(' ');

    execSync(command, { cwd: PROTO_SRC_ROOT, encoding: 'utf-8' });
  }
}
