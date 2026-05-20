import { BaseAdapter } from '@compiler/adapters/base.adapter';
import { kebabCase, pascalCase } from 'change-case-all';

export class NatsAdapter extends BaseAdapter {
  private declareImports() {
    this.importService.addOrUpdate('@nestjs/common', ['Abstract', 'applyDecorators', 'Type']);
    this.importService.addOrUpdate('@nestjs/microservices', ['EventPattern']);

    this.importService.addOrUpdate('@nestjs-plugins/nestjs-nats-jetstream-transport', [
      'NatsJetStreamContext',
      'NatsJetStreamClientProxy',
    ]);

    this.importService.addOrUpdate('rxjs', [
      'concat',
      'firstValueFrom',
      'lastValueFrom',
      'Observable',
      'toArray',
    ]);

    this.importService.addOrUpdate('@/infrastructure/utils', ['globalStreamRegistry']);

    this.importService.addOrUpdate(
      this.contextService.getEventBusImportSpecifier(),
      this.services.map((service) => service.eventBusName).concat(['EventBus']),
    );
  }

  protected compile(): void | Promise<void> {
    this.declareImports();

    this.services.forEach((service) => {
      this.outputFile.addStatements(
        this.templateService.render('nats.controller', {
          data: { service },
          kebabCase,
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
