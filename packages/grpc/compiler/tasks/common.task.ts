import { TransformTask } from 'compiler/tasks/transform.task';

export class CommonTask extends TransformTask {
  transform(): void | Promise<void> {
    this.sourceFile.getVariableDeclaration('protobufPackage')?.remove();
    this.sourceFile.getVariableDeclaration('GOOGLE_PROTOBUF_PACKAGE_NAME')?.remove();
  }
}
