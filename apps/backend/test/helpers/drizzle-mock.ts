import { expect } from 'vitest';

/**
 * Thenable, chainable Drizzle-like query builder used to unit-test
 * Drizzle-backed services without a live PostgreSQL. Every method returns the
 * chain itself; awaiting the chain (via `.then`, `await chain`, or by calling
 * a normally-terminal method that resolves to a Promise) yields the configured
 * result. This mirrors Drizzle's thenable-builder shape closely enough to drive
 * the call paths exercised by Phase 0B unit tests without asserting SQL
 * predicates. SQL-correctness is exercised by integration tests against a real
 * Postgres; the mock only verifies the *sequence* of operations and branch
 * outcomes (winner/loser, owner lookup, role gating, validation order).
 */
export class Chain<T = unknown> implements PromiseLike<T> {
  constructor(private readonly resolver: () => T) {}

  select(..._: unknown[]): this { return this; }
  from(..._: unknown[]): this { return this; }
  where(..._: unknown[]): this { return this; }
  set(..._: unknown[]): this { return this; }
  values(..._: unknown[]): this { return this; }
  orderBy(..._: unknown[]): this { return this; }
  offset(..._: unknown[]): this { return this; }
  limit(..._: unknown[]): this { return this; }
  innerJoin(..._: unknown[]): this { return this; }
  leftJoin(..._: unknown[]): this { return this; }
  groupBy(..._: unknown[]): this { return this; }
  onConflictDoNothing(..._: unknown[]): this { return this; }
  onConflictDoUpdate(..._: unknown[]): this { return this; }
  returning(..._: unknown[]): this { return this; }
  execute(..._: unknown[]): this { return this; }
  count(..._: unknown[]): this { return this; }
  returningAll(..._: unknown[]): this { return this; }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null | undefined,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null | undefined,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.resolver()).then(onfulfilled, onrejected);
  }

  catch<TResult2 = never>(
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null | undefined,
  ): PromiseLike<T | TResult2> {
    return Promise.resolve(this.resolver()).catch(onrejected);
  }
}

export interface DbStub {
  select(..._: unknown[]): Chain;
  insert(..._: unknown[]): Chain;
  update(..._: unknown[]): Chain;
  delete(..._: unknown[]): Chain;
  transaction: <R>(fn: (tx: TxStub) => Promise<R>) => Promise<R>;
}

export interface TxStub {
  select(..._: unknown[]): Chain;
  insert(..._: unknown[]): Chain;
  update(..._: unknown[]): Chain;
}

interface QueuedResolver {
  resolve: () => unknown;
  consumed: boolean;
}

/**
 * Builds a Drizzle-like db stub whose responses are queued by the test author.
 * Each call to `select` / `insert` / `update` (and the same methods on the
 * transaction `tx`) creates a fresh thenable chain whose result, when awaited,
 * is taken from the next queued resolver. Resolvers are not reused across
 * chains, but a single chain may be awaited multiple times inside the same
 * operation (e.g. `await chain.limit(1)` then later `await chain` from the same
 * variable) — the cached resolver is returned each time.
 */
export function makeDbStub(): DbStub & {
  enqueue: (value: unknown) => void;
  enqueueFn: (resolve: () => unknown) => void;
  pending: () => number;
  /** Asserts that every queued resolver was consumed during the test. */
  assertDrained: () => void;
} {
  const queue: QueuedResolver[] = [];
  const calls: string[] = [];

  const next = (op: string): Chain => {
    calls.push(op);
    if (queue.length === 0) {
      throw new Error(
        `drizzle-mock: result queue depleted at "${op}". Enqueue a result before calling db.${op}().`,
      );
    }
    const queued = queue[0]!;
    return new Chain(() => {
      if (!queued.consumed) {
        queued.consumed = true;
        queue.shift();
      }
      return queued.resolve();
    });
  };

  const makeTx = (): TxStub => ({
    select(..._: unknown[]) { return next('tx.select'); },
    insert(..._: unknown[]) { return next('tx.insert'); },
    update(..._: unknown[]) { return next('tx.update'); },
  });

  const db: DbStub = {
    select(..._: unknown[]) { return next('select'); },
    insert(..._: unknown[]) { return next('insert'); },
    update(..._: unknown[]) { return next('update'); },
    delete(..._: unknown[]) { return next('delete'); },
    transaction: async <R>(fn: (tx: TxStub) => Promise<R>): Promise<R> => {
      calls.push('transaction');
      return fn(makeTx());
    },
  };

  return {
    ...db,
    enqueue: (value: unknown) => queue.push({ resolve: () => value, consumed: false }),
    enqueueFn: (resolve: () => unknown) =>
      queue.push({ resolve, consumed: false }),
    pending: () => queue.filter((q) => !q.consumed).length,
    assertDrained: () => {
      expect(
        queue.filter((q) => !q.consumed).length,
        'drizzle-mock: result queue had unconsumed entries after the test ran',
      ).toBe(0);
    },
  };
}