// infrastructure/adapters/SystemTimeProvider.ts
import { ITimeProvider } from '../../domain/ports/ITimeProvider';

export class SystemTimeProvider implements ITimeProvider {
  // Real implementation of the clock wrapping native system Date
  getCurrentTime(): Date {
    return new Date();
  }
}
