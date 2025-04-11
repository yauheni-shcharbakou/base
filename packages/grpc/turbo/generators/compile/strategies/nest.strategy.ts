import { execSync } from 'child_process';
import { GrpcStrategy } from './base/grpc-strategy';
import { join } from 'path';
import { SourceFile, SyntaxKind, TypedNode } from 'ts-morph';
import {
  ADAPTER_DIR_ROOT,
  PROTO_SRC_ROOT,
  PROTOC_PATH,
  PROTOC_PLUGIN_PATH,
} from '../helpers/constants';

export class NestStrategy extends GrpcStrategy {
  constructor() {
    super('nest', join(ADAPTER_DIR_ROOT, 'nest'));
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
      `./${relativePath}`,
    ].join(' ');

    execSync(command, { cwd: PROTO_SRC_ROOT, encoding: 'utf-8' });
  }

  async onSourceFile(sourceFile: SourceFile): Promise<void> {
    sourceFile.getVariableDeclaration('protobufPackage')?.remove();

    sourceFile.forEachDescendant((node) => {
      if (
        node.getKind() === SyntaxKind.PropertySignature ||
        node.getKind() === SyntaxKind.PropertyDeclaration
      ) {
        const type = (node as unknown as TypedNode).getTypeNode();

        if (type && type.getKind() === SyntaxKind.UnionType) {
          const extType = type.getType();
          const updatedType = extType.getNonNullableType();
          node['setType'](updatedType.getText());
        }
      }
    });
  }
}
