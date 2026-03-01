import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
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

  const testUser = {
    email: 'e2e@example.com',
    password: 'password123',
    name: 'E2E User',
  };

  describe('POST /auth/register', () => {
    it('should register a new user and return tokens', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201)
        .expect((res: any) => {
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
        .expect((res: any) => {
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

      const { accessToken } = registerRes.body;

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
      return request(app.getHttpServer()).post('/auth/logout').expect(401);
    });
  });
});
