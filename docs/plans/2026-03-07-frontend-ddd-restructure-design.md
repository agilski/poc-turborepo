# Frontend DDD Restructure Design

**Date:** 2026-03-07
**Status:** Approved

## Context

The frontend is a Next.js 16 app with auth pages (signin, signup, dashboard), API proxy routes to a NestJS backend, and cookie-based session management. Business logic (fetch calls, error handling, navigation) is embedded directly in page components. As more domains are planned, the codebase needs a scalable structure with clear separation of concerns.

## Decisions

- **Approach:** Feature-Sliced DDD — each domain gets its own `domain/`, `application/`, `infrastructure/` layers
- **Location:** `src/` alongside `app/` — clean separation between framework routing and business logic
- **API routes:** Stay in `app/api/` unchanged (Next.js convention, BFF proxy layer)
- **Page grouping:** Next.js route groups — `(auth)/` for signin/signup, `(protected)/` for dashboard
- **Port naming:** `.port.ts` suffix for all interfaces in the domain layer
- **Adapter naming:** Transport prefix (e.g., `http-`, `ws-`, `local-`)

## Directory Structure

```
apps/frontend/
├── app/                                    # Presentation layer (Next.js routing)
│   ├── layout.tsx                          # Root layout (fonts, globals)
│   ├── page.tsx                            # "/" -> redirect to /signin
│   ├── globals.css
│   ├── (auth)/                             # Auth route group (no URL segment)
│   │   ├── layout.tsx                      # Shared auth layout (centered card + gradient bg)
│   │   ├── signin/
│   │   │   ├── page.tsx                    # /signin
│   │   │   └── signin.module.css
│   │   └── signup/
│   │       ├── page.tsx                    # /signup
│   │       └── signup.module.css
│   ├── (protected)/                        # Protected route group
│   │   └── dashboard/
│   │       ├── page.tsx                    # /dashboard
│   │       └── dashboard.module.css
│   └── api/auth/                           # BFF proxy (unchanged)
│       ├── _lib/proxy.ts
│       ├── login/route.ts
│       ├── register/route.ts
│       ├── me/route.ts
│       ├── logout/route.ts
│       └── refresh/route.ts
├── src/
│   ├── auth/
│   │   ├── domain/
│   │   │   ├── user.entity.ts              # User type { id, email, name? }
│   │   │   ├── credentials.vo.ts           # Credentials, RegisterData value objects
│   │   │   ├── auth.repository.port.ts     # IAuthRepository interface (port)
│   │   │   └── auth.errors.ts              # InvalidCredentials, EmailAlreadyRegistered
│   │   ├── application/
│   │   │   ├── login.use-case.ts           # LoginUseCase
│   │   │   ├── register.use-case.ts        # RegisterUseCase
│   │   │   ├── logout.use-case.ts          # LogoutUseCase
│   │   │   └── get-session.use-case.ts     # GetSessionUseCase
│   │   └── infrastructure/
│   │       └── http-auth.repository.ts     # Implements IAuthRepository via fetch
│   └── shared/
│       ├── domain/
│       │   └── errors.ts                   # Base AppError class
│       └── infrastructure/
│           └── http-client.ts              # Shared fetch wrapper with error handling
├── middleware.ts                            # Route protection (unchanged)
└── e2e/                                    # E2E tests (unchanged)
```

## Data Flow

Login example:

```
1. User submits form on /signin
       |
2. SignInPage (presentation) calls loginUseCase.execute(credentials)
       |
3. LoginUseCase (application) calls authRepository.login(credentials)
       |
4. HttpAuthRepository (infrastructure) -> fetch("/api/auth/login", body)
       |
5. API Route (BFF) -> proxy to NestJS backend (unchanged)
       |
6. Response flows back:
   - HttpAuthRepository returns User or throws domain error
   - LoginUseCase returns User or error to page
   - Page navigates to /dashboard or shows error
```

## Dependency Rule

```
Infrastructure -> Application -> Domain
   (adapters)     (use cases)    (core)
```

- Pages import from `application/` (use cases)
- Use cases import from `domain/` (types, ports)
- Infrastructure implements `domain/` ports
- Domain imports nothing from outer layers

## Domain Types

```typescript
// domain/user.entity.ts
type User = { id: string; email: string; name?: string }

// domain/credentials.vo.ts
type Credentials = { email: string; password: string }
type RegisterData = Credentials & { name?: string }

// domain/auth.repository.port.ts (PORT)
interface IAuthRepository {
  login(credentials: Credentials): Promise<User>
  register(data: RegisterData): Promise<User>
  logout(): Promise<void>
  getSession(): Promise<User | null>
}

// domain/auth.errors.ts
class InvalidCredentialsError extends AppError { ... }
class EmailAlreadyRegisteredError extends AppError { ... }
```

## What Changes vs. Stays the Same

| Component | Change? | Details |
|-----------|---------|---------|
| API routes (app/api/auth/) | No change | BFF proxy stays as-is |
| Middleware | No change | Same cookie-based route protection |
| E2E tests | No change | URLs unchanged, selectors unchanged |
| Page components | Refactored | Extract fetch logic into use cases |
| CSS modules | Moved | Into route groups, shared auth layout |
| Business types | New | Domain types extracted from inline code |
| Use cases | New | Extracted from page components |
| Auth repository | New | Interface (port) + HTTP adapter |

## Route Group Benefits

- `(auth)/layout.tsx` extracts the shared centered-card + gradient-orb background (currently duplicated in signin and signup CSS)
- `(protected)/` groups pages that require authentication
- URLs remain unchanged: /signin, /signup, /dashboard
