import { describe, it, expect, vi, beforeEach } from "vitest";
import { LogoutUseCase } from "./logout.use-case";
import type { IAuthRepository } from "@/src/auth/domain/auth.repository.port";

const makeRepo = (): IAuthRepository => ({
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  getSession: vi.fn(),
});

describe("LogoutUseCase", () => {
  let repo: IAuthRepository;
  let useCase: LogoutUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new LogoutUseCase(repo);
  });

  it("delegates to repo.logout", async () => {
    await useCase.execute();
    expect(repo.logout).toHaveBeenCalledOnce();
  });

  it("propagates errors thrown by the repository", async () => {
    vi.mocked(repo.logout).mockRejectedValue(new Error("session expired"));
    await expect(useCase.execute()).rejects.toThrow("session expired");
  });
});
