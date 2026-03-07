import type { IAuthRepository } from "@/src/auth/domain/auth.repository.port";
import type { User } from "@/src/auth/domain/user.entity";
import type { Credentials, RegisterData } from "@/src/auth/domain/credentials.vo";
import { AppError } from "@/src/shared/domain/errors";
import { AuthServiceUnavailableError } from "@/src/auth/domain/auth.errors";
import { httpPost, httpGet, HttpError } from "@/src/shared/infrastructure/http-client";

export class HttpAuthRepository implements IAuthRepository {
  async login(credentials: Credentials): Promise<void> {
    try {
      await httpPost("/api/auth/login", credentials);
    } catch (error) {
      throw this.toAppError(error, "Invalid credentials");
    }
  }

  async register(data: RegisterData): Promise<void> {
    try {
      await httpPost("/api/auth/register", data);
    } catch (error) {
      throw this.toAppError(error, "Registration failed");
    }
  }

  async logout(): Promise<void> {
    await httpPost("/api/auth/logout", {});
  }

  async getSession(): Promise<User | null> {
    try {
      const data = await httpGet<{ userId: string; email: string }>(
        "/api/auth/me",
      );
      return { id: data.userId, email: data.email };
    } catch {
      return null;
    }
  }

  private toAppError(error: unknown, fallback: string): AppError {
    if (error instanceof HttpError) {
      const message = (error.data?.message as string) ?? fallback;
      return new AppError(message, "AUTH_ERROR");
    }
    return new AuthServiceUnavailableError();
  }
}
