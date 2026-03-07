import { describe, it, expect, vi, afterEach } from "vitest";
import { HttpAuthRepository } from "./http-auth.repository";
import { AppError } from "@/src/shared/domain/errors";
import { AuthServiceUnavailableError } from "@/src/auth/domain/auth.errors";

const makeResponse = (ok: boolean, status: number, data: unknown) =>
  ({
    ok,
    status,
    json: () => Promise.resolve(data),
  }) as unknown as Response;

describe("HttpAuthRepository", () => {
  const repo = new HttpAuthRepository();

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // --- login ---

  describe("login", () => {
    it("calls /api/auth/login with credentials", async () => {
      const fetchMock = vi.fn().mockResolvedValue(makeResponse(true, 200, {}));
      vi.stubGlobal("fetch", fetchMock);

      await repo.login({ email: "a@b.com", password: "secret" });

      expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "a@b.com", password: "secret" }),
      });
    });

    it("throws AppError with server message on 4xx", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(makeResponse(false, 401, { message: "Invalid credentials" }))
      );

      await expect(repo.login({ email: "a@b.com", password: "wrong" })).rejects.toThrow("Invalid credentials");
      await expect(repo.login({ email: "a@b.com", password: "wrong" })).rejects.toBeInstanceOf(AppError);
    });

    it("throws AuthServiceUnavailableError when fetch throws", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

      await expect(repo.login({ email: "a@b.com", password: "secret" })).rejects.toBeInstanceOf(
        AuthServiceUnavailableError
      );
    });
  });

  // --- register ---

  describe("register", () => {
    it("calls /api/auth/register with registration data", async () => {
      const fetchMock = vi.fn().mockResolvedValue(makeResponse(true, 201, {}));
      vi.stubGlobal("fetch", fetchMock);

      await repo.register({ email: "a@b.com", password: "secret", name: "Alice" });

      expect(fetchMock).toHaveBeenCalledWith("/api/auth/register", expect.objectContaining({ method: "POST" }));
    });

    it("throws AppError on 409 conflict", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(makeResponse(false, 409, { message: "Email already registered" }))
      );

      await expect(repo.register({ email: "a@b.com", password: "secret" })).rejects.toThrow("Email already registered");
    });

    it("throws AuthServiceUnavailableError when fetch throws", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

      await expect(repo.register({ email: "a@b.com", password: "secret" })).rejects.toBeInstanceOf(
        AuthServiceUnavailableError
      );
    });
  });

  // --- logout ---

  describe("logout", () => {
    it("calls /api/auth/logout", async () => {
      const fetchMock = vi.fn().mockResolvedValue(makeResponse(true, 200, {}));
      vi.stubGlobal("fetch", fetchMock);

      await repo.logout();

      expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", expect.objectContaining({ method: "POST" }));
    });
  });

  // --- getSession ---

  describe("getSession", () => {
    it("returns user when session is valid", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(makeResponse(true, 200, { userId: "1", email: "a@b.com" }))
      );

      const user = await repo.getSession();

      expect(user).toEqual({ id: "1", email: "a@b.com" });
    });

    it("returns null when not authenticated (4xx)", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeResponse(false, 401, {})));

      const user = await repo.getSession();

      expect(user).toBeNull();
    });

    it("returns null when fetch throws", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

      const user = await repo.getSession();

      expect(user).toBeNull();
    });
  });
});
