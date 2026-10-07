import { Global, Inject, Injectable, Module, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { and, eq } from 'drizzle-orm';
import { Database, users } from '@kansride/db';
import type { TokenPayload } from '@kansride/auth';
import { DATABASE_TOKEN } from '../../database';

// PostgreSQL is authoritative: losing Redis state or restarting the backend must
// never reactivate a replaced session. Events only accelerate socket sign-out.
@Injectable()
export class SessionService extends EventEmitter {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: Database) { super(); }

  async start(user: typeof users.$inferSelect): Promise<string> {
    const sessionId = randomUUID();
    const conditions = [eq(users.id, user.id), eq(users.status, 'active'), eq(users.role, user.role)];
    if (user.role !== 'passenger') conditions.push(eq(users.isVerified, true));
    if (user.pinHash) conditions.push(eq(users.pinHash, user.pinHash));
    const [updated] = await this.db.update(users).set({ activeSessionId: sessionId })
      .where(and(...conditions)).returning({ id: users.id });
    if (!updated) throw new UnauthorizedException('Account changed. Please sign in again.');
    this.emit('replaced', user.id, sessionId);
    return sessionId;
  }

  async assertActive(payload: Pick<TokenPayload, 'userId' | 'role' | 'sessionId'>) {
    if (!payload.sessionId) throw new UnauthorizedException('Please sign in again.');
    let user: typeof users.$inferSelect | undefined;
    try {
      [user] = await this.db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
    } catch {
      throw new ServiceUnavailableException('Session check temporarily unavailable. Please retry.');
    }
    if (!user || user.status !== 'active' || user.activeSessionId !== payload.sessionId || user.role !== payload.role || (user.role !== 'passenger' && !user.isVerified)) {
      throw new UnauthorizedException('Session ended. Please sign in again.');
    }
    return user;
  }

  async end(payload: TokenPayload) {
    const [ended] = await this.db.update(users).set({ activeSessionId: null })
      .where(and(eq(users.id, payload.userId), eq(users.activeSessionId, payload.sessionId!)))
      .returning({ id: users.id });
    if (ended) this.emit('replaced', payload.userId, null);
  }
}

@Global()
@Module({ providers: [SessionService], exports: [SessionService] })
export class SessionModule {}
