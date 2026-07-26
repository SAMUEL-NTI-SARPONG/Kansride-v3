import { Module, Global, OnModuleDestroy } from '@nestjs/common';
import { getDb, closeDb, Database } from '@kansride/db';
import { getEnv } from '@kansride/config';

export const DATABASE_TOKEN = 'DATABASE_CONNECTION';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_TOKEN,
      useFactory: (): Database => {
        return getDb(getEnv().DATABASE_URL);
      },
    },
  ],
  exports: [DATABASE_TOKEN],
})
export class DatabaseModule implements OnModuleDestroy {
  async onModuleDestroy() {
    await closeDb();
  }
}
