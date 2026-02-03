import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Global, ValidationPipe, Logger } from '@nestjs/common';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  app.setGlobalPrefix(app.get(ConfigService).get<string>('PREFIX_API') || '/api/v1');

  const config = new DocumentBuilder()
    .setTitle('API Documentation')
    .setDescription('The API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api-docs', app, document,{
      swaggerOptions: { persistAuthorization: true, },
    });

  app.enableCors({
    origin: app.get(ConfigService).get<string>('FRONTEND_URL') || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  const port = app.get(ConfigService).get<number>('PORT') || 3000;
  await app.listen(port);
  Logger.log(`🚀 Application is running on: http://localhost:${port}`, 'Bootstrap');
  Logger.log(`📚 API Documentation: http://localhost:${port}/api-docs`, 'Bootstrap');
}
bootstrap();
