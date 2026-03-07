import { UserWithoutPassword, UserWithPassword } from './user.entity';

export abstract class UserRepository {
  abstract findById(id: string): Promise<UserWithoutPassword | null>;
  abstract findByEmail(email: string): Promise<UserWithoutPassword | null>;
  abstract findByEmailWithPassword(
    email: string,
  ): Promise<UserWithPassword | null>;
  abstract findAll(): Promise<UserWithoutPassword[]>;
  abstract create(data: {
    email: string;
    password: string;
    name?: string;
  }): Promise<UserWithoutPassword>;
  abstract update(
    id: string,
    data: { email?: string; name?: string; password?: string },
  ): Promise<UserWithoutPassword>;
  abstract delete(id: string): Promise<void>;
}
