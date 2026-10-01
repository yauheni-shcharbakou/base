import { EventBusAdapter } from '@backend/event-bus/compiler';
import { pascalCase } from 'change-case-all';

export class RedisAdapter extends EventBusAdapter {
  private declareImports() {
    this.importService.addOrUpdate('@nestjs/common', ['Abstract', 'applyDecorators', 'Type']);
    this.importService.addOrUpdate('@nestjs/microservices', ['EventPattern']);
    this.importService.addOrUpdate('rxjs', ['Observable']);
    this.importService.addOrUpdate('@/infrastructure/clients', ['RedisQueueClient']);
    this.importService.addOrUpdate('@/interface/contexts', ['RedisJobContext']);

    this.importService.addOrUpdate(
      this.context.getEventBusImportSpecifier(),
      this.services.map((service) => service.eventBusName).concat(['EventBus']),
    );
  }

  protected compile(): void | Promise<void> {
    this.declareImports();

    this.services.forEach((service) => {
      this.outputFile.addStatements(
        // `method.eventId` is already dot-cased (`auth.user.create`) and is used verbatim
        // as the BullMQ queue name — unlike NATS, nothing is kebab-cased here.
        this.templateService.render('redis.controller', {
          data: { service },
        }),
      );
    });

    this.outputFile.addStatements(
      this.templateService.render('redis.client', {
        data: { services: this.services },
        pascalCase,
      }),
    );

    this.outputFile.addStatements(
      this.templateService.render('redis.registry', {
        data: { hosts: this.getHosts() },
      }),
    );
  }

  /** Events grouped by their owning host — the mediator only fans out its own host's events. */
  private getHosts(): { name: string; eventIds: string[] }[] {
    const eventIdsByHost = this.services.reduce(
      (acc: Record<string, string[]>, service): Record<string, string[]> => {
        const eventIds = acc[service.hostName] ?? [];
        eventIds.push(...service.methods.map((method) => method.eventId));
        acc[service.hostName] = eventIds;

        return acc;
      },
      {},
    );

    return Object.entries(eventIdsByHost).map(([name, eventIds]) => ({ name, eventIds }));
  }
}
