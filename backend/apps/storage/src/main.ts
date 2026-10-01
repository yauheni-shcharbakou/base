import { resolveErrorMessage } from '@backend/common';
import { GRPC_MICROSERVICE_OPTIONS } from '@backend/grpc';
import { REDIS_MICROSERVICE_OPTIONS } from '@backend/event-bus-redis';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Config } from './config';

async function bootstrap() {
  // `rawBody` is what lets the Bunny Stream webhook guard verify the HMAC over the exact bytes
  // Bunny signed; a parsed-and-reserialized body would never match.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const configService = app.get(ConfigService<Config>);
  const port = configService.get('port', { infer: true });

  app.enableShutdownHooks();

  app.connectMicroservice(app.get(GRPC_MICROSERVICE_OPTIONS), { inheritAppConfig: true });
  app.connectMicroservice(app.get(REDIS_MICROSERVICE_OPTIONS), { inheritAppConfig: true });

  await app.startAllMicroservices();
  // The HTTP surface is the provider webhook alone — everything a client calls stays on gRPC.
  await app.listen(port);
}

// See `backend/apps/auth/src/main.ts`: an empty catch turns a failed bootstrap into a silent
// exit with code 0.
bootstrap().catch((error: unknown) => {
  new Logger('Bootstrap').error(
    resolveErrorMessage(error, 'Failed to start the application'),
    error instanceof Error ? error.stack : undefined,
  );

  process.exit(1);
});
