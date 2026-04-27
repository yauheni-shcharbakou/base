import { TransformTask } from 'compiler/tasks/transform.task';
import { SyntaxKind, TypedNode } from 'ts-morph';

export class CommonTask extends TransformTask {
  transform(): void | Promise<void> {
    this.sourceFile.getVariableDeclaration('protobufPackage')?.remove();
    this.sourceFile.getVariableDeclaration('GOOGLE_PROTOBUF_PACKAGE_NAME')?.remove();

    this.sourceFile.forEachDescendant((node) => {
      if (
        node.getKind() === SyntaxKind.PropertySignature ||
        node.getKind() === SyntaxKind.PropertyDeclaration
      ) {
        const typedNode = node as unknown as TypedNode;
        const typeNode = typedNode.getTypeNode();

        if (typeNode) {
          const extType = typeNode.getType();
          const updatedType = extType.getNonNullableType();
          typedNode.setType(updatedType.getText(this.sourceFile));
        }
      }
    });
  }
}
