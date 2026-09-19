// domain/ports/ISubscriptionRepository.ts
import { Subscription } from '../models/Subscription';

export interface ISubscriptionRepository {
  // Fetch subscription by user ID
  getSubscriptionByUserId(userId: string): Promise<Subscription | null>;

  // Update the expiration date of a subscription
  updateExpiration(subscriptionId: string, newExpiry: Date): Promise<void>;
}
