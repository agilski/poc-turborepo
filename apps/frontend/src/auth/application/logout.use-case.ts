import type { IAuthRepository } from "@/src/auth/domain/auth.repository.port";

export class LogoutUseCase {
  constructor(private readonly authRepository: IAuthRepository) {}

  async execute(): Promise<void> {
    await this.authRepository.logout();
  }
}
