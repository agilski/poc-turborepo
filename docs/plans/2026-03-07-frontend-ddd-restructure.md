# Frontend DDD Restructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure the frontend app into Feature-Sliced DDD layers with route groups, separating domain types, application use cases, and infrastructure adapters from presentation.

**Architecture:** Each feature (starting with `auth`) gets `domain/`, `application/`, `infrastructure/` layers under `src/`. Pages move into Next.js route groups `(auth)/` and `(protected)/`. API routes stay unchanged. Pages become thin presentation that delegates to use cases.

**Tech Stack:** Next.js 16, TypeScript 5.9, CSS Modules

**Design doc:** `docs/plans/2026-03-07-frontend-ddd-restructure-design.md`

---

### Task 1: Configure path alias and create directory scaffolding

**Files:**
- Modify: `apps/frontend/tsconfig.json`
- Create: directory structure under `apps/frontend/src/`

**Step 1: Add path alias to tsconfig.json**

Add `paths` to `compilerOptions` so imports like `@/src/auth/domain/...` resolve correctly:

```json
{
  "extends": "@repo/typescript-config/nextjs.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }],
    "strictNullChecks": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", "next-env.d.ts", "next.config.js", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "e2e"]
}
```

**Step 2: Create directory structure**

```bash
cd apps/frontend
mkdir -p src/auth/domain
mkdir -p src/auth/application
mkdir -p src/auth/infrastructure
mkdir -p src/shared/domain
mkdir -p src/shared/infrastructure
```

**Step 3: Verify TypeScript still compiles**

Run: `cd apps/frontend && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add apps/frontend/tsconfig.json
git commit -m "chore(frontend): add path alias and DDD directory scaffolding"
```

---

### Task 2: Create shared domain layer

**Files:**
- Create: `apps/frontend/src/shared/domain/errors.ts`

**Step 1: Create base AppError class**

```typescript
// apps/frontend/src/shared/domain/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/frontend/src/shared/domain/errors.ts
git commit -m "feat(frontend): add shared domain error base class"
```

---

### Task 3: Create auth domain types and repository port

**Files:**
- Create: `apps/frontend/src/auth/domain/user.entity.ts`
- Create: `apps/frontend/src/auth/domain/credentials.vo.ts`
- Create: `apps/frontend/src/auth/domain/auth.errors.ts`
- Create: `apps/frontend/src/auth/domain/auth.repository.port.ts`

**Step 1: Create User entity**

```typescript
// apps/frontend/src/auth/domain/user.entity.ts
export type User = {
  id: string;
  email: string;
  name?: string;
};
```

**Step 2: Create Credentials value objects**

```typescript
// apps/frontend/src/auth/domain/credentials.vo.ts
export type Credentials = {
  email: string;
  password: string;
};

export type RegisterData = Credentials & {
  name?: string;
};
```

**Step 3: Create auth domain errors**

```typescript
// apps/frontend/src/auth/domain/auth.errors.ts
import { AppError } from "@/src/shared/domain/errors";

export class InvalidCredentialsError extends AppError {
  constructor(message = "Invalid credentials") {
    super(message, "INVALID_CREDENTIALS");
  }
}

export class EmailAlreadyRegisteredError extends AppError {
  constructor(message = "Email already registered") {
    super(message, "EMAIL_ALREADY_REGISTERED");
  }
}

export class NotAuthenticatedError extends AppError {
  constructor() {
    super("Not authenticated", "NOT_AUTHENTICATED");
  }
}

export class AuthServiceUnavailableError extends AppError {
  constructor() {
    super("Something went wrong", "AUTH_SERVICE_UNAVAILABLE");
  }
}
```

**Step 4: Create auth repository port**

```typescript
// apps/frontend/src/auth/domain/auth.repository.port.ts
import type { User } from "./user.entity";
import type { Credentials, RegisterData } from "./credentials.vo";

export interface IAuthRepository {
  login(credentials: Credentials): Promise<void>;
  register(data: RegisterData): Promise<void>;
  logout(): Promise<void>;
  getSession(): Promise<User | null>;
}
```

**Step 5: Verify TypeScript compiles**

Run: `cd apps/frontend && npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add apps/frontend/src/auth/domain/
git commit -m "feat(frontend): add auth domain types, errors, and repository port"
```

---

### Task 4: Create shared HTTP client and auth infrastructure adapter

**Files:**
- Create: `apps/frontend/src/shared/infrastructure/http-client.ts`
- Create: `apps/frontend/src/auth/infrastructure/http-auth.repository.ts`

**Step 1: Create shared HTTP client**

```typescript
// apps/frontend/src/shared/infrastructure/http-client.ts
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly data: Record<string, unknown>,
  ) {
    super(`HTTP ${status}`);
    this.name = "HttpError";
  }
}

export async function httpPost<T = unknown>(
  url: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new HttpError(res.status, data);
  }

  return data as T;
}

export async function httpGet<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok) {
    throw new HttpError(res.status, data);
  }

  return data as T;
}
```

**Step 2: Create auth HTTP adapter**

This implements `IAuthRepository` by calling the existing `/api/auth/*` routes. The API routes (BFF proxy) remain unchanged.

```typescript
// apps/frontend/src/auth/infrastructure/http-auth.repository.ts
import type { IAuthRepository } from "@/src/auth/domain/auth.repository.port";
import type { User } from "@/src/auth/domain/user.entity";
import type { Credentials, RegisterData } from "@/src/auth/domain/credentials.vo";
import { AppError } from "@/src/shared/domain/errors";
import { AuthServiceUnavailableError } from "@/src/auth/domain/auth.errors";
import { httpPost, httpGet, HttpError } from "@/src/shared/infrastructure/http-client";

export class HttpAuthRepository implements IAuthRepository {
  async login(credentials: Credentials): Promise<void> {
    try {
      await httpPost("/api/auth/login", credentials);
    } catch (error) {
      throw this.toAppError(error, "Invalid credentials");
    }
  }

  async register(data: RegisterData): Promise<void> {
    try {
      await httpPost("/api/auth/register", data);
    } catch (error) {
      throw this.toAppError(error, "Registration failed");
    }
  }

  async logout(): Promise<void> {
    await httpPost("/api/auth/logout", {});
  }

  async getSession(): Promise<User | null> {
    try {
      const data = await httpGet<{ userId: string; email: string }>(
        "/api/auth/me",
      );
      return { id: data.userId, email: data.email };
    } catch {
      return null;
    }
  }

  private toAppError(error: unknown, fallback: string): AppError {
    if (error instanceof HttpError) {
      const message = (error.data?.message as string) ?? fallback;
      return new AppError(message, "AUTH_ERROR");
    }
    return new AuthServiceUnavailableError();
  }
}
```

**Step 3: Verify TypeScript compiles**

Run: `cd apps/frontend && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add apps/frontend/src/shared/infrastructure/ apps/frontend/src/auth/infrastructure/
git commit -m "feat(frontend): add HTTP client and auth repository adapter"
```

---

### Task 5: Create auth use cases and barrel export

**Files:**
- Create: `apps/frontend/src/auth/application/login.use-case.ts`
- Create: `apps/frontend/src/auth/application/register.use-case.ts`
- Create: `apps/frontend/src/auth/application/logout.use-case.ts`
- Create: `apps/frontend/src/auth/application/get-session.use-case.ts`
- Create: `apps/frontend/src/auth/index.ts`

**Step 1: Create LoginUseCase**

```typescript
// apps/frontend/src/auth/application/login.use-case.ts
import type { IAuthRepository } from "@/src/auth/domain/auth.repository.port";
import type { Credentials } from "@/src/auth/domain/credentials.vo";

export class LoginUseCase {
  constructor(private readonly authRepository: IAuthRepository) {}

  async execute(credentials: Credentials): Promise<void> {
    await this.authRepository.login(credentials);
  }
}
```

**Step 2: Create RegisterUseCase**

```typescript
// apps/frontend/src/auth/application/register.use-case.ts
import type { IAuthRepository } from "@/src/auth/domain/auth.repository.port";
import type { RegisterData } from "@/src/auth/domain/credentials.vo";

export class RegisterUseCase {
  constructor(private readonly authRepository: IAuthRepository) {}

  async execute(data: RegisterData): Promise<void> {
    await this.authRepository.register(data);
  }
}
```

**Step 3: Create LogoutUseCase**

```typescript
// apps/frontend/src/auth/application/logout.use-case.ts
import type { IAuthRepository } from "@/src/auth/domain/auth.repository.port";

export class LogoutUseCase {
  constructor(private readonly authRepository: IAuthRepository) {}

  async execute(): Promise<void> {
    await this.authRepository.logout();
  }
}
```

**Step 4: Create GetSessionUseCase**

```typescript
// apps/frontend/src/auth/application/get-session.use-case.ts
import type { IAuthRepository } from "@/src/auth/domain/auth.repository.port";
import type { User } from "@/src/auth/domain/user.entity";

export class GetSessionUseCase {
  constructor(private readonly authRepository: IAuthRepository) {}

  async execute(): Promise<User | null> {
    return this.authRepository.getSession();
  }
}
```

**Step 5: Create barrel export with composition root**

This wires the HTTP adapter to the use cases. Pages import from here.

```typescript
// apps/frontend/src/auth/index.ts
import { HttpAuthRepository } from "./infrastructure/http-auth.repository";
import { LoginUseCase } from "./application/login.use-case";
import { RegisterUseCase } from "./application/register.use-case";
import { LogoutUseCase } from "./application/logout.use-case";
import { GetSessionUseCase } from "./application/get-session.use-case";

const authRepository = new HttpAuthRepository();

export const loginUseCase = new LoginUseCase(authRepository);
export const registerUseCase = new RegisterUseCase(authRepository);
export const logoutUseCase = new LogoutUseCase(authRepository);
export const getSessionUseCase = new GetSessionUseCase(authRepository);

export type { User } from "./domain/user.entity";
export type { Credentials, RegisterData } from "./domain/credentials.vo";
export { AppError } from "@/src/shared/domain/errors";
```

**Step 6: Verify TypeScript compiles**

Run: `cd apps/frontend && npx tsc --noEmit`
Expected: No errors

**Step 7: Commit**

```bash
git add apps/frontend/src/auth/application/ apps/frontend/src/auth/index.ts
git commit -m "feat(frontend): add auth use cases and barrel export"
```

---

### Task 6: Move pages into route groups

Move signin/signup into `(auth)/` route group and dashboard into `(protected)/` route group. Create shared auth layout to extract duplicated gradient background styles.

**Files:**
- Create: `apps/frontend/app/(auth)/layout.tsx`
- Create: `apps/frontend/app/(auth)/auth-layout.module.css`
- Move: `apps/frontend/app/signin/` -> `apps/frontend/app/(auth)/signin/`
- Move: `apps/frontend/app/signup/` -> `apps/frontend/app/(auth)/signup/`
- Move: `apps/frontend/app/dashboard/` -> `apps/frontend/app/(protected)/dashboard/`

**Step 1: Create auth layout CSS**

Extract the shared `.page` styles (centering + gradient orbs) from the identical signin/signup CSS modules:

```css
/* apps/frontend/app/(auth)/auth-layout.module.css */
.page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 1.5rem;
  position: relative;
  overflow: hidden;
}

.page::before,
.page::after {
  content: "";
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
}

.page::before {
  top: -15%;
  right: -8%;
  width: 480px;
  height: 480px;
  background: radial-gradient(circle, var(--accent-soft) 0%, transparent 65%);
  filter: blur(60px);
}

.page::after {
  bottom: -10%;
  left: -5%;
  width: 360px;
  height: 360px;
  background: radial-gradient(circle, var(--accent-soft) 0%, transparent 60%);
  filter: blur(50px);
}
```

**Step 2: Create auth layout component**

```tsx
// apps/frontend/app/(auth)/layout.tsx
import styles from "./auth-layout.module.css";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className={styles.page}>{children}</div>;
}
```

**Step 3: Move page directories**

```bash
cd apps/frontend/app
mkdir -p "(auth)"
mkdir -p "(protected)"
mv signin "(auth)/signin"
mv signup "(auth)/signup"
mv dashboard "(protected)/dashboard"
```

**Step 4: Remove `.page` styles from signin and signup CSS modules**

Edit `apps/frontend/app/(auth)/signin/signin.module.css` — remove the `.page`, `.page::before`, and `.page::after` rules (lines 1-36). The layout now provides the page wrapper.

Edit `apps/frontend/app/(auth)/signup/signup.module.css` — same removal.

**Step 5: Update signin page — remove page wrapper div**

The page no longer needs the outer `<div className={styles.page}>` wrapper since the auth layout provides it. Change the root element from:

```tsx
<div className={styles.page}>
  <div className={styles.card}>
    ...
  </div>
</div>
```

To:

```tsx
<div className={styles.card}>
  ...
</div>
```

**Step 6: Update signup page — same change as signin**

Remove the outer `<div className={styles.page}>` wrapper.

**Step 7: Verify TypeScript compiles and build succeeds**

Run: `cd apps/frontend && npx tsc --noEmit && npx next build`
Expected: No errors. Routes still at `/signin`, `/signup`, `/dashboard`.

**Step 8: Commit**

```bash
git add apps/frontend/app/
git commit -m "refactor(frontend): organize pages into (auth) and (protected) route groups"
```

---

### Task 7: Refactor signin page to use LoginUseCase

**Files:**
- Modify: `apps/frontend/app/(auth)/signin/page.tsx`

**Step 1: Replace raw fetch with use case**

```tsx
// apps/frontend/app/(auth)/signin/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginUseCase, AppError } from "@/src/auth";
import styles from "./signin.module.css";

export default function SignInPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    try {
      await loginUseCase.execute({
        email: formData.get("email") as string,
        password: formData.get("password") as string,
      });
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof AppError) {
        setError(err.message);
      } else {
        setError("Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h1 className={styles.title}>Sign In</h1>
        <p className={styles.subtitle}>Welcome back to your account</p>
      </div>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="email">
            Email
          </label>
          <input
            className={styles.input}
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="password">
            Password
          </label>
          <input
            className={styles.input}
            id="password"
            name="password"
            type="password"
            placeholder="Enter your password"
            required
          />
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <button className={styles.button} type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
      <p className={styles.link}>
        Don&apos;t have an account? <a href="/signup">Sign up</a>
      </p>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/frontend/app/\(auth\)/signin/page.tsx
git commit -m "refactor(frontend): signin page uses LoginUseCase"
```

---

### Task 8: Refactor signup page to use RegisterUseCase

**Files:**
- Modify: `apps/frontend/app/(auth)/signup/page.tsx`

**Step 1: Replace raw fetch with use case**

```tsx
// apps/frontend/app/(auth)/signup/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registerUseCase, AppError } from "@/src/auth";
import styles from "./signup.module.css";

export default function SignUpPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    try {
      await registerUseCase.execute({
        email: formData.get("email") as string,
        password: formData.get("password") as string,
        name: (formData.get("name") as string) || undefined,
      });
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof AppError) {
        setError(err.message);
      } else {
        setError("Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h1 className={styles.title}>Sign Up</h1>
        <p className={styles.subtitle}>Create your account to get started</p>
      </div>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="name">
            Name (optional)
          </label>
          <input
            className={styles.input}
            id="name"
            name="name"
            type="text"
            placeholder="Your name"
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="email">
            Email
          </label>
          <input
            className={styles.input}
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="password">
            Password
          </label>
          <input
            className={styles.input}
            id="password"
            name="password"
            type="password"
            placeholder="Min 8 characters"
            minLength={8}
            required
          />
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <button className={styles.button} type="submit" disabled={loading}>
          {loading ? "Signing up..." : "Sign Up"}
        </button>
      </form>
      <p className={styles.link}>
        Already have an account? <a href="/signin">Sign in</a>
      </p>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/frontend/app/\(auth\)/signup/page.tsx
git commit -m "refactor(frontend): signup page uses RegisterUseCase"
```

---

### Task 9: Refactor dashboard page to use use cases

**Files:**
- Modify: `apps/frontend/app/(protected)/dashboard/page.tsx`

**Step 1: Replace raw fetch with use cases**

```tsx
// apps/frontend/app/(protected)/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSessionUseCase, logoutUseCase } from "@/src/auth";
import styles from "./dashboard.module.css";

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  useEffect(() => {
    getSessionUseCase
      .execute()
      .then((user) => {
        if (!user) {
          router.push("/signin");
          return;
        }
        setEmail(user.email);
      })
      .catch(() => router.push("/signin"));
  }, [router]);

  async function handleLogout() {
    await logoutUseCase.execute();
    router.push("/signin");
  }

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <span className={styles.brand}>
            <span className={styles.brandMark}>&#10022;</span>
            App
          </span>
          <button className={styles.logoutButton} onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>
      <main className={styles.main}>
        <div className={styles.card}>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>Welcome to your workspace</p>
          {email && <p className={styles.email}>{email}</p>}
        </div>
      </main>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/frontend/app/\(protected\)/dashboard/page.tsx
git commit -m "refactor(frontend): dashboard page uses auth use cases"
```

---

### Task 10: Final verification

**Step 1: Type check**

Run: `cd apps/frontend && npx tsc --noEmit`
Expected: No errors

**Step 2: Build**

Run: `cd apps/frontend && npx next build`
Expected: Successful build. Routes should show:
- `/` (static)
- `/signin` (static)
- `/signup` (static)
- `/dashboard` (static)
- `/api/auth/*` (dynamic)

**Step 3: Run e2e tests**

Run: `cd apps/frontend && pnpm test:e2e`
Expected: All smoke tests and auth flow tests pass. URLs unchanged, selectors unchanged.

**Step 4: Clean up old directories if any remain**

Verify `apps/frontend/app/signin/`, `apps/frontend/app/signup/`, `apps/frontend/app/dashboard/` no longer exist (they were moved, not copied).

**Step 5: Final commit if any cleanup was needed**

```bash
git add -A apps/frontend/
git commit -m "chore(frontend): clean up after DDD restructure"
```
