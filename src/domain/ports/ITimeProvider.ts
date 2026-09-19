// domain/ports/ITimeProvider.ts
// Provides deterministic time for the application
export interface ITimeProvider {
  // Returns the current date/time as dictated by the provider
  // Params: none
  // Returns: Date object representing "now"
  getCurrentTime(): Date;
}
