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

  // CORS: a wildcard origin alongside credentials:true is rejected by
  // browsers, so the previous `{ origin: '*', credentials: true }` was an
  // invalid combination for credentialed cross-origin web clients. Drive the
  // configuration from WEB_CORS_ORIGINS: when set, accept only those origins
  // with credentials; when unset (the V1 default), accept any origin without
  // credentials. This keeps local development frictionless (any origin) while
  // making a production web deployment correctly restrictive.
  const allowedOriginsRaw = env.WEB_CORS_ORIGINS.trim();
  if (allowedOriginsRaw.length > 0) {
    const allowedOrigins = allowedOriginsRaw
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    app.enableCors({ origin: allowedOrigins, credentials: true });
  } else {
    app.enableCors({ origin: '*', credentials: false });
  }

  app.useWebSocketAdapter(new IoAdapter(app));

  const port = env.APP_PORT;
  await app.listen(port, '0.0.0.0');
  logger.log(`KansRide API running on port ${port}`);
}
bootstrap();
