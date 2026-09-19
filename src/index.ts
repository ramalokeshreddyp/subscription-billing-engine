import * as dotenv from 'dotenv';
dotenv.config();

import { createServer } from './api/server';

const PORT = parseInt(process.env.PORT || '3000', 10);

const app = createServer();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Subscription Billing Engine API is running on port ${PORT}`);
});
