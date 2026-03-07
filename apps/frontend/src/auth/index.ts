import { HttpAuthRepository } from "./infrastructure/http-auth.repository";
import { LoginUseCase } from "./application/login.use-case";
import { RegisterUseCase } from "./application/register.use-case";
import { LogoutUseCase } from "./application/logout.use-case";
import { GetSessionUseCase } from "./application/get-session.use-case";

const authRepository = new HttpAuthRepository();

export const loginUseCase = new LoginUseCase(authRepository);
export const registerUseCase = new RegisterUseCase(authRepository);
export const logoutUseCase = new LogoutUseCase(authRepository);
export const getSessionUseCase = new GetSessionUseCase(authRepository);

export type { User } from "./domain/user.entity";
export type { Credentials, RegisterData } from "./domain/credentials.vo";
export { AppError } from "@/src/shared/domain/errors";
