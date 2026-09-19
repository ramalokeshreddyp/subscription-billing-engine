# Context

The legacy `SubscriptionManager` class was implemented as a monolithic "God Class" that violated fundamental object-oriented and clean architecture design principles. It suffered from three primary architectural problems:

1. **Hidden Infrastructure Dependencies:** Direct instantiation of database connections (`new DatabaseConnection(process.env.DB_URL)`) and third-party payment clients (`new ThirdPartyPaymentClient(process.env.PAYMENT_API_KEY)`) directly inside the domain method. This created tight coupling to PostgreSQL and Stripe.
2. **Temporal Coupling (Non-deterministic State):** Direct calls to the system clock via `new Date()`. This made it impossible to test time-dependent business rules (such as subscription expiration verification and December promotional discounts) in a deterministic and repeatable manner without monkey-patching runtime internals.
3. **I/O and Business Logic Interleaving:** High-level business rules (such as the December 10% discount, non-expired renewal block, and 1-year expiration rollover) were tightly interleaved with raw database queries (`SELECT * FROM users...`, `UPDATE subscriptions...`) and external network calls.
4. **Lack of Testability:** The class could not be unit tested in isolation. Executing any test required provisioning a running database instance, valid Stripe API credentials, and network connectivity.

# Decision

We refactored the subscription billing system using **Hexagonal Architecture (Ports and Adapters)** along with **SOLID Principles** (specifically the Single Responsibility Principle and the Dependency Inversion Principle) and **Constructor-based Dependency Injection (DI)**:

1. **Domain Isolation:** Created a pure domain layer (`src/domain/`) with no external dependencies on databases, HTTP clients, web frameworks, or operating system clocks.
2. **Ports (Interfaces):**
   - `ITimeProvider`: Contract for retrieving the current timestamp, eliminating temporal coupling.
   - `IPaymentGateway`: Contract for processing customer charges, abstracting payment providers.
   - `ISubscriptionRepository`: Contract for fetching and updating subscription data.
   - `IUserRepository`: Contract for fetching user account and payment gateway customer IDs.
3. **Pure Domain Service:** Implemented `SubscriptionBillingService`, which accepts all dependencies via its constructor and executes business logic strictly through domain ports.
4. **Infrastructure Adapters:**
   - `SystemTimeProvider`: Implements `ITimeProvider` by wrapping standard runtime time.
   - `PostgresUserRepository` & `PostgresSubscriptionRepository`: Implement persistence contracts using PostgreSQL queries.
   - `MockStripePaymentGateway`: Implements `IPaymentGateway` to simulate payment processing.
5. **Inversion of Control at API Entrypoint:** The HTTP API controller (`RenewalController`) handles request validation, instantiates/resolves the required concrete adapters, injects them into `SubscriptionBillingService`, and transforms domain results into HTTP responses.

# Consequences

### Positive
- **100% Deterministic Unit Testing:** Core business logic can be tested in milliseconds without database or network I/O. Any point in time (such as December for promotional discounts) can be simulated using simple in-memory test doubles.
- **Interchangeable Infrastructure:** Swapping PostgreSQL for another database (e.g., MySQL, DynamoDB) or Stripe for another gateway (e.g., PayPal, Adyen) only requires writing a new adapter without altering any domain logic.
- **Maintainability and Single Responsibility:** Domain rules change only when business policies change; persistence logic changes only when database schemas change.

### Trade-offs / Mitigations
- **Increased File and Class Count:** Transitioned from a single monolithic file to distinct domain models, ports, services, adapters, and controllers. This added modularity is standard in enterprise systems and dramatically reduces long-term maintenance overhead.
- **Need for Composition Root:** Dependencies must be composed at the application boundary (e.g., API entrypoint or DI container).

# Code Smells Addressed

| Legacy Code Smell | Description | Refactored Solution |
| :--- | :--- | :--- |
| **Hidden Dependencies** | Direct instantiations of `DatabaseConnection` and `ThirdPartyPaymentClient` inside the method. | Applied **Dependency Inversion Principle (DIP)**. Dependencies are declared as interfaces (`ISubscriptionRepository`, `IUserRepository`, `IPaymentGateway`) and injected via the service constructor. |
| **Temporal Coupling** | Direct invocation of `new Date()` inside business calculations. | Introduced the `ITimeProvider` port. Current time is supplied deterministically by the injected provider (`this.timeProvider.getCurrentTime()`), enabling seamless time manipulation in unit tests. |
| **I/O Interleaving** | SQL queries and payment HTTP requests mixed inline with pricing and expiration logic. | Extracted pure domain models (`User`, `Subscription`) and domain service (`SubscriptionBillingService`). All I/O operations are delegated to repository and gateway ports. |
| **God Class (SRP Violation)** | `SubscriptionManager` handled routing, validation, database queries, billing rules, and external API requests. | Applied **Single Responsibility Principle (SRP)** by separating routing (`RenewalController`), domain logic (`SubscriptionBillingService`), and infrastructure concerns (`Postgres*Repository`, `MockStripePaymentGateway`). |
| **Untestable Edge Cases** | Inability to test December promotional pricing without running tests specifically in December. | Replaced system clock access with `ITimeProvider` stub in unit tests to simulate any calendar date on demand. |
