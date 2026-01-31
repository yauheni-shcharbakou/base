import { BaseTransformer } from './base.transformer';

export class CommonTransformer extends BaseTransformer {
  transform(): void | Promise<void> {
    this.sourceFile.getVariableDeclaration('protobufPackage')?.remove();
    this.sourceFile.getVariableDeclaration('GOOGLE_PROTOBUF_PACKAGE_NAME')?.remove();
  }
}
