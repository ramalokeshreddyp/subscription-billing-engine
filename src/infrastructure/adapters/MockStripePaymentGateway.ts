// infrastructure/adapters/MockStripePaymentGateway.ts
import { IPaymentGateway } from '../../domain/ports/IPaymentGateway';

export class MockStripePaymentGateway implements IPaymentGateway {
  constructor(private readonly apiKey: string = process.env.PAYMENT_API_KEY || 'mock_key') {}

  async charge(customerId: string, amount: number): Promise<boolean> {
    // Simulates an external HTTP call to payment processor (e.g., Stripe)
    if (!customerId || customerId.startsWith('invalid') || customerId.startsWith('fail')) {
      return false;
    }
    if (amount <= 0) {
      return false;
    }
    // Simulate successful payment processing
    return true;
  }
}

// Export StripePaymentAdapter alias for flexibility
export class StripePaymentAdapter extends MockStripePaymentGateway {}
