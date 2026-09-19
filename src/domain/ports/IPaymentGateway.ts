// domain/ports/IPaymentGateway.ts
export interface IPaymentGateway {
  // Attempts to charge a user a specific amount
  // Params: customerId (string), amount (number)
  // Returns: boolean indicating success
  // Side Effects: Interfaces with external payment provider
  charge(customerId: string, amount: number): Promise<boolean>;
}
