import { BaseTransformer } from './base.transformer';

export class CommonTransformer extends BaseTransformer {
  transform(): void | Promise<void> {
    this.sourceFile.getVariableDeclaration('protobufPackage')?.remove();
  }
}
