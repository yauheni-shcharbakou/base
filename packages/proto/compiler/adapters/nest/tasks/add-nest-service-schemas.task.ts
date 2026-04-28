import { constantCase, pascalCase } from 'change-case-all';
import { TransformTask } from 'compiler/tasks';
import { ProtoContextService } from 'compiler/types';

export class AddNestServiceSchemasTask extends TransformTask {
  private packageName: string | undefined;

  private declareImports() {
    this.addOrUpdateImport('@grpc/grpc-js', [{ name: 'Metadata', isTypeOnly: true }]);
  }

  private declareSchemas(services: ProtoContextService[]) {
    services.forEach((service) => {
      const controllerName = pascalCase(`grpc.${service.name}.controller`);
      const clientName = pascalCase(`grpc.${service.name}.client`);
      const serviceConstName = constantCase(`${service.name}.name`);

      const controllerInterface = this.sourceFile.getInterface(controllerName);
      const clientInterface = this.sourceFile.getInterface(clientName);

      const serviceNameValue = this.sourceFile
        .getVariableDeclaration(serviceConstName)
        ?.getInitializer()
        ?.getText();

      if (!controllerInterface || !clientInterface || !serviceNameValue) {
        return;
      }

      this.addEntryExports(
        { name: controllerName, isTypeOnly: true },
        { name: clientName, isTypeOnly: true },
        pascalCase(`grpc.${service.id}.transport`),
      );

      controllerInterface.getMethods().forEach((method) => {
        const structure = method.getStructure();
        const firstArg = method.getParameter('request');

        if (!firstArg) {
          return;
        }

        structure.parameters = [
          firstArg.getStructure(),
          { name: 'args', isRestParameter: true, type: 'any[]' },
        ];

        method.set(structure);
      });
    });

    const schemaDeclaration = this.renderTemplate('nest.service-schema', {
      data: {
        services,
        package: this.packageName,
        protoPath: this.protoContext.protoPath,
      },
      pascalCase,
    });

    this.sourceFile.addStatements(schemaDeclaration);
  }

  protected onInit() {
    this.packageName = this.getPackageNameValue();
  }

  canTransform(): boolean | Promise<boolean> {
    return !!(this.protoContext.services.length && this.protoContext.packageId);
  }

  transform(): void | Promise<void> {
    if (!this.packageName) {
      return;
    }

    this.declareImports();
    this.declareSchemas(this.protoContext.services);
  }
}
