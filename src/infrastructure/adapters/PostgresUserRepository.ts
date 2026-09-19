// infrastructure/adapters/PostgresUserRepository.ts
import { Pool } from 'pg';
import { IUserRepository } from '../../domain/ports/IUserRepository';
import { User } from '../../domain/models/User';
import { pool as defaultPool } from '../database/db';

export class PostgresUserRepository implements IUserRepository {
  constructor(private readonly db: Pool = defaultPool) {}

  async getUserById(userId: string): Promise<User | null> {
    const res = await this.db.query(
      'SELECT id, stripe_customer_id FROM users WHERE id = $1',
      [userId]
    );

    if (res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0];
    return {
      id: row.id,
      stripeCustomerId: row.stripe_customer_id,
    };
  }
}
