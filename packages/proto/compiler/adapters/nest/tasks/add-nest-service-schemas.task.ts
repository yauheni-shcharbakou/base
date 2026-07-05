import { constantCase, pascalCase } from 'change-case-all';
import { TransformTask } from '@compiler/tasks';
import { ProtoContextService } from '@compiler/types';

export class AddNestServiceSchemasTask extends TransformTask {
  private declareImports() {
    this.importService.addOrUpdate('@grpc/grpc-js', [{ name: 'Metadata', isTypeOnly: true }]);
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

    const schemaDeclaration = this.templateService.render('nest.service-schema', {
      data: {
        services,
        package: this.getPackageNameValue(),
        protoPath: this.protoContext.protoPath,
      },
      pascalCase,
    });

    this.sourceFile.addStatements(schemaDeclaration);
  }

  canTransform(): boolean | Promise<boolean> {
    const packageValue = this.getPackageNameValue();
    return !!(packageValue && this.protoContext.services.length);
  }

  transform(): void | Promise<void> {
    this.declareImports();
    this.declareSchemas(this.protoContext.services);
  }
}
