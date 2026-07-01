import { GRPC_MICROSERVICE_OPTIONS } from '@backend/grpc';
import { HttpExceptionFilter } from '@common/interface/http/filters/http.exception.filter';
import { RpcExceptionFilter } from '@common/interface/rpc/filters/rpc.exception.filter';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { Config } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  const configService = app.get(ConfigService<Config>);
  const port = configService.get('port', { infer: true });

  app.enableShutdownHooks();

  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.useGlobalFilters(new RpcExceptionFilter(), new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Base')
    .setDescription('Base API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const swaggerDocument: OpenAPIObject = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('/', app, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  app.connectMicroservice(app.get(GRPC_MICROSERVICE_OPTIONS));
  await app.startAllMicroservices();
  await app.listen(port);
}

bootstrap()
  .then()
  .catch(() => {});
