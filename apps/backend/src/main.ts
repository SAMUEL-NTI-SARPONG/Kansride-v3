import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { getEnv } from '@kansride/config';

async function bootstrap() {
  const env = getEnv();
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: '*', credentials: true });
  app.useWebSocketAdapter(new IoAdapter(app));

  const port = env.APP_PORT;
  await app.listen(port);
  logger.log(`KansRide API running on port ${port}`);
}
bootstrap();
