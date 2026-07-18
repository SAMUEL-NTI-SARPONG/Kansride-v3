import { Module, Global, OnModuleDestroy } from '@nestjs/common';
import { getDb, closeDb, Database } from '@kansride/db';

export const DATABASE_TOKEN = 'DATABASE_CONNECTION';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_TOKEN,
      useFactory: (): Database => {
        const url = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/kansride';
        return getDb(url);
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
