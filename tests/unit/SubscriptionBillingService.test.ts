import { SubscriptionBillingService } from '../../src/domain/services/SubscriptionBillingService';
import { ISubscriptionRepository } from '../../src/domain/ports/ISubscriptionRepository';
import { IUserRepository } from '../../src/domain/ports/IUserRepository';
import { IPaymentGateway } from '../../src/domain/ports/IPaymentGateway';
import { ITimeProvider } from '../../src/domain/ports/ITimeProvider';
import { User } from '../../src/domain/models/User';
import { Subscription } from '../../src/domain/models/Subscription';

describe('SubscriptionBillingService (Unit Tests)', () => {
  let mockUserRepo: jest.Mocked<IUserRepository>;
  let mockSubscriptionRepo: jest.Mocked<ISubscriptionRepository>;
  let mockPaymentGateway: jest.Mocked<IPaymentGateway>;
  let mockTimeProvider: jest.Mocked<ITimeProvider>;
  let service: SubscriptionBillingService;

  const sampleUser: User = {
    id: 'user-123',
    stripeCustomerId: 'cus_123',
  };

  const sampleExpiredSubscription: Subscription = {
    id: 'sub-123',
    userId: 'user-123',
    basePrice: 100,
    expiresAt: new Date('2023-01-01T00:00:00Z'),
  };

  beforeEach(() => {
    mockUserRepo = {
      getUserById: jest.fn(),
    };

    mockSubscriptionRepo = {
      getSubscriptionByUserId: jest.fn(),
      updateExpiration: jest.fn(),
    };

    mockPaymentGateway = {
      charge: jest.fn(),
    };

    mockTimeProvider = {
      getCurrentTime: jest.fn(),
    };

    service = new SubscriptionBillingService(
      mockSubscriptionRepo,
      mockUserRepo,
      mockPaymentGateway,
      mockTimeProvider
    );
  });

  describe('User and Subscription Validation', () => {
    it('should return failure if user is not found', async () => {
      mockUserRepo.getUserById.mockResolvedValue(null);

      const result = await service.processRenewal('user-unknown');

      expect(result).toEqual({
        success: false,
        message: 'User not found',
      });
      expect(mockUserRepo.getUserById).toHaveBeenCalledWith('user-unknown');
      expect(mockSubscriptionRepo.getSubscriptionByUserId).not.toHaveBeenCalled();
      expect(mockPaymentGateway.charge).not.toHaveBeenCalled();
    });

    it('should return failure if subscription is not found', async () => {
      mockUserRepo.getUserById.mockResolvedValue(sampleUser);
      mockSubscriptionRepo.getSubscriptionByUserId.mockResolvedValue(null);

      const result = await service.processRenewal('user-123');

      expect(result).toEqual({
        success: false,
        message: 'Subscription not found',
      });
      expect(mockUserRepo.getUserById).toHaveBeenCalledWith('user-123');
      expect(mockSubscriptionRepo.getSubscriptionByUserId).toHaveBeenCalledWith('user-123');
      expect(mockPaymentGateway.charge).not.toHaveBeenCalled();
    });
  });

  describe('Temporal Rules (Expiration Checks)', () => {
    it('should fail if the subscription is not yet expired', async () => {
      const fixedNow = new Date('2023-06-15T12:00:00Z');
      const unexpiredSubscription: Subscription = {
        id: 'sub-456',
        userId: 'user-123',
        basePrice: 100,
        expiresAt: new Date('2023-12-31T23:59:59Z'), // In the future
      };

      mockUserRepo.getUserById.mockResolvedValue(sampleUser);
      mockSubscriptionRepo.getSubscriptionByUserId.mockResolvedValue(unexpiredSubscription);
      mockTimeProvider.getCurrentTime.mockReturnValue(fixedNow);

      const result = await service.processRenewal('user-123');

      expect(result).toEqual({
        success: false,
        message: 'Subscription is not yet expired',
      });
      expect(mockPaymentGateway.charge).not.toHaveBeenCalled();
      expect(mockSubscriptionRepo.updateExpiration).not.toHaveBeenCalled();
    });

    it('should correctly handle date objects or string date timestamps in expiresAt', async () => {
      const fixedNow = new Date('2023-06-15T12:00:00Z');
      const unexpiredSubscriptionWithStringDate: any = {
        id: 'sub-456',
        userId: 'user-123',
        basePrice: 100,
        expiresAt: '2023-12-31T23:59:59Z',
      };

      mockUserRepo.getUserById.mockResolvedValue(sampleUser);
      mockSubscriptionRepo.getSubscriptionByUserId.mockResolvedValue(unexpiredSubscriptionWithStringDate);
      mockTimeProvider.getCurrentTime.mockReturnValue(fixedNow);

      const result = await service.processRenewal('user-123');

      expect(result).toEqual({
        success: false,
        message: 'Subscription is not yet expired',
      });
    });
  });

  describe('Pricing Rules (Promotional Discounts)', () => {
    it('should apply a 10% discount if the renewal happens in December', async () => {
      const decemberDate = new Date('2023-12-15T10:00:00Z');
      mockUserRepo.getUserById.mockResolvedValue(sampleUser);
      mockSubscriptionRepo.getSubscriptionByUserId.mockResolvedValue(sampleExpiredSubscription);
      mockTimeProvider.getCurrentTime.mockReturnValue(decemberDate);
      mockPaymentGateway.charge.mockResolvedValue(true);
      mockSubscriptionRepo.updateExpiration.mockResolvedValue(undefined);

      const result = await service.processRenewal('user-123');

      expect(result).toEqual({
        success: true,
        message: 'Renewal successful',
      });
      // 100 * 0.9 = 90
      expect(mockPaymentGateway.charge).toHaveBeenCalledWith('cus_123', 90);
    });

    it('should charge the standard price in non-December months', async () => {
      const julyDate = new Date('2023-07-20T14:30:00Z');
      mockUserRepo.getUserById.mockResolvedValue(sampleUser);
      mockSubscriptionRepo.getSubscriptionByUserId.mockResolvedValue(sampleExpiredSubscription);
      mockTimeProvider.getCurrentTime.mockReturnValue(julyDate);
      mockPaymentGateway.charge.mockResolvedValue(true);
      mockSubscriptionRepo.updateExpiration.mockResolvedValue(undefined);

      const result = await service.processRenewal('user-123');

      expect(result).toEqual({
        success: true,
        message: 'Renewal successful',
      });
      // Standard price: 100
      expect(mockPaymentGateway.charge).toHaveBeenCalledWith('cus_123', 100);
    });
  });

  describe('Payment and Expiration Rollover', () => {
    it('should add exactly 1 year to current time upon successful renewal', async () => {
      const fixedNow = new Date('2023-05-10T08:00:00Z');
      const expectedExpiry = new Date('2024-05-10T08:00:00Z');

      mockUserRepo.getUserById.mockResolvedValue(sampleUser);
      mockSubscriptionRepo.getSubscriptionByUserId.mockResolvedValue(sampleExpiredSubscription);
      mockTimeProvider.getCurrentTime.mockReturnValue(fixedNow);
      mockPaymentGateway.charge.mockResolvedValue(true);
      mockSubscriptionRepo.updateExpiration.mockResolvedValue(undefined);

      const result = await service.processRenewal('user-123');

      expect(result).toEqual({
        success: true,
        message: 'Renewal successful',
      });
      expect(mockSubscriptionRepo.updateExpiration).toHaveBeenCalledWith('sub-123', expectedExpiry);
    });

    it('should fail gracefully when the payment gateway returns false', async () => {
      const fixedNow = new Date('2023-05-10T08:00:00Z');
      mockUserRepo.getUserById.mockResolvedValue(sampleUser);
      mockSubscriptionRepo.getSubscriptionByUserId.mockResolvedValue(sampleExpiredSubscription);
      mockTimeProvider.getCurrentTime.mockReturnValue(fixedNow);
      mockPaymentGateway.charge.mockResolvedValue(false);

      const result = await service.processRenewal('user-123');

      expect(result).toEqual({
        success: false,
        message: 'Payment failed',
      });
      expect(mockSubscriptionRepo.updateExpiration).not.toHaveBeenCalled();
    });

    it('should catch payment gateway exceptions and return payment gateway error', async () => {
      const fixedNow = new Date('2023-05-10T08:00:00Z');
      mockUserRepo.getUserById.mockResolvedValue(sampleUser);
      mockSubscriptionRepo.getSubscriptionByUserId.mockResolvedValue(sampleExpiredSubscription);
      mockTimeProvider.getCurrentTime.mockReturnValue(fixedNow);
      mockPaymentGateway.charge.mockRejectedValue(new Error('Network timeout'));

      const result = await service.processRenewal('user-123');

      expect(result).toEqual({
        success: false,
        message: 'Payment gateway error',
      });
      expect(mockSubscriptionRepo.updateExpiration).not.toHaveBeenCalled();
    });
  });
});
