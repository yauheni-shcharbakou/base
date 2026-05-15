import { BaseAdapter } from '@compiler/adapters/base.adapter';
import { pascalCase, kebabCase, constantCase } from 'change-case-all';

export class NatsAdapter extends BaseAdapter {
  private declareImports() {
    this.importService.addOrUpdate('@nestjs/common', [
      'applyDecorators',
      'Controller',
      'Type',
      'UseInterceptors',
    ]);

    this.importService.addOrUpdate('@nestjs/microservices', ['EventPattern']);

    this.importService.addOrUpdate('@nestjs-plugins/nestjs-nats-jetstream-transport', [
      'NatsJetStreamContext',
      'NatsJetStreamClientProxy',
    ]);

    this.importService.addOrUpdate('rxjs', ['Observable']);

    this.importService.addOrUpdate('@/infrastructure/utils', ['globalStreamRegistry']);
    this.importService.addOrUpdate('@/interface/interceptors', ['NatsControllerInterceptor']);

    this.importService.addOrUpdate(
      this.contextService.getEventBusImportSpecifier(),
      this.services.map((service) => service.eventBusName).concat(['EventBusService']),
    );
  }

  protected compile(): void | Promise<void> {
    this.declareImports();

    this.services.forEach((service) => {
      this.outputFile.addStatements(
        this.templateService.render('nats.controller', {
          data: { service },
          pascalCase,
          kebabCase,
          constantCase,
        }),
      );
    });

    this.outputFile.addStatements(
      this.templateService.render('nats.client', {
        data: { services: this.services },
        pascalCase,
        kebabCase,
      }),
    );
  }
}
