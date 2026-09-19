-- Database Initialization Script

-- Create Users table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    stripe_customer_id VARCHAR(255) NOT NULL
);

-- Create Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    base_price DECIMAL(10, 2) NOT NULL,
    expires_at TIMESTAMP NOT NULL
);

-- Clean existing seed data
DELETE FROM subscriptions;
DELETE FROM users;

-- Seed Data: Valid User with Expired Subscription
INSERT INTO users (id, stripe_customer_id) VALUES
('user-expired-1', 'cus_mock_expired_123');

INSERT INTO subscriptions (id, user_id, base_price, expires_at) VALUES
('sub-expired-1', 'user-expired-1', 100.00, '2023-01-01 00:00:00');

-- Seed Data: User with Active/Unexpired Subscription
INSERT INTO users (id, stripe_customer_id) VALUES
('user-active-1', 'cus_mock_active_456');

INSERT INTO subscriptions (id, user_id, base_price, expires_at) VALUES
('sub-active-1', 'user-active-1', 150.00, '2099-12-31 23:59:59');

-- Seed Data: Additional User for December Discount testing
INSERT INTO users (id, stripe_customer_id) VALUES
('user-december-1', 'cus_mock_december_789');

INSERT INTO subscriptions (id, user_id, base_price, expires_at) VALUES
('sub-december-1', 'user-december-1', 200.00, '2023-11-30 00:00:00');
