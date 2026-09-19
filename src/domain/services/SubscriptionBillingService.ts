// domain/services/SubscriptionBillingService.ts
import { ISubscriptionRepository } from '../ports/ISubscriptionRepository';
import { IUserRepository } from '../ports/IUserRepository';
import { IPaymentGateway } from '../ports/IPaymentGateway';
import { ITimeProvider } from '../ports/ITimeProvider';

export interface RenewalResult {
  success: boolean;
  message: string;
}

export class SubscriptionBillingService {
  constructor(
    private readonly subscriptionRepo: ISubscriptionRepository,
    private readonly userRepo: IUserRepository,
    private readonly paymentGateway: IPaymentGateway,
    private readonly timeProvider: ITimeProvider
  ) {}

  async processRenewal(userId: string): Promise<RenewalResult> {
    // 1. Fetch user by ID
    const user = await this.userRepo.getUserById(userId);
    if (!user) {
      return { success: false, message: "User not found" };
    }

    // 2. Fetch subscription by user ID
    const sub = await this.subscriptionRepo.getSubscriptionByUserId(userId);
    if (!sub) {
      return { success: false, message: "Subscription not found" };
    }

    // 3. Obtain current time from the injected time provider (deterministic)
    const now = this.timeProvider.getCurrentTime();
    const expiresAt = sub.expiresAt instanceof Date ? sub.expiresAt : new Date(sub.expiresAt);

    // BUSINESS RULE 1: Cannot renew if not expired
    if (expiresAt.getTime() > now.getTime()) {
      return { success: false, message: "Subscription is not yet expired" };
    }

    let chargeAmount = sub.basePrice;

    // BUSINESS RULE 2: December Promotional Discount (10% off)
    // 11 represents December in 0-indexed JavaScript Date months
    if (now.getMonth() === 11) {
      chargeAmount = chargeAmount * 0.9;
    }

    // 4. Charge customer via injected payment gateway
    try {
      const chargeSuccess = await this.paymentGateway.charge(user.stripeCustomerId, chargeAmount);

      if (chargeSuccess) {
        // BUSINESS RULE 3: Add exactly 1 year to current time for next expiry
        const newExpiry = new Date(now.getTime());
        newExpiry.setFullYear(newExpiry.getFullYear() + 1);

        await this.subscriptionRepo.updateExpiration(sub.id, newExpiry);
        return { success: true, message: "Renewal successful" };
      } else {
        return { success: false, message: "Payment failed" };
      }
    } catch (error) {
      return { success: false, message: "Payment gateway error" };
    }
  }
}
