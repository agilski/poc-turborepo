import type { IAuthRepository } from "@/src/auth/domain/auth.repository.port";
import type { User } from "@/src/auth/domain/user.entity";

export class GetSessionUseCase {
  constructor(private readonly authRepository: IAuthRepository) {}

  async execute(): Promise<User | null> {
    return this.authRepository.getSession();
  }
}
