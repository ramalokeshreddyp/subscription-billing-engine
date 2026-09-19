/**
 * The Legacy Smelly Logic (To be refactored)
 * 
 * Code Smells:
 * 1. Hardcoded Infrastructure (Direct DB connection & queries)
 * 2. Temporal Coupling (Direct new Date() calls)
 * 3. Direct Third-Party API Call (Direct Stripe client)
 * 4. SRP Violation (God class doing everything)
 */

export class LegacySubscriptionManager {
  async processRenewal(userId: string): Promise<{ success: boolean; message: string }> {
    // SMELL 1: Hardcoded Infrastructure
    const db = (global as any).DatabaseConnection ? new (global as any).DatabaseConnection(process.env.DB_URL) : null;
    const user = db ? await db.query("SELECT * FROM users WHERE id = ?", [userId]) : null;
    if (!user) return { success: false, message: "User not found" };

    const sub = await db.query("SELECT * FROM subscriptions WHERE user_id = ?", [userId]);
    if (!sub) return { success: false, message: "Subscription not found" };

    // SMELL 2: Temporal Coupling (Non-deterministic)
    const now = new Date();

    // BUSINESS RULE 1: Cannot renew if not expired
    if (new Date(sub.expires_at) > now) {
      return { success: false, message: "Subscription is not yet expired" };
    }

    let chargeAmount = sub.base_price;

    // BUSINESS RULE 2: December Promotional Discount (10% off)
    if (now.getMonth() === 11) { // 11 is December in 0-indexed JS dates
      chargeAmount = chargeAmount * 0.9;
    }

    // SMELL 3: Direct Third-Party API Call
    const stripeClient = (global as any).ThirdPartyPaymentClient
      ? new (global as any).ThirdPartyPaymentClient(process.env.PAYMENT_API_KEY)
      : null;

    try {
      const charge = stripeClient ? await stripeClient.chargeCustomer(user.stripe_customer_id, chargeAmount) : { status: "success" };
      if (charge.status === "success") {
        // BUSINESS RULE 3: Add exactly 1 year to current time for next expiry
        const newExpiry = new Date(now);
        newExpiry.setFullYear(newExpiry.getFullYear() + 1);

        await db.query("UPDATE subscriptions SET expires_at = ? WHERE id = ?", [newExpiry, sub.id]);
        return { success: true, message: "Renewal successful" };
      } else {
        return { success: false, message: "Payment failed" };
      }
    } catch (error) {
      return { success: false, message: "Payment gateway error" };
    }
  }
}
