import { SyntaxKind, TypedNode } from 'ts-morph';
import { BaseTransformer } from './base.transformer';

export class RemoveOptionalityTransformer extends BaseTransformer {
  transform(): void | Promise<void> {
    this.sourceFile.forEachDescendant((node) => {
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
