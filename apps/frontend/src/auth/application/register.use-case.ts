import type { IAuthRepository } from "@/src/auth/domain/auth.repository.port";
import type { RegisterData } from "@/src/auth/domain/credentials.vo";

export class RegisterUseCase {
  constructor(private readonly authRepository: IAuthRepository) {}

  async execute(data: RegisterData): Promise<void> {
    await this.authRepository.register(data);
  }
}
