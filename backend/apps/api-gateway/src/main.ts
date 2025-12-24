import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from 'common/filters/http-exception.filter';
import { RpcExceptionFilter } from 'common/filters/rpc-exception.filter';
import { AppModule } from 'app.module';
import { HttpRequestInterceptor } from 'common/interceptors/http-request.interceptor';
import { Config } from 'config';
import cookieParser from 'cookie-parser';
import cors from 'cors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  const configService = app.get(ConfigService<Config>);
  const port = configService.get('port', { infer: true });
  const logger = new Logger();

  app.use(cookieParser());

  app.enableCors({
    origin: 'http://localhost:3336', // фронтенд
    credentials: true, // разрешаем cookie
  });

  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.useGlobalFilters(new RpcExceptionFilter(), new HttpExceptionFilter());
  app.useGlobalInterceptors(new HttpRequestInterceptor());

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

  await app.listen(port, () => logger.log(`ApiGateway running on http://localhost:${port}`));
}
bootstrap();
