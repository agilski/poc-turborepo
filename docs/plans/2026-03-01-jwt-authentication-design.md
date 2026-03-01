# JWT Authentication Design

## Overview

Add JWT authentication to the NestJS backend using Passport.js + @nestjs/jwt with email/password login and refresh token rotation.

## Decisions

- **Approach:** Passport.js strategies (local + JWT) with @nestjs/jwt
- **Password hashing:** bcrypt
- **Refresh token storage:** Database (Prisma), hashed with bcrypt
- **Route protection:** Global JWT guard, `@Public()` decorator to opt out
- **Token pattern:** Two-token (short-lived access + long-lived refresh with rotation)

## Database Schema

```prisma
model User {
  id            String         @id @default(uuid())
  email         String         @unique
  name          String?
  password      String
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  refreshTokens RefreshToken[]
}

model RefreshToken {
  id        String   @id @default(uuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
}
```

## Module Structure

```
src/auth/
├── auth.module.ts
├── auth.controller.ts
├── auth.controller.spec.ts
├── auth.service.ts
├── auth.service.spec.ts
├── strategies/
│   ├── local.strategy.ts
│   └── jwt.strategy.ts
├── guards/
│   ├── local-auth.guard.ts
│   └── jwt-auth.guard.ts
├── decorators/
│   ├── public.decorator.ts
│   └── current-user.decorator.ts
└── dto/
    ├── register.dto.ts
    └── login.dto.ts

test/
└── auth.e2e-spec.ts
```

## Endpoints

| Method | Path             | Auth                | Description                              |
|--------|------------------|---------------------|------------------------------------------|
| POST   | /auth/register   | Public              | Create account, return token pair        |
| POST   | /auth/login      | Public (Local guard) | Validate credentials, return token pair  |
| POST   | /auth/refresh    | Public              | Exchange refresh token for new pair      |
| POST   | /auth/logout     | Protected           | Revoke refresh tokens                   |

## Auth Flows

### Registration

1. Validate input (email, password, optional name)
2. Check email uniqueness (409 Conflict if duplicate)
3. Hash password with bcrypt
4. Create user in DB
5. Generate access token (15 min) + refresh token (7 days)
6. Hash refresh token, store in DB
7. Return { accessToken, refreshToken }

### Login

1. LocalAuthGuard triggers LocalStrategy
2. LocalStrategy validates email + password (bcrypt compare)
3. Generate access token + refresh token
4. Hash refresh token, store in DB
5. Return { accessToken, refreshToken }

### Refresh

1. Receive refresh token in request body
2. Find stored tokens, compare hash with bcrypt
3. Verify not expired
4. Delete old refresh token (rotation)
5. Generate new token pair
6. Hash new refresh token, store in DB
7. Return { accessToken, refreshToken }

### Logout

1. JwtAuthGuard validates access token
2. Delete all refresh tokens for user
3. Return success

### Protected Route Access

1. JwtAuthGuard (global) validates access token
2. JwtStrategy.validate() returns { userId, email }
3. Controller uses @CurrentUser() to extract user from request

## Error Handling

- Duplicate email: 409 Conflict
- Invalid credentials: 401 Unauthorized
- Expired/invalid refresh token: 401 Unauthorized
- Expired access token: 401 Unauthorized
- Missing token on protected route: 401 Unauthorized

## Dependencies

### Production

- @nestjs/passport
- @nestjs/jwt
- passport
- passport-local
- passport-jwt
- bcrypt
- class-validator
- class-transformer

### Dev

- @types/passport-local
- @types/passport-jwt
- @types/bcrypt

## Environment Variables

```env
JWT_ACCESS_SECRET=<random-secret>
JWT_REFRESH_SECRET=<separate-random-secret>
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
```

## Test Coverage

### Unit Tests (auth.service.spec.ts)

- Register with valid credentials creates user and returns tokens
- Register with duplicate email throws ConflictException
- Login with valid credentials returns tokens
- Login with wrong password throws UnauthorizedException
- Refresh with valid token returns new token pair
- Refresh with expired token throws UnauthorizedException
- Logout deletes refresh tokens for user

### Unit Tests (auth.controller.spec.ts)

- Each endpoint delegates to AuthService correctly
- Proper HTTP status codes returned

### E2E Tests (auth.e2e-spec.ts)

- Full registration -> login -> access protected route -> refresh -> logout flow
- Verify expired/revoked tokens are rejected

## Naming Conventions

Per project naming conventions skill:

- **AuthController, AuthService** — domain-specific, acceptable Service/Controller suffix
- **CurrentUser** decorator — descriptive noun, not vague "GetUser"
- **LocalStrategy, JwtStrategy** — pattern suffix (Passport convention)
- **RegisterDto, LoginDto** — verb describes purpose
- **RefreshToken** — singular domain entity
- **refreshTokens** — plural for collection relation
- Boolean fields use question prefix if added (isRevoked, etc.)
