import { describe, it, expect, vi, beforeEach } from "vitest";
import { RegisterUseCase } from "./register.use-case";
import type { IAuthRepository } from "@/src/auth/domain/auth.repository.port";

const makeRepo = (): IAuthRepository => ({
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  getSession: vi.fn(),
});

describe("RegisterUseCase", () => {
  let repo: IAuthRepository;
  let useCase: RegisterUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new RegisterUseCase(repo);
  });

  it("delegates to repo.register with the provided data", async () => {
    const data = { email: "a@b.com", password: "secret", name: "Alice" };
    await useCase.execute(data);
    expect(repo.register).toHaveBeenCalledOnce();
    expect(repo.register).toHaveBeenCalledWith(data);
  });

  it("works without optional name field", async () => {
    const data = { email: "a@b.com", password: "secret" };
    await useCase.execute(data);
    expect(repo.register).toHaveBeenCalledWith(data);
  });

  it("propagates errors thrown by the repository", async () => {
    const error = new Error("already registered");
    vi.mocked(repo.register).mockRejectedValue(error);
    await expect(useCase.execute({ email: "a@b.com", password: "secret" })).rejects.toThrow("already registered");
  });
});
