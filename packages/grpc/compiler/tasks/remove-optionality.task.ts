import { TransformTask } from 'compiler/tasks/transform.task';
import { SyntaxKind, TypedNode } from 'ts-morph';

export class RemoveOptionalityTask extends TransformTask {
  transform(): void | Promise<void> {
    this.sourceFile.forEachDescendant((node) => {
      if (
        node.getKind() === SyntaxKind.PropertySignature ||
        node.getKind() === SyntaxKind.PropertyDeclaration
      ) {
        const typedNode = node as unknown as TypedNode;
        const type = typedNode.getTypeNode();

        if (type && type.getKind() === SyntaxKind.UnionType) {
          const extType = type.getType();
          const updatedType = extType.getNonNullableType();
          typedNode.setType(updatedType.getText());
        }
      }
    });
  }
}
