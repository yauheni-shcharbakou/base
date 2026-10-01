import { EventBusAdapter } from '@backend/event-bus/compiler';
import { kebabCase, pascalCase } from 'change-case-all';

export class NatsAdapter extends EventBusAdapter {
  private declareImports() {
    this.importService.addOrUpdate('@nestjs/common', ['Abstract', 'applyDecorators', 'Type']);
    this.importService.addOrUpdate('@nestjs/microservices', ['EventPattern']);
    this.importService.addOrUpdate('rxjs', ['Observable']);
    this.importService.addOrUpdate('@/infrastructure/clients', ['NatsJetStreamClient']);
    this.importService.addOrUpdate('@/infrastructure/types', ['NatsStreamData']);
    this.importService.addOrUpdate('@/infrastructure/utils', ['globalStreamRegistry']);
    this.importService.addOrUpdate('@/interface/contexts', ['NatsMessageContext']);

    this.importService.addOrUpdate(
      this.context.getEventBusImportSpecifier(),
      this.services.map((service) => service.eventBusName).concat(['EventBus']),
    );
  }

  protected compile(): void | Promise<void> {
    this.declareImports();

    this.services.forEach((service) => {
      this.outputFile.addStatements(
        // `method.eventId` is dot-cased (`auth.user.create`); NATS subjects are the kebab-cased
        // form (`auth-user-create`) — unlike Redis, which uses the dot-cased id verbatim.
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

    this.outputFile.addStatements(
      this.templateService.render('nats.registry', {
        data: { hosts: this.getHosts() },
      }),
    );
  }

  /** Streams grouped by their owning host — `forRoot` declares its own host's streams. */
  private getHosts(): { name: string; streams: { name: string; subjects: string[] }[] }[] {
    const streamsByHost = this.services.reduce(
      (acc: Record<string, { name: string; subjects: string[] }[]>, service) => {
        const streams = acc[service.hostName] ?? [];

        streams.push({
          name: `${kebabCase(`${service.hostName}_${service.id}`)}-stream`,
          subjects: service.methods.map((method) => kebabCase(method.eventId)),
        });

        acc[service.hostName] = streams;

        return acc;
      },
      {},
    );

    return Object.entries(streamsByHost).map(([name, streams]) => ({ name, streams }));
  }
}
