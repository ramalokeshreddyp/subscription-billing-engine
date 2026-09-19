// domain/ports/IUserRepository.ts
import { User } from '../models/User';

export interface IUserRepository {
  // Fetch user by ID
  getUserById(userId: string): Promise<User | null>;
}
