import request from 'supertest';
import { createServer } from '../../src/api/server';
import { RenewalController } from '../../src/api/controllers/RenewalController';
import { SubscriptionBillingService } from '../../src/domain/services/SubscriptionBillingService';
import { ISubscriptionRepository } from '../../src/domain/ports/ISubscriptionRepository';
import { IUserRepository } from '../../src/domain/ports/IUserRepository';
import { IPaymentGateway } from '../../src/domain/ports/IPaymentGateway';
import { ITimeProvider } from '../../src/domain/ports/ITimeProvider';

describe('API Integration: POST /api/renew', () => {
  let mockUserRepo: jest.Mocked<IUserRepository>;
  let mockSubscriptionRepo: jest.Mocked<ISubscriptionRepository>;
  let mockPaymentGateway: jest.Mocked<IPaymentGateway>;
  let mockTimeProvider: jest.Mocked<ITimeProvider>;
  let app: any;

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
      getCurrentTime: jest.fn().mockReturnValue(new Date('2023-06-01T00:00:00Z')),
    };

    const service = new SubscriptionBillingService(
      mockSubscriptionRepo,
      mockUserRepo,
      mockPaymentGateway,
      mockTimeProvider
    );

    const controller = new RenewalController(service);
    app = createServer(controller);
  });

  it('should return 400 when userId is missing', async () => {
    const res = await request(app)
      .post('/api/renew')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      message: 'userId is required and must be a string',
    });
  });

  it('should return 200 OK for a successful renewal', async () => {
    mockUserRepo.getUserById.mockResolvedValue({
      id: 'user-expired-1',
      stripeCustomerId: 'cus_123',
    });
    mockSubscriptionRepo.getSubscriptionByUserId.mockResolvedValue({
      id: 'sub-expired-1',
      userId: 'user-expired-1',
      basePrice: 100,
      expiresAt: new Date('2022-01-01T00:00:00Z'),
    });
    mockPaymentGateway.charge.mockResolvedValue(true);
    mockSubscriptionRepo.updateExpiration.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/renew')
      .send({ userId: 'user-expired-1' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: 'Renewal successful',
    });
  });

  it('should return 400 Bad Request if subscription is not yet expired', async () => {
    mockUserRepo.getUserById.mockResolvedValue({
      id: 'user-active-1',
      stripeCustomerId: 'cus_456',
    });
    mockSubscriptionRepo.getSubscriptionByUserId.mockResolvedValue({
      id: 'sub-active-1',
      userId: 'user-active-1',
      basePrice: 150,
      expiresAt: new Date('2099-12-31T23:59:59Z'),
    });

    const res = await request(app)
      .post('/api/renew')
      .send({ userId: 'user-active-1' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      message: 'Subscription is not yet expired',
    });
  });

  it('should return 400 Bad Request if user is not found', async () => {
    mockUserRepo.getUserById.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/renew')
      .send({ userId: 'user-nonexistent' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      message: 'User not found',
    });
  });
});
