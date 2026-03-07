# Frontend Auth Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add sign-in, sign-up, and dashboard pages to the frontend Next.js app, proxying auth requests to the backend via Next.js route handlers with HttpOnly cookie storage.

**Architecture:** BFF proxy pattern. Next.js route handlers forward auth requests to the backend (via `BACKEND_URL` env var — Railway internal network in prod). Tokens are stored as HttpOnly cookies, never exposed to client JS. Next.js middleware protects routes.

**Tech Stack:** Next.js 16 App Router, React 19, CSS Modules, built-in `fetch` and `cookies()` API. No new dependencies.

**Backend API contracts (already implemented):**
- `POST /auth/register` — body: `{ email, password, name? }` → `{ accessToken, refreshToken }`
- `POST /auth/login` — body: `{ email, password }` → `{ accessToken, refreshToken }`
- `POST /auth/refresh` — body: `{ refreshToken }` → `{ accessToken, refreshToken }`
- `POST /auth/logout` — header: `Authorization: Bearer <accessToken>` → `{ message }`
- Errors: 400 (validation), 401 (bad credentials/token), 409 (duplicate email)

---

### Task 1: API Proxy Utility + Register Route Handler

**Files:**
- Create: `apps/frontend/app/api/auth/_lib/proxy.ts`
- Create: `apps/frontend/app/api/auth/register/route.ts`

**Context:** The proxy utility is the core of the BFF pattern. It forwards requests to the backend, and for auth endpoints, extracts tokens from the backend response and sets them as HttpOnly cookies. The register route is the first consumer.

**Step 1: Create the proxy utility**

Create `apps/frontend/app/api/auth/_lib/proxy.ts`. This module:
- Reads `BACKEND_URL` from `process.env` (default `http://localhost:3000`)
- Has a `proxyAuthRequest(backendPath, body)` function that:
  - Calls `fetch(BACKEND_URL + backendPath, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })`
  - If backend returns non-OK, returns `NextResponse.json(errorBody, { status })` passing through the backend error
  - If OK, reads `{ accessToken, refreshToken }` from backend response
  - Sets both as HttpOnly cookies using `cookies()` from `next/headers`:
    - `accessToken`: httpOnly, secure (in prod), sameSite lax, path `/`, maxAge from env or 900 (15min)
    - `refreshToken`: httpOnly, secure (in prod), sameSite lax, path `/api/auth`, maxAge from env or 604800 (7 days)
  - Returns `NextResponse.json({ success: true })` (no tokens in response body)
- Has a `proxyWithAuth(backendPath, method, body?)` function that:
  - Reads `accessToken` from cookies
  - Calls the backend with `Authorization: Bearer <accessToken>`
  - Returns the backend response as-is

```typescript
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

export async function proxyAuthRequest(
  backendPath: string,
  body: Record<string, unknown>
) {
  const res = await fetch(`${BACKEND_URL}${backendPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }

  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === "production";

  cookieStore.set("accessToken", data.accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 900, // 15 minutes
  });

  cookieStore.set("refreshToken", data.refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 604800, // 7 days
  });

  return NextResponse.json({ success: true });
}

export async function proxyWithAuth(backendPath: string) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;

  if (!accessToken) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const res = await fetch(`${BACKEND_URL}${backendPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
```

**Step 2: Create the register route handler**

Create `apps/frontend/app/api/auth/register/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { proxyAuthRequest } from "../_lib/proxy";

export async function POST(request: NextRequest) {
  const body = await request.json();
  return proxyAuthRequest("/auth/register", body);
}
```

**Step 3: Commit**

```bash
git add apps/frontend/app/api/auth/_lib/proxy.ts apps/frontend/app/api/auth/register/route.ts
git commit -m "feat(frontend): add auth proxy utility and register route handler"
```

---

### Task 2: Login, Refresh, Logout, and Me Route Handlers

**Files:**
- Create: `apps/frontend/app/api/auth/login/route.ts`
- Create: `apps/frontend/app/api/auth/refresh/route.ts`
- Create: `apps/frontend/app/api/auth/logout/route.ts`
- Create: `apps/frontend/app/api/auth/me/route.ts`

**Context:** These follow the same pattern as register. Login and refresh use `proxyAuthRequest` (they return tokens). Logout uses `proxyWithAuth` and clears cookies. Me decodes the JWT to return user info without hitting the backend.

**Step 1: Create login route handler**

```typescript
// apps/frontend/app/api/auth/login/route.ts
import { NextRequest } from "next/server";
import { proxyAuthRequest } from "../_lib/proxy";

export async function POST(request: NextRequest) {
  const body = await request.json();
  return proxyAuthRequest("/auth/login", body);
}
```

**Step 2: Create refresh route handler**

```typescript
// apps/frontend/app/api/auth/refresh/route.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { proxyAuthRequest } from "../_lib/proxy";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("refreshToken")?.value;

  if (!refreshToken) {
    return NextResponse.json(
      { message: "No refresh token" },
      { status: 401 }
    );
  }

  return proxyAuthRequest("/auth/refresh", { refreshToken });
}
```

**Step 3: Create logout route handler**

```typescript
// apps/frontend/app/api/auth/logout/route.ts
import { cookies } from "next/headers";
import { proxyWithAuth } from "../_lib/proxy";

export async function POST() {
  const response = await proxyWithAuth("/auth/logout");

  const cookieStore = await cookies();
  cookieStore.delete("accessToken");
  cookieStore.delete("refreshToken");

  return response;
}
```

**Step 4: Create me route handler**

This decodes the JWT payload (without verifying — the backend already verified it when issued). It extracts `sub` (userId) and `email` from the token.

```typescript
// apps/frontend/app/api/auth/me/route.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { message: "Not authenticated" },
      { status: 401 }
    );
  }

  try {
    const payload = JSON.parse(
      Buffer.from(accessToken.split(".")[1], "base64url").toString()
    );
    return NextResponse.json({
      userId: payload.sub,
      email: payload.email,
    });
  } catch {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }
}
```

**Step 5: Commit**

```bash
git add apps/frontend/app/api/auth/login/route.ts apps/frontend/app/api/auth/refresh/route.ts apps/frontend/app/api/auth/logout/route.ts apps/frontend/app/api/auth/me/route.ts
git commit -m "feat(frontend): add login, refresh, logout, and me route handlers"
```

---

### Task 3: Next.js Middleware for Route Protection

**Files:**
- Create: `apps/frontend/middleware.ts`

**Context:** Next.js middleware runs before every request. We use it to:
- Redirect unauthenticated users away from protected routes (`/dashboard`) to `/signin`
- Redirect authenticated users away from auth pages (`/signin`, `/signup`) to `/dashboard`

The middleware checks for the `accessToken` cookie existence (lightweight check — actual validation happens when API calls are made).

**Step 1: Create middleware**

```typescript
// apps/frontend/middleware.ts
import { NextRequest, NextResponse } from "next/server";

const protectedRoutes = ["/dashboard"];
const authRoutes = ["/signin", "/signup"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get("accessToken")?.value;

  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  if (isProtected && !accessToken) {
    return NextResponse.redirect(new URL("/signin", request.url));
  }

  if (isAuthRoute && accessToken) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/signin", "/signup"],
};
```

**Step 2: Commit**

```bash
git add apps/frontend/middleware.ts
git commit -m "feat(frontend): add middleware for auth route protection"
```

---

### Task 4: Sign Up Page

**Files:**
- Create: `apps/frontend/app/signup/page.tsx`
- Create: `apps/frontend/app/signup/signup.module.css`

**Context:** A client component with a form. On submit, it POSTs to `/api/auth/register`. On success, redirects to `/dashboard`. Shows validation errors from the backend.

**Step 1: Create signup page styles**

```css
/* apps/frontend/app/signup/signup.module.css */
.container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 1rem;
}

.card {
  width: 100%;
  max-width: 400px;
  padding: 2rem;
  border: 1px solid #ddd;
  border-radius: 8px;
}

@media (prefers-color-scheme: dark) {
  .card {
    border-color: #333;
  }
}

.title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
  text-align: center;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.label {
  font-size: 0.875rem;
  font-weight: 500;
}

.input {
  padding: 0.5rem 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  font-family: inherit;
  background: var(--background);
  color: var(--foreground);
}

@media (prefers-color-scheme: dark) {
  .input {
    border-color: #555;
  }
}

.input:focus {
  outline: 2px solid #0070f3;
  outline-offset: -1px;
}

.button {
  padding: 0.625rem;
  background: #0070f3;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  font-family: inherit;
  cursor: pointer;
  margin-top: 0.5rem;
}

.button:hover {
  background: #005bb5;
}

.button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: #e00;
  font-size: 0.875rem;
  text-align: center;
}

.link {
  text-align: center;
  font-size: 0.875rem;
  margin-top: 1rem;
}

.link a {
  color: #0070f3;
  text-decoration: underline;
}
```

**Step 2: Create signup page**

```tsx
// apps/frontend/app/signup/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
    const body = {
      email: formData.get("email"),
      password: formData.get("password"),
      name: formData.get("name") || undefined,
    };

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? "Registration failed");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Sign Up</h1>
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
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add apps/frontend/app/signup/
git commit -m "feat(frontend): add sign up page"
```

---

### Task 5: Sign In Page

**Files:**
- Create: `apps/frontend/app/signin/page.tsx`
- Create: `apps/frontend/app/signin/signin.module.css`

**Context:** Same pattern as signup but for login. POSTs to `/api/auth/login`.

**Step 1: Create signin page styles**

The signin styles are identical to signup styles. Create `apps/frontend/app/signin/signin.module.css` with the same CSS content as the signup module (copy from Task 4 Step 1).

**Step 2: Create signin page**

```tsx
// apps/frontend/app/signin/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
    const body = {
      email: formData.get("email"),
      password: formData.get("password"),
    };

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? "Invalid credentials");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Sign In</h1>
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
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add apps/frontend/app/signin/
git commit -m "feat(frontend): add sign in page"
```

---

### Task 6: Dashboard Page

**Files:**
- Create: `apps/frontend/app/dashboard/page.tsx`
- Create: `apps/frontend/app/dashboard/dashboard.module.css`

**Context:** Protected page. Calls `/api/auth/me` to get user info. Shows email and a logout button. Logout calls `/api/auth/logout` then redirects to `/signin`.

**Step 1: Create dashboard styles**

```css
/* apps/frontend/app/dashboard/dashboard.module.css */
.container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 1rem;
}

.card {
  width: 100%;
  max-width: 480px;
  padding: 2rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  text-align: center;
}

@media (prefers-color-scheme: dark) {
  .card {
    border-color: #333;
  }
}

.title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.email {
  font-size: 0.875rem;
  color: #666;
  margin-bottom: 2rem;
}

@media (prefers-color-scheme: dark) {
  .email {
    color: #999;
  }
}

.logoutButton {
  padding: 0.5rem 1.5rem;
  background: transparent;
  color: var(--foreground);
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.875rem;
  font-family: inherit;
  cursor: pointer;
}

@media (prefers-color-scheme: dark) {
  .logoutButton {
    border-color: #555;
  }
}

.logoutButton:hover {
  background: #f5f5f5;
}

@media (prefers-color-scheme: dark) {
  .logoutButton:hover {
    background: #1a1a1a;
  }
}
```

**Step 2: Create dashboard page**

```tsx
// apps/frontend/app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./dashboard.module.css";

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) throw new Error("Not authenticated");
        return res.json();
      })
      .then((data) => setEmail(data.email))
      .catch(() => router.push("/signin"));
  }, [router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/signin");
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Dashboard</h1>
        {email && <p className={styles.email}>{email}</p>}
        <button className={styles.logoutButton} onClick={handleLogout}>
          Log out
        </button>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add apps/frontend/app/dashboard/
git commit -m "feat(frontend): add dashboard page with logout"
```

---

### Task 7: Redirect Root Page to Sign In

**Files:**
- Modify: `apps/frontend/app/page.tsx`

**Context:** Update the root page to redirect to `/signin` so there's a clear entry point. The existing Turborepo boilerplate can be replaced with a redirect.

**Step 1: Replace root page with redirect**

Replace the entire content of `apps/frontend/app/page.tsx` with:

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/signin");
}
```

**Step 2: Commit**

```bash
git add apps/frontend/app/page.tsx
git commit -m "feat(frontend): redirect root to signin"
```

---

### Task 8: Type Check and Verify

**Step 1: Run type check**

```bash
cd apps/frontend && pnpm check-types
```

Expected: passes with no errors.

**Step 2: Fix any type errors if found**

**Step 3: Final commit if any fixes were needed**
