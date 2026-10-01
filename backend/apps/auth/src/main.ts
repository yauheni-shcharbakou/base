import { resolveErrorMessage } from '@backend/common';
import { GRPC_MICROSERVICE_OPTIONS } from '@backend/grpc';
import { REDIS_MICROSERVICE_OPTIONS } from '@backend/event-bus-redis';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  app.connectMicroservice(app.get(GRPC_MICROSERVICE_OPTIONS), { inheritAppConfig: true });
  app.connectMicroservice(app.get(REDIS_MICROSERVICE_OPTIONS), { inheritAppConfig: true });

  await app.startAllMicroservices();
  await app.init();
}

// Never an empty catch: a bootstrap that rejects has already run past `app.init()`, so nothing
// holds the event loop and the process would leave with code 0 and no explanation — the failure
// mode that hides a dead broker or a bad config behind "the service just isn't there".
bootstrap().catch((error: unknown) => {
  new Logger('Bootstrap').error(
    resolveErrorMessage(error, 'Failed to start the application'),
    error instanceof Error ? error.stack : undefined,
  );

  process.exit(1);
});
