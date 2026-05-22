import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000;

  // Security headers
  app.use(helmet());

  // Gzip compression
  app.use(compression());

  // Global validation pipe
  // This automatically validates every incoming request body
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,        // strips fields not in DTO
      forbidNonWhitelisted: true, // throws error if extra fields sent
      transform: true,        // auto-converts types (string "1" → number 1)
    }),
  );

  // CORS — allow frontend to call API
  app.enableCors({
    origin: ['http://localhost:3001'],
    credentials: true,
  });

  // Swagger API docs
  const config = new DocumentBuilder()
    .setTitle('MyApp API')
    .setDescription('Production-ready REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port);

  console.log(`\n🚀 Server running on: http://localhost:${port}`);
  console.log(`📖 Swagger docs at:   http://localhost:${port}/api/docs\n`);
}

bootstrap();
