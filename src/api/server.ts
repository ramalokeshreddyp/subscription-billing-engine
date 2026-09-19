// api/server.ts
import express, { Express } from 'express';
import { RenewalController } from './controllers/RenewalController';

export function createServer(renewalController?: RenewalController): Express {
  const app = express();
  app.use(express.json());

  const controller = renewalController || new RenewalController();

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // POST /api/renew - Subscription renewal endpoint
  app.post('/api/renew', controller.handleRenew);

  return app;
}
