# Architectural Questionnaire Responses

### 1. Why is Constructor Injection preferred over Instantiating dependencies inside the service?
Constructor injection passes dependencies from the outside as arguments to the class constructor rather than instantiating them directly with `new DatabaseConnection()` or `new ThirdPartyPaymentClient()` inside methods. 

Key benefits include:
- **Dependency Inversion Principle (DIP) & Inversion of Control (IoC):** The high-level domain service depends exclusively on abstract Port interfaces (`ISubscriptionRepository`, `IUserRepository`, `IPaymentGateway`, `ITimeProvider`), completely decoupling business rules from concrete infrastructure.
- **Isolated Unit Testability:** It eliminates hidden side effects, allowing fast in-memory mock objects and stubs to be injected during unit tests without spinning up databases or invoking external network APIs.
- **Explicit Dependency Contract:** The service explicitly declares all its required collaborators in its constructor signature, making dependencies transparent and self-documenting.
- **Flexibility & Extensibility:** Swapping an infrastructure component (such as migrating from PostgreSQL to MySQL, or Stripe to PayPal) requires only writing a new adapter and injecting it, without modifying a single line of domain logic.

---

### 2. What are the pros and cons of using an explicit `ITimeProvider` versus a global testing library mock (like `jest.useFakeTimers()`)?

**Pros of explicit `ITimeProvider`:**
- **Architectural Transparency:** Treating time as an injected dependency makes temporal coupling explicit in the domain contract rather than relying on ambient, hidden global state.
- **Framework & Runtime Independence:** The domain logic remains pure TypeScript and does not depend on Jest, test runner internals, or global runtime monkey-patching.
- **Test Isolation & Predictability:** Manipulating time through a dedicated mock object avoids side effects that global monkey-patching of `Date` can cause on asynchronous timers, event loops, logging timestamps, or concurrent test runners.

**Cons of explicit `ITimeProvider`:**
- **Additional Boilerplate:** Requires defining an interface (`ITimeProvider`), implementing an adapter (`SystemTimeProvider`), and injecting it through the constructor hierarchy.
- **Discipline Required:** Developers must consistently call `this.timeProvider.getCurrentTime()` rather than default native `new Date()`.

---

### 3. How did you prevent infrastructure exceptions (like a Postgres connection error) from leaking into your Domain service?
In our Hexagonal Architecture:
1. **Domain Interfaces Return Clean Domain Types:** Port interfaces (`ISubscriptionRepository`, `IUserRepository`, `IPaymentGateway`) define contracts in terms of pure domain models (`User | null`, `Subscription | null`, `boolean`) rather than exposing raw database query results, ORM entities, or driver-specific error classes.
2. **Third-Party API Error Isolation:** The domain service wraps external gateway interactions with exception handling, transforming infrastructure failures into structured domain outcome objects (`{ success: false, message: "Payment gateway error" }` / `{ success: false, message: "Payment failed" }`).
3. **Boundary Exception Catching in Controller:** At the application boundary (`RenewalController`), any unexpected infrastructure-level exceptions (such as network disconnection or database pool exhaustion) are caught and mapped to standard HTTP `500 Internal server error` responses. This prevents infrastructure error types from contaminating domain logic and avoids leaking internal database schemas or credentials to API consumers.

---

### 4. Which specific SOLID principle was most heavily violated in the original Legacy code snippet, and how does your refactored code adhere to it?
The legacy code snippet most heavily violated the **Single Responsibility Principle (SRP)** and the **Dependency Inversion Principle (DIP)**:

- **Legacy Violations:** The legacy `SubscriptionManager` was a monolithic "God Class" that mixed database connection lifecycle management, raw SQL execution, system clock access, pricing calculation (December 10% discount), external Stripe API requests, and response formatting into a single function. It had multiple reasons to change whenever database schemas, payment APIs, pricing rules, or HTTP formats changed.
- **How Refactored Code Adheres:**
  - **Single Responsibility Principle (SRP):** Responsibilities are strictly segregated:
    - `SubscriptionBillingService`: Orchestrates only core domain business rules (expiration checks, discount calculation, expiry rollover).
    - `PostgresSubscriptionRepository` & `PostgresUserRepository`: Handle database persistence and SQL query execution.
    - `MockStripePaymentGateway`: Manages third-party payment provider communication.
    - `SystemTimeProvider`: Handles clock access.
    - `RenewalController`: Manages HTTP request parsing, status codes, and JSON response formatting.
  - **Dependency Inversion Principle (DIP):** `SubscriptionBillingService` depends solely on abstract Port interfaces in `src/domain/ports/`. High-level business logic no longer depends on low-level database or HTTP modules.

---

### 5. If you were to write an Integration Test for the `PostgresSubscriptionRepository`, how would the setup differ from the Unit Tests you wrote for the Service?

The setup would differ in the following key aspects:

1. **Environment & Infrastructure:**
   - **Unit Tests:** Execute completely in-memory with zero I/O or network connections, using Jest mock objects (`jest.fn()`) for all repositories and providers.
   - **Integration Tests:** Require a running PostgreSQL instance (e.g., initialized via Docker Compose or a test container).

2. **Lifecycle Hooks (Setup & Teardown):**
   - **Unit Tests:** Reset mock states using `beforeEach` (`jest.clearAllMocks()`).
   - **Integration Tests:** 
     - `beforeAll`: Initialize the `pg.Pool` connection and run database DDL migrations (`init.sql`) to create `users` and `subscriptions` tables.
     - `beforeEach`: Seed baseline test fixtures (e.g., `INSERT INTO users...` and `INSERT INTO subscriptions...`).
     - `afterEach`: Truncate or clean test tables (`DELETE FROM subscriptions; DELETE FROM users;`) to ensure test isolation between runs.
     - `afterAll`: Close the database connection pool (`await pool.end()`) to avoid dangling open handles.

3. **Assertions & Scope:**
   - **Unit Tests:** Assert that repository methods were invoked with expected arguments and that business rules calculate correct outcomes.
   - **Integration Tests:** Execute actual SQL queries (`getSubscriptionByUserId`, `updateExpiration`) against the real PostgreSQL database and assert that data is correctly stored, updated, retrieved, and type-cast across table constraints and column types.
