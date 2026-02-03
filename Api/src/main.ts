import {NestFactory} from '@nestjs/core';
import {AppModule} from './app.module';
import {ConfigService} from '@nestjs/config';
import {ValidationPipe} from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';


async function bootstrap() {

  const app = await NestFactory.create(AppModule);
  
  app.setGlobalPrefix(app.get(ConfigService).get<string>('PREFIX_API') || '/api/v1');

  app.enableCors({
    origin: app.get(ConfigService).get<string>('FRONTEND_URL') || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes( new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(app.get(ConfigService).get<number>('PORT') || 3000);
}
bootstrap();