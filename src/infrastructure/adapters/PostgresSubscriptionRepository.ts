// infrastructure/adapters/PostgresSubscriptionRepository.ts
import { Pool } from 'pg';
import { ISubscriptionRepository } from '../../domain/ports/ISubscriptionRepository';
import { Subscription } from '../../domain/models/Subscription';
import { pool as defaultPool } from '../database/db';

export class PostgresSubscriptionRepository implements ISubscriptionRepository {
  constructor(private readonly db: Pool = defaultPool) {}

  async getSubscriptionByUserId(userId: string): Promise<Subscription | null> {
    const res = await this.db.query(
      'SELECT id, user_id, base_price, expires_at FROM subscriptions WHERE user_id = $1',
      [userId]
    );

    if (res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      basePrice: parseFloat(row.base_price),
      expiresAt: new Date(row.expires_at),
    };
  }

  async updateExpiration(subscriptionId: string, newExpiry: Date): Promise<void> {
    await this.db.query(
      'UPDATE subscriptions SET expires_at = $1 WHERE id = $2',
      [newExpiry, subscriptionId]
    );
  }
}
