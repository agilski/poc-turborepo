# Frontend Unit & Integration Tests — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Vitest-based unit and integration tests to the frontend app covering all DDD layers — use cases, infrastructure adapter, and page components.

**Architecture:** Co-located tests next to source files. Unit tests cover domain/application layers with mock repositories. Integration tests cover the HTTP repository (mocked `fetch`) and page components (mocked use cases + Next.js router). Two script aliases (`test:unit`, `test:integration`) select by directory path.

**Tech Stack:** Vitest, @vitejs/plugin-react, jsdom, @testing-library/react, @testing-library/user-event, @testing-library/jest-dom

---

### Task 1: Install dependencies

**Files:**
- Modify: `apps/frontend/package.json`

**Step 1: Install dev dependencies**

```bash
cd apps/frontend
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

**Step 2: Verify they appear in devDependencies**

```bash
cat apps/frontend/package.json | grep -E "vitest|testing-library|jsdom|vitejs"
```

Expected: all five packages listed.

**Step 3: Commit**

```bash
git add apps/frontend/package.json pnpm-lock.yaml
git commit -m "chore(frontend): install vitest and testing-library"
```

---

### Task 2: Create Vitest config and setup file

**Files:**
- Create: `apps/frontend/vitest.config.ts`
- Create: `apps/frontend/vitest.setup.ts`

**Step 1: Create `vitest.setup.ts`**

```ts
// apps/frontend/vitest.setup.ts
import "@testing-library/jest-dom";
```

**Step 2: Create `vitest.config.ts`**

```ts
// apps/frontend/vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

**Step 3: Commit**

```bash
git add apps/frontend/vitest.config.ts apps/frontend/vitest.setup.ts
git commit -m "chore(frontend): add vitest config and setup file"
```

---

### Task 3: Add test scripts to package.json and turbo.json

**Files:**
- Modify: `apps/frontend/package.json`
- Modify: `turbo.json`

**Step 1: Add scripts to `apps/frontend/package.json`**

Add these four scripts to the `"scripts"` block:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:unit": "vitest run src/auth/domain src/auth/application",
"test:integration": "vitest run src/auth/infrastructure app/\\(auth\\)"
```

The full scripts block should look like:

```json
"scripts": {
  "dev": "next dev --port 3001",
  "build": "next build",
  "start": "next start",
  "lint": "eslint --max-warnings 0",
  "check-types": "next typegen && tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:unit": "vitest run src/auth/domain src/auth/application",
  "test:integration": "vitest run src/auth/infrastructure 'app/(auth)'",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}
```

**Step 2: Add `test` task to `turbo.json`**

Add a `test` task after `check-types`:

```json
"test": {
  "dependsOn": ["^build"],
  "inputs": ["$TURBO_DEFAULT$"],
  "outputs": [],
  "cache": true
}
```

**Step 3: Verify smoke-run with no test files yet**

```bash
cd apps/frontend && pnpm test
```

Expected: Vitest starts and exits with "No test files found" or 0 tests (not an error about config).

**Step 4: Commit**

```bash
git add apps/frontend/package.json turbo.json
git commit -m "chore(frontend): add test scripts and turbo test task"
```

---

### Task 4: Unit tests — use cases

**Note on domain types:** `Credentials`, `RegisterData`, and `User` are plain TypeScript `type` aliases with no runtime logic. They are fully validated by `check-types`. No test files needed for them.

**Files:**
- Create: `apps/frontend/src/auth/application/login.use-case.test.ts`
- Create: `apps/frontend/src/auth/application/register.use-case.test.ts`
- Create: `apps/frontend/src/auth/application/logout.use-case.test.ts`
- Create: `apps/frontend/src/auth/application/get-session.use-case.test.ts`

**Step 1: Create `login.use-case.test.ts`**

```ts
// apps/frontend/src/auth/application/login.use-case.test.ts
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
```

**Step 2: Run test to verify it passes**

```bash
cd apps/frontend && pnpm test:unit
```

Expected: 2 tests pass.

**Step 3: Create `register.use-case.test.ts`**

```ts
// apps/frontend/src/auth/application/register.use-case.test.ts
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
```

**Step 4: Create `logout.use-case.test.ts`**

```ts
// apps/frontend/src/auth/application/logout.use-case.test.ts
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
```

**Step 5: Create `get-session.use-case.test.ts`**

```ts
// apps/frontend/src/auth/application/get-session.use-case.test.ts
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
```

**Step 6: Run all unit tests**

```bash
cd apps/frontend && pnpm test:unit
```

Expected: 9 tests pass across 4 files.

**Step 7: Commit**

```bash
git add apps/frontend/src/auth/application/*.test.ts
git commit -m "test(frontend): unit tests for auth use cases"
```

---

### Task 5: Integration tests — HttpAuthRepository

**Files:**
- Create: `apps/frontend/src/auth/infrastructure/http-auth.repository.test.ts`

**Step 1: Create the test file**

```ts
// apps/frontend/src/auth/infrastructure/http-auth.repository.test.ts
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
```

**Step 2: Run integration tests**

```bash
cd apps/frontend && pnpm test:integration
```

Expected: all tests in `http-auth.repository.test.ts` pass. If any fail, check whether `httpPost` in `http-client.ts` uses `fetch` directly — it does, so `vi.stubGlobal("fetch", ...)` will intercept it correctly.

**Step 3: Commit**

```bash
git add apps/frontend/src/auth/infrastructure/http-auth.repository.test.ts
git commit -m "test(frontend): integration tests for HttpAuthRepository"
```

---

### Task 6: Integration tests — SignIn page

**Files:**
- Create: `apps/frontend/app/(auth)/signin/page.test.tsx`

**Step 1: Create the test file**

```tsx
// apps/frontend/app/(auth)/signin/page.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppError } from "@/src/shared/domain/errors";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/src/auth", async () => {
  const { AppError } = await import("@/src/shared/domain/errors");
  return {
    loginUseCase: { execute: vi.fn() },
    AppError,
  };
});

// Import after mocks are set up
const { default: SignInPage } = await import("./page");
const { loginUseCase } = await import("@/src/auth");

describe("SignInPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const fillAndSubmit = async (email: string, password: string) => {
    const user = userEvent.setup();
    render(<SignInPage />);
    await user.type(screen.getByLabelText(/email/i), email);
    await user.type(screen.getByLabelText(/password/i), password);
    await user.click(screen.getByRole("button", { name: /sign in/i }));
  };

  it("renders the sign in form", () => {
    render(<SignInPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("redirects to /dashboard on successful login", async () => {
    vi.mocked(loginUseCase.execute).mockResolvedValue(undefined);

    await fillAndSubmit("a@b.com", "secret");

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard"));
  });

  it("displays error message when login fails with AppError", async () => {
    vi.mocked(loginUseCase.execute).mockRejectedValue(new AppError("Invalid credentials", "AUTH_ERROR"));

    await fillAndSubmit("a@b.com", "wrong");

    await waitFor(() => expect(screen.getByText("Invalid credentials")).toBeInTheDocument());
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("displays fallback error message for unexpected errors", async () => {
    vi.mocked(loginUseCase.execute).mockRejectedValue(new Error("unexpected"));

    await fillAndSubmit("a@b.com", "secret");

    await waitFor(() => expect(screen.getByText("Something went wrong")).toBeInTheDocument());
  });
});
```

**Step 2: Run the test**

```bash
cd apps/frontend && pnpm test:integration
```

Expected: 4 tests pass for the signin page.

If you see an error about dynamic `import()` in `vi.mock` factory, replace the top-level `await import("./page")` with a regular static import at the top of the file:

```ts
import SignInPage from "./page";
import { loginUseCase } from "@/src/auth";
```

(The `vi.mock` calls are hoisted before imports automatically by Vitest.)

**Step 3: Commit**

```bash
git add "apps/frontend/app/(auth)/signin/page.test.tsx"
git commit -m "test(frontend): integration tests for SignIn page"
```

---

### Task 7: Integration tests — SignUp page

**Files:**
- Create: `apps/frontend/app/(auth)/signup/page.test.tsx`

**Step 1: Create the test file**

```tsx
// apps/frontend/app/(auth)/signup/page.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignUpPage from "./page";
import { registerUseCase } from "@/src/auth";
import { AppError } from "@/src/shared/domain/errors";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/src/auth", async () => {
  const { AppError } = await import("@/src/shared/domain/errors");
  return {
    registerUseCase: { execute: vi.fn() },
    AppError,
  };
});

describe("SignUpPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const fillAndSubmit = async (email: string, password: string, name?: string) => {
    const user = userEvent.setup();
    render(<SignUpPage />);
    if (name) await user.type(screen.getByLabelText(/name/i), name);
    await user.type(screen.getByLabelText(/email/i), email);
    await user.type(screen.getByLabelText(/password/i), password);
    await user.click(screen.getByRole("button", { name: /sign up/i }));
  };

  it("renders the sign up form", () => {
    render(<SignUpPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign up/i })).toBeInTheDocument();
  });

  it("redirects to /dashboard on successful registration", async () => {
    vi.mocked(registerUseCase.execute).mockResolvedValue(undefined);

    await fillAndSubmit("a@b.com", "password123", "Alice");

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard"));
  });

  it("displays error message when registration fails with AppError", async () => {
    vi.mocked(registerUseCase.execute).mockRejectedValue(
      new AppError("Email already registered", "EMAIL_ALREADY_REGISTERED")
    );

    await fillAndSubmit("a@b.com", "password123");

    await waitFor(() => expect(screen.getByText("Email already registered")).toBeInTheDocument());
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("displays fallback error message for unexpected errors", async () => {
    vi.mocked(registerUseCase.execute).mockRejectedValue(new Error("unexpected"));

    await fillAndSubmit("a@b.com", "password123");

    await waitFor(() => expect(screen.getByText("Something went wrong")).toBeInTheDocument());
  });
});
```

**Step 2: Run all tests**

```bash
cd apps/frontend && pnpm test
```

Expected: all tests pass — 9 unit + repository integration + 4 signin + 4 signup.

**Step 3: Commit**

```bash
git add "apps/frontend/app/(auth)/signup/page.test.tsx"
git commit -m "test(frontend): integration tests for SignUp page"
```

---

### Task 8: Final verification

**Step 1: Run unit tests in isolation**

```bash
cd apps/frontend && pnpm test:unit
```

Expected: 9 tests pass.

**Step 2: Run integration tests in isolation**

```bash
cd apps/frontend && pnpm test:integration
```

Expected: all infrastructure and page tests pass.

**Step 3: Run all tests via Turborepo**

```bash
pnpm turbo test --filter=frontend
```

Expected: task completes successfully and result is cached.

**Step 4: Confirm check-types still passes**

```bash
pnpm turbo check-types --filter=frontend
```

Expected: no TypeScript errors.
