import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoginUseCase } from "./login.use-case";
import type { IAuthRepository } from "@/src/auth/domain/auth.repository.port";

const makeRepo = (): IAuthRepository => ({
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  getSession: vi.fn(),
});

describe("LoginUseCase", () => {
  let repo: IAuthRepository;
  let useCase: LoginUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new LoginUseCase(repo);
  });

  it("delegates to repo.login with the provided credentials", async () => {
    const credentials = { email: "a@b.com", password: "secret" };
    await useCase.execute(credentials);
    expect(repo.login).toHaveBeenCalledOnce();
    expect(repo.login).toHaveBeenCalledWith(credentials);
  });

  it("propagates errors thrown by the repository", async () => {
    const error = new Error("network failure");
    vi.mocked(repo.login).mockRejectedValue(error);
    await expect(useCase.execute({ email: "a@b.com", password: "secret" })).rejects.toThrow("network failure");
  });
});
