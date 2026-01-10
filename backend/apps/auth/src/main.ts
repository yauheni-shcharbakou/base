import { MICROSERVICE_GRPC_OPTIONS } from '@backend/transport';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Config } from 'config';
import { AppModule } from 'app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.connectMicroservice(app.get(MICROSERVICE_GRPC_OPTIONS));
  await app.startAllMicroservices();

  // const configService = context.get(ConfigService<Config>);

  // const microservice = await NestFactory.createMicroservice(
  //   AppModule,
  //   app.get(MICROSERVICE_GRPC_OPTIONS),
  // );
  //
  // await microservice.listen();
  // app.connectMicroservice(app.get(MICROSERVICE_GRPC_OPTIONS));
  //
  // await app.startAllMicroservices(); // start() warn
  // await app.listen(configService.get('port', { infer: true }));
}
bootstrap();
