import type { User } from "./user.entity";
import type { Credentials, RegisterData } from "./credentials.vo";

export interface IAuthRepository {
  login(credentials: Credentials): Promise<void>;
  register(data: RegisterData): Promise<void>;
  logout(): Promise<void>;
  getSession(): Promise<User | null>;
}
