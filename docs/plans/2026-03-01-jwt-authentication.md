# JWT Authentication Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add JWT authentication with refresh token rotation to the NestJS backend.

**Architecture:** Passport.js strategies (local for login, JWT for route protection) with @nestjs/jwt for token signing. Global JWT guard protects all routes by default; `@Public()` decorator opts out. Refresh tokens stored hashed in PostgreSQL via Prisma.

**Tech Stack:** NestJS 10, Passport.js, @nestjs/jwt, bcrypt, class-validator, Prisma 6, PostgreSQL

---

### Task 1: Install dependencies

**Files:**
- Modify: `apps/backend/package.json`

**Step 1: Install production dependencies**

Run from `apps/backend/`:
```bash
pnpm add @nestjs/passport @nestjs/jwt passport passport-local passport-jwt bcrypt class-validator class-transformer @nestjs/config
```

**Step 2: Install dev dependencies**

Run from `apps/backend/`:
```bash
pnpm add -D @types/passport-local @types/passport-jwt @types/bcrypt
```

**Step 3: Verify installation**

Run: `pnpm ls @nestjs/passport @nestjs/jwt passport passport-local passport-jwt bcrypt class-validator class-transformer @nestjs/config`
Expected: All packages listed with versions

**Step 4: Commit**

```bash
git add apps/backend/package.json pnpm-lock.yaml
git commit -m "feat(auth): add JWT and Passport dependencies"
```

---

### Task 2: Update Prisma schema and generate client

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`

**Step 1: Update the schema**

Replace the contents of `apps/backend/prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

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

Key changes from existing schema:
- `User`: changed `id` from `Int @default(autoincrement())` to `String @default(uuid())`, added `password String` field and `refreshTokens` relation
- `RefreshToken`: new model with UUID ids

**Step 2: Generate Prisma client**

Run from `apps/backend/`:
```bash
pnpm prisma:generate
```
Expected: "Generated Prisma Client"

**Step 3: Create migration**

Run from `apps/backend/`:
```bash
pnpm prisma:migrate --name add-auth-fields
```
Expected: Migration created and applied

**Step 4: Commit**

```bash
git add apps/backend/prisma/
git commit -m "feat(auth): add password field and RefreshToken model to schema"
```

---

### Task 3: Create DTOs with validation

**Files:**
- Create: `apps/backend/src/auth/dto/register.dto.ts`
- Create: `apps/backend/src/auth/dto/login.dto.ts`
- Create: `apps/backend/src/auth/dto/refresh-token.dto.ts`

**Step 1: Create RegisterDto**

Create `apps/backend/src/auth/dto/register.dto.ts`:

```typescript
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsOptional()
  name?: string;
}
```

**Step 2: Create LoginDto**

Create `apps/backend/src/auth/dto/login.dto.ts`:

```typescript
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
```

**Step 3: Create RefreshTokenDto**

Create `apps/backend/src/auth/dto/refresh-token.dto.ts`:

```typescript
import { IsString } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}
```

**Step 4: Commit**

```bash
git add apps/backend/src/auth/dto/
git commit -m "feat(auth): add register, login, and refresh token DTOs"
```

---

### Task 4: Create decorators

**Files:**
- Create: `apps/backend/src/auth/decorators/public.decorator.ts`
- Create: `apps/backend/src/auth/decorators/current-user.decorator.ts`

**Step 1: Create Public decorator**

Create `apps/backend/src/auth/decorators/public.decorator.ts`:

```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

**Step 2: Create CurrentUser decorator**

Create `apps/backend/src/auth/decorators/current-user.decorator.ts`:

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

**Step 3: Commit**

```bash
git add apps/backend/src/auth/decorators/
git commit -m "feat(auth): add Public and CurrentUser decorators"
```

---

### Task 5: Write AuthService failing tests

**Files:**
- Create: `apps/backend/src/auth/auth.service.spec.ts`

**Step 1: Write the failing tests**

Create `apps/backend/src/auth/auth.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let authService: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const mockJwtService = {
    signAsync: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        JWT_ACCESS_SECRET: 'test-access-secret',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        JWT_ACCESS_EXPIRATION: '15m',
        JWT_REFRESH_EXPIRATION: '7d',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);

    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = { email: 'test@example.com', password: 'password123', name: 'Test' };

    it('should create a user and return tokens', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({ id: 'user-uuid-1', email: 'test@example.com', name: 'Test' });
      mockPrismaService.refreshToken.create.mockResolvedValue({});
      mockJwtService.signAsync.mockResolvedValueOnce('access-token').mockResolvedValueOnce('refresh-token');

      const result = await authService.register(registerDto);

      expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
      expect(mockPrismaService.user.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-uuid-1', email: 'test@example.com' });

      await expect(authService.register(registerDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('validateUser', () => {
    it('should return user without password if credentials are valid', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-uuid-1',
        email: 'test@example.com',
        name: 'Test',
        password: hashedPassword,
      });

      const result = await authService.validateUser('test@example.com', 'password123');

      expect(result).toEqual({ id: 'user-uuid-1', email: 'test@example.com', name: 'Test' });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(authService.validateUser('test@example.com', 'password123')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if password is wrong', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-uuid-1',
        email: 'test@example.com',
        password: hashedPassword,
      });

      await expect(authService.validateUser('test@example.com', 'wrongpassword')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('login', () => {
    it('should return tokens for a valid user', async () => {
      const user = { id: 'user-uuid-1', email: 'test@example.com' };
      mockJwtService.signAsync.mockResolvedValueOnce('access-token').mockResolvedValueOnce('refresh-token');
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await authService.login(user);

      expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    });
  });

  describe('refreshTokens', () => {
    it('should return new token pair for valid refresh token', async () => {
      const hashedToken = await bcrypt.hash('valid-refresh-token', 10);
      mockPrismaService.refreshToken.findMany.mockResolvedValue([
        {
          id: 'token-uuid-1',
          token: hashedToken,
          userId: 'user-uuid-1',
          expiresAt: new Date(Date.now() + 86400000),
          user: { id: 'user-uuid-1', email: 'test@example.com' },
        },
      ]);
      mockPrismaService.refreshToken.delete.mockResolvedValue({});
      mockPrismaService.refreshToken.create.mockResolvedValue({});
      mockJwtService.signAsync.mockResolvedValueOnce('new-access-token').mockResolvedValueOnce('new-refresh-token');

      const result = await authService.refreshTokens('valid-refresh-token');

      expect(result).toEqual({ accessToken: 'new-access-token', refreshToken: 'new-refresh-token' });
      expect(mockPrismaService.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'token-uuid-1' } });
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      mockPrismaService.refreshToken.findMany.mockResolvedValue([]);

      await expect(authService.refreshTokens('invalid-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should delete all refresh tokens for user', async () => {
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 2 });

      await authService.logout('user-uuid-1');

      expect(mockPrismaService.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-uuid-1' } });
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run from `apps/backend/`:
```bash
pnpm test -- --testPathPattern=auth.service.spec
```
Expected: FAIL — `Cannot find module './auth.service'`

**Step 3: Commit**

```bash
git add apps/backend/src/auth/auth.service.spec.ts
git commit -m "test(auth): add AuthService unit tests (red)"
```

---

### Task 6: Implement AuthService

**Files:**
- Create: `apps/backend/src/auth/auth.service.ts`

**Step 1: Write the implementation**

Create `apps/backend/src/auth/auth.service.ts`:

```typescript
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        password: hashedPassword,
        name: registerDto.name,
      },
    });

    return this.generateTokens({ id: user.id, email: user.email });
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async login(user: { id: string; email: string }) {
    return this.generateTokens(user);
  }

  async refreshTokens(refreshToken: string) {
    const storedTokens = await this.prisma.refreshToken.findMany({
      include: { user: true },
    });

    let matchedToken: (typeof storedTokens)[number] | null = null;

    for (const stored of storedTokens) {
      const isMatch = await bcrypt.compare(refreshToken, stored.token);
      if (isMatch) {
        matchedToken = stored;
        break;
      }
    }

    if (!matchedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (matchedToken.expiresAt < new Date()) {
      await this.prisma.refreshToken.delete({ where: { id: matchedToken.id } });
      throw new UnauthorizedException('Refresh token expired');
    }

    await this.prisma.refreshToken.delete({ where: { id: matchedToken.id } });

    return this.generateTokens({ id: matchedToken.user.id, email: matchedToken.user.email });
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  private async generateTokens(user: { id: string; email: string }) {
    const payload = { sub: user.id, email: user.email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRATION'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION'),
      }),
    ]);

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    await this.prisma.refreshToken.create({
      data: {
        token: hashedRefreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken };
  }
}
```

**Step 2: Run tests to verify they pass**

Run from `apps/backend/`:
```bash
pnpm test -- --testPathPattern=auth.service.spec
```
Expected: All 7 tests PASS

**Step 3: Commit**

```bash
git add apps/backend/src/auth/auth.service.ts
git commit -m "feat(auth): implement AuthService with register, login, refresh, logout"
```

---

### Task 7: Create Passport strategies

**Files:**
- Create: `apps/backend/src/auth/strategies/local.strategy.ts`
- Create: `apps/backend/src/auth/strategies/jwt.strategy.ts`

**Step 1: Create LocalStrategy**

Create `apps/backend/src/auth/strategies/local.strategy.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string) {
    return this.authService.validateUser(email, password);
  }
}
```

**Step 2: Create JwtStrategy**

Create `apps/backend/src/auth/strategies/jwt.strategy.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: { sub: string; email: string }) {
    return { userId: payload.sub, email: payload.email };
  }
}
```

**Step 3: Commit**

```bash
git add apps/backend/src/auth/strategies/
git commit -m "feat(auth): add Local and JWT Passport strategies"
```

---

### Task 8: Create guards

**Files:**
- Create: `apps/backend/src/auth/guards/local-auth.guard.ts`
- Create: `apps/backend/src/auth/guards/jwt-auth.guard.ts`

**Step 1: Create LocalAuthGuard**

Create `apps/backend/src/auth/guards/local-auth.guard.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
```

**Step 2: Create JwtAuthGuard**

Create `apps/backend/src/auth/guards/jwt-auth.guard.ts`:

```typescript
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }
}
```

**Step 3: Commit**

```bash
git add apps/backend/src/auth/guards/
git commit -m "feat(auth): add LocalAuth and JwtAuth guards with Public route support"
```

---

### Task 9: Write AuthController failing tests

**Files:**
- Create: `apps/backend/src/auth/auth.controller.spec.ts`

**Step 1: Write failing tests**

Create `apps/backend/src/auth/auth.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let authController: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    refreshTokens: jest.fn(),
    logout: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    authController = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should call authService.register and return tokens', async () => {
      const dto = { email: 'test@example.com', password: 'password123' };
      const tokens = { accessToken: 'access', refreshToken: 'refresh' };
      mockAuthService.register.mockResolvedValue(tokens);

      const result = await authController.register(dto);

      expect(result).toEqual(tokens);
      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
    });
  });

  describe('login', () => {
    it('should call authService.login with the user from request', async () => {
      const user = { id: 'user-uuid-1', email: 'test@example.com' };
      const tokens = { accessToken: 'access', refreshToken: 'refresh' };
      mockAuthService.login.mockResolvedValue(tokens);

      const result = await authController.login({ user } as any);

      expect(result).toEqual(tokens);
      expect(mockAuthService.login).toHaveBeenCalledWith(user);
    });
  });

  describe('refresh', () => {
    it('should call authService.refreshTokens with the token', async () => {
      const dto = { refreshToken: 'valid-token' };
      const tokens = { accessToken: 'new-access', refreshToken: 'new-refresh' };
      mockAuthService.refreshTokens.mockResolvedValue(tokens);

      const result = await authController.refresh(dto);

      expect(result).toEqual(tokens);
      expect(mockAuthService.refreshTokens).toHaveBeenCalledWith('valid-token');
    });
  });

  describe('logout', () => {
    it('should call authService.logout with the user id', async () => {
      const user = { userId: 'user-uuid-1', email: 'test@example.com' };
      mockAuthService.logout.mockResolvedValue(undefined);

      const result = await authController.logout(user);

      expect(result).toEqual({ message: 'Logged out successfully' });
      expect(mockAuthService.logout).toHaveBeenCalledWith('user-uuid-1');
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run from `apps/backend/`:
```bash
pnpm test -- --testPathPattern=auth.controller.spec
```
Expected: FAIL — `Cannot find module './auth.controller'`

**Step 3: Commit**

```bash
git add apps/backend/src/auth/auth.controller.spec.ts
git commit -m "test(auth): add AuthController unit tests (red)"
```

---

### Task 10: Implement AuthController

**Files:**
- Create: `apps/backend/src/auth/auth.controller.ts`

**Step 1: Write the implementation**

Create `apps/backend/src/auth/auth.controller.ts`:

```typescript
import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req: any) {
    return this.authService.login(req.user);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshTokens(refreshTokenDto.refreshToken);
  }

  @Post('logout')
  async logout(@CurrentUser() user: { userId: string; email: string }) {
    await this.authService.logout(user.userId);
    return { message: 'Logged out successfully' };
  }
}
```

**Step 2: Run tests to verify they pass**

Run from `apps/backend/`:
```bash
pnpm test -- --testPathPattern=auth.controller.spec
```
Expected: All 4 tests PASS

**Step 3: Commit**

```bash
git add apps/backend/src/auth/auth.controller.ts
git commit -m "feat(auth): implement AuthController with register, login, refresh, logout endpoints"
```

---

### Task 11: Create AuthModule and wire into AppModule

**Files:**
- Create: `apps/backend/src/auth/auth.module.ts`
- Modify: `apps/backend/src/app.module.ts`
- Modify: `apps/backend/src/app.controller.ts`
- Modify: `apps/backend/src/main.ts`

**Step 1: Create AuthModule**

Create `apps/backend/src/auth/auth.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AuthModule {}
```

**Step 2: Update AppModule**

Modify `apps/backend/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

**Step 3: Mark existing GET / as public**

Modify `apps/backend/src/app.controller.ts`:

```typescript
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
```

**Step 4: Enable global ValidationPipe**

Modify `apps/backend/src/main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.listen(3000);
}
bootstrap();
```

**Step 5: Create .env file (if not exists)**

Create `apps/backend/.env` (do NOT commit — add to .gitignore):

```env
DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"
JWT_ACCESS_SECRET=your-access-secret-change-me
JWT_REFRESH_SECRET=your-refresh-secret-change-me
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
```

**Step 6: Run all unit tests**

Run from `apps/backend/`:
```bash
pnpm test
```
Expected: All tests PASS

**Step 7: Commit**

```bash
git add apps/backend/src/auth/auth.module.ts apps/backend/src/app.module.ts apps/backend/src/app.controller.ts apps/backend/src/main.ts
git commit -m "feat(auth): wire AuthModule into app with global JWT guard and validation"
```

---

### Task 12: Write and run E2E tests

**Files:**
- Create: `apps/backend/test/auth.e2e-spec.ts`

**Step 1: Write E2E tests**

Create `apps/backend/test/auth.e2e-spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  const testUser = { email: 'e2e@example.com', password: 'password123', name: 'E2E User' };

  describe('POST /auth/register', () => {
    it('should register a new user and return tokens', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201)
        .expect((res) => {
          expect(res.body.accessToken).toBeDefined();
          expect(res.body.refreshToken).toBeDefined();
        });
    });

    it('should return 409 for duplicate email', async () => {
      await request(app.getHttpServer()).post('/auth/register').send(testUser);

      return request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(409);
    });

    it('should return 400 for invalid email', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'not-an-email', password: 'password123' })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await request(app.getHttpServer()).post('/auth/register').send(testUser);
    });

    it('should login and return tokens', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(201)
        .expect((res) => {
          expect(res.body.accessToken).toBeDefined();
          expect(res.body.refreshToken).toBeDefined();
        });
    });

    it('should return 401 for wrong password', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: 'wrongpassword' })
        .expect(401);
    });
  });

  describe('Full auth flow', () => {
    it('should register -> access protected route -> refresh -> logout', async () => {
      // Register
      const registerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      const { accessToken, refreshToken } = registerRes.body;

      // Access protected route (GET / is public, so test logout which is protected)
      // Verify token works by calling logout
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      // Register again for refresh test
      const registerRes2 = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...testUser, email: 'e2e2@example.com' })
        .expect(201);

      // Refresh tokens
      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: registerRes2.body.refreshToken })
        .expect(201);

      expect(refreshRes.body.accessToken).toBeDefined();
      expect(refreshRes.body.refreshToken).toBeDefined();

      // Old refresh token should be revoked (rotation)
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: registerRes2.body.refreshToken })
        .expect(401);
    });

    it('should reject requests to protected routes without token', () => {
      return request(app.getHttpServer())
        .post('/auth/logout')
        .expect(401);
    });
  });
});
```

**Step 2: Run E2E tests**

Run from `apps/backend/`:
```bash
pnpm test:e2e
```
Expected: All E2E tests PASS (requires running PostgreSQL with DATABASE_URL configured)

**Step 3: Commit**

```bash
git add apps/backend/test/auth.e2e-spec.ts
git commit -m "test(auth): add E2E tests for full authentication flow"
```

---

### Task 13: Final verification

**Step 1: Run all unit tests**

Run from `apps/backend/`:
```bash
pnpm test
```
Expected: All tests PASS

**Step 2: Run E2E tests**

Run from `apps/backend/`:
```bash
pnpm test:e2e
```
Expected: All tests PASS

**Step 3: Run type checking**

Run from repo root:
```bash
pnpm turbo check-types --filter=backend
```
Expected: No type errors

**Step 4: Run linting**

Run from repo root:
```bash
pnpm turbo lint --filter=backend
```
Expected: No lint errors

**Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "feat(auth): JWT authentication with refresh token rotation"
```
