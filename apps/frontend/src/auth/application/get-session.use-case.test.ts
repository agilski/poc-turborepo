import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetSessionUseCase } from "./get-session.use-case";
import type { IAuthRepository } from "@/src/auth/domain/auth.repository.port";

const makeRepo = (): IAuthRepository => ({
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  getSession: vi.fn(),
});

describe("GetSessionUseCase", () => {
  let repo: IAuthRepository;
  let useCase: GetSessionUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new GetSessionUseCase(repo);
  });

  it("returns the user when session exists", async () => {
    const user = { id: "1", email: "a@b.com" };
    vi.mocked(repo.getSession).mockResolvedValue(user);
    const result = await useCase.execute();
    expect(result).toEqual(user);
  });

  it("returns null when no session exists", async () => {
    vi.mocked(repo.getSession).mockResolvedValue(null);
    const result = await useCase.execute();
    expect(result).toBeNull();
  });
});
