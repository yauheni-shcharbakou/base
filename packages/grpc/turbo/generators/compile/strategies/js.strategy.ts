import { execSync } from 'child_process';
import * as _ from 'lodash';
import { GrpcStrategy } from './base/grpc-strategy';
import { join } from 'path';
import { SourceFile } from 'ts-morph';
import {
  ADAPTER_DIR_ROOT,
  PROTO_SRC_ROOT,
  PROTOC_PATH,
  PROTOC_PLUGIN_PATH,
} from '../helpers/constants';

export class JsStrategy extends GrpcStrategy {
  constructor() {
    super('js', join(ADAPTER_DIR_ROOT, 'js'));
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
      `./${relativePath}`,
    ].join(' ');

    execSync(command, { cwd: PROTO_SRC_ROOT, encoding: 'utf-8' });
  }

  async onSourceFile(sourceFile: SourceFile): Promise<void> {
    sourceFile.getVariableDeclaration('protobufPackage')?.remove();

    _.forEach(['MessageFns', 'Exact', 'DeepPartial'], (name) => {
      const variable = sourceFile.getVariableStatement((stmt) => {
        return stmt.getDeclarations().some((decl) => decl.getName() === name);
      });

      const item = variable ?? sourceFile.getInterface(name) ?? sourceFile.getTypeAlias(name);
      item?.setIsExported(false);
    });
  }
}
