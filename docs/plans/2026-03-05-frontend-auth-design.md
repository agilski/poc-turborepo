# Frontend Auth Pages with API Route Proxy

## Overview

Add sign-in, sign-up, and dashboard pages to the frontend Next.js app, integrating with the existing backend auth API via a BFF (Backend-for-Frontend) proxy pattern. Tokens are stored in HttpOnly cookies for security. The backend stays private (not publicly exposed).

## Architecture

```
Browser (cookies)
  |
Next.js Frontend (public)
  ├── /signin              Sign in page (React form)
  ├── /signup              Sign up page (React form)
  ├── /dashboard           Protected page (empty for now)
  ├── /api/auth/register   Proxy -> backend POST /auth/register
  ├── /api/auth/login      Proxy -> backend POST /auth/login
  ├── /api/auth/refresh    Proxy -> backend POST /auth/refresh
  ├── /api/auth/logout     Proxy -> backend POST /auth/logout
  └── /api/auth/me         Returns user info from JWT cookie
```

## Pages

- `/signin` - Email + password form. On success, sets HttpOnly cookies, redirects to `/dashboard`.
- `/signup` - Email + password + optional name form. Same flow.
- `/dashboard` - Protected. Shows "Welcome, {email}". Logout button. Redirects to `/signin` if unauthenticated.

## API Route Handlers (BFF Proxy)

Each handler under `app/api/auth/`:
- Forwards request body to `BACKEND_URL` via server-side fetch
- On success from auth endpoints: sets `accessToken` and `refreshToken` as HttpOnly, Secure, SameSite=Lax cookies
- Returns clean JSON to browser (no tokens in response body)

## Auth Middleware

Next.js middleware (`middleware.ts`):
- Protected routes (`/dashboard`): redirect to `/signin` if no `accessToken` cookie
- Auth routes (`/signin`, `/signup`): redirect to `/dashboard` if `accessToken` cookie exists

## Token Refresh

When a proxy call gets 401 from backend, it attempts refresh using the `refreshToken` cookie before returning the error. On success, retries the original request with new tokens.

## Styling

CSS Modules (consistent with existing patterns). No new dependencies.

## Environment

- `BACKEND_URL` - `http://localhost:3000` locally, `http://backend.railway.internal:3000` on Railway

## File Structure

```
apps/frontend/
├── middleware.ts
├── app/
│   ├── signin/
│   │   ├── page.tsx
│   │   └── signin.module.css
│   ├── signup/
│   │   ├── page.tsx
│   │   └── signup.module.css
│   ├── dashboard/
│   │   ├── page.tsx
│   │   └── dashboard.module.css
│   └── api/auth/
│       ├── register/route.ts
│       ├── login/route.ts
│       ├── refresh/route.ts
│       ├── logout/route.ts
│       └── me/route.ts
```

## No New Dependencies

Uses built-in Next.js and Web APIs (fetch, cookies(), NextResponse).
