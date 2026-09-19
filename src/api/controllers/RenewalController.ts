// api/controllers/RenewalController.ts
import { Request, Response } from 'express';
import { SubscriptionBillingService } from '../../domain/services/SubscriptionBillingService';
import { PostgresUserRepository } from '../../infrastructure/adapters/PostgresUserRepository';
import { PostgresSubscriptionRepository } from '../../infrastructure/adapters/PostgresSubscriptionRepository';
import { MockStripePaymentGateway } from '../../infrastructure/adapters/MockStripePaymentGateway';
import { SystemTimeProvider } from '../../infrastructure/adapters/SystemTimeProvider';

export class RenewalController {
  private subscriptionBillingService?: SubscriptionBillingService;

  constructor(billingService?: SubscriptionBillingService) {
    if (billingService) {
      this.subscriptionBillingService = billingService;
    }
  }

  // Factory / Getter for Dependency Injection
  private getService(): SubscriptionBillingService {
    if (this.subscriptionBillingService) {
      return this.subscriptionBillingService;
    }

    // Invert Control & Inject Adapters into Domain Service
    const userRepo = new PostgresUserRepository();
    const subscriptionRepo = new PostgresSubscriptionRepository();
    const paymentGateway = new MockStripePaymentGateway();
    const timeProvider = new SystemTimeProvider();

    return new SubscriptionBillingService(
      subscriptionRepo,
      userRepo,
      paymentGateway,
      timeProvider
    );
  }

  handleRenew = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.body;

      if (!userId || typeof userId !== 'string') {
        res.status(400).json({
          success: false,
          message: 'userId is required and must be a string',
        });
        return;
      }

      const service = this.getService();
      const result = await service.processRenewal(userId);

      if (result.success) {
        res.status(200).json({
          success: true,
          message: result.message,
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message,
        });
      }
    } catch (error: any) {
      console.error('RenewalController error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  };
}
