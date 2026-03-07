import type { IAuthRepository } from "@/src/auth/domain/auth.repository.port";
import type { Credentials } from "@/src/auth/domain/credentials.vo";

export class LoginUseCase {
  constructor(private readonly authRepository: IAuthRepository) {}

  async execute(credentials: Credentials): Promise<void> {
    await this.authRepository.login(credentials);
  }
}
