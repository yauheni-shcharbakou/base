import { MICROSERVICE_GRPC_OPTIONS } from '@backend/transport';
import { NestFactory } from '@nestjs/core';
import { AppModule } from 'app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  app.connectMicroservice(app.get(MICROSERVICE_GRPC_OPTIONS));
  await app.startAllMicroservices();
  await app.init();
}
bootstrap();
