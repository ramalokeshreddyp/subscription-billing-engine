# Subscription Billing Engine (SOLID & Hexagonal Architecture)

Refactored subscription renewal engine transforming a legacy tightly-coupled "God Class" into a modular, unit-testable Hexagonal (Ports and Adapters) architecture in TypeScript using SOLID principles.

---

## 🏛️ Architecture Overview

The system isolates pure domain logic from infrastructure and runtime dependencies using **Hexagonal Architecture**:

```
+-------------------------------------------------------------+
|                      API Controller                         |
|                   (RenewalController)                       |
+------------------------------+------------------------------+
                               | Injects Adapters
                               v
+-------------------------------------------------------------+
|                 Domain Core (Pure Logic)                    |
|                SubscriptionBillingService                   |
|                                                             |
|   Ports:                                                    |
|   - ISubscriptionRepository                                 |
|   - IUserRepository                                         |
|   - IPaymentGateway                                         |
|   - ITimeProvider                                           |
+------------------------------+------------------------------+
                               | Implements Ports
                               v
+-------------------------------------------------------------+
|                 Infrastructure Adapters                     |
|   - PostgresSubscriptionRepository (PostgreSQL)             |
|   - PostgresUserRepository (PostgreSQL)                     |
|   - MockStripePaymentGateway (Payment Processor)            |
|   - SystemTimeProvider (Clock wrapper)                      |
+-------------------------------------------------------------+
```

### Key Principles Applied:
- **Single Responsibility Principle (SRP):** Isolated routing, business calculations, persistence, and payment communication into dedicated modules.
- **Dependency Inversion Principle (DIP):** `SubscriptionBillingService` depends solely on abstract Port interfaces, never on concrete database or HTTP libraries.
- **Deterministic Time (Decoupled Temporal State):** The `ITimeProvider` port injects time, allowing unit tests to simulate any date (such as December for discount testing) without global monkey-patching.

---

## 📁 Repository Structure

```
├── docs/
│   └── ADR-001-Refactoring-God-Class.md   # Architecture Decision Record
├── legacy/
│   └── LegacySubscriptionManager.ts       # Legacy reference implementation
├── src/
│   ├── api/
│   │   ├── controllers/
│   │   │   └── RenewalController.ts       # API route handler & DI composition
│   │   └── server.ts                      # Express app configuration
│   ├── domain/
│   │   ├── models/                        # Domain entities (User, Subscription)
│   │   ├── ports/                         # Port interfaces (ISubscriptionRepository, etc.)
│   │   └── services/
│   │       └── SubscriptionBillingService.ts # Core business logic
│   ├── infrastructure/
│   │   ├── adapters/                      # Adapters (Postgres, Mock Stripe, System Clock)
│   │   └── database/                      # Schema migrations & seed script
│   └── index.ts                           # Application entrypoint
├── tests/
│   ├── unit/                              # Fast, isolated unit tests (no DB/network)
│   └── integration/                       # Integration tests for HTTP layer
├── docker-compose.yml                     # Docker Compose orchestration (API + DB)
├── Dockerfile                             # Multi-stage Docker build
├── submission.json                        # Test data mapping for evaluation
└── .env.example                           # Environment variable template
```

---

## 🚀 Quick Start

### 1. Run Unit Tests (Sandboxed, No DB required)
```bash
npm install
npm test
```

Unit tests achieve 100% code coverage across domain services and business rules.

### 2. Run with Docker Compose (Full Stack with Auto-seeding)
```bash
docker compose up --build -d
```

This starts:
- **PostgreSQL (`db`)** on `5432` with automated schema migrations and seed data from `src/infrastructure/database/init.sql`.
- **API Server (`api`)** on `3000` waiting for the database health check to pass.

---

## 📡 API Endpoints

### Renew Subscription
`POST /api/renew`

#### Request Body
```json
{
  "userId": "user-expired-1"
}
```

#### Response (200 OK - Successful Renewal)
```json
{
  "success": true,
  "message": "Renewal successful"
}
```

#### Response (400 Bad Request - Business Rule Failure)
```json
{
  "success": false,
  "message": "Subscription is not yet expired"
}
```

---

## 🧪 Test Data Reference (`submission.json`)

| User ID | Description | Expected API Result |
| :--- | :--- | :--- |
| `user-expired-1` | Expired subscription | `200 OK` (Renewed, expiration +1 year) |
| `user-active-1` | Active/Unexpired subscription | `400 Bad Request` ("Subscription is not yet expired") |
| `user-nonexistent` | Non-existent user | `400 Bad Request` ("User not found") |
