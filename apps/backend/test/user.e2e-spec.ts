import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

function getUserIdFromToken(token: string): string {
  const payload = JSON.parse(
    Buffer.from(token.split('.')[1], 'base64').toString(),
  );
  return payload.sub;
}

describe('User (e2e)', () => {
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
    email: 'user@example.com',
    password: 'password123',
    name: 'Test User',
  };

  async function registerAndGetToken(
    userData = testUser,
  ): Promise<{ accessToken: string; userId: string }> {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(userData)
      .expect(201);

    return {
      accessToken: res.body.accessToken,
      userId: getUserIdFromToken(res.body.accessToken),
    };
  }

  describe('GET /users', () => {
    it('should return list of users without passwords', async () => {
      const { accessToken } = await registerAndGetToken();

      const res = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].email).toBe(testUser.email);
      expect(res.body[0].name).toBe(testUser.name);
      expect(res.body[0]).not.toHaveProperty('password');
    });

    it('should return 401 without token', () => {
      return request(app.getHttpServer()).get('/users').expect(401);
    });
  });

  describe('GET /users/:id', () => {
    it('should return a single user without password', async () => {
      const { accessToken, userId } = await registerAndGetToken();

      const res = await request(app.getHttpServer())
        .get(`/users/${userId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.id).toBe(userId);
      expect(res.body.email).toBe(testUser.email);
      expect(res.body).not.toHaveProperty('password');
    });

    it('should return 404 for non-existent user', async () => {
      const { accessToken } = await registerAndGetToken();

      return request(app.getHttpServer())
        .get('/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 400 for invalid UUID', async () => {
      const { accessToken } = await registerAndGetToken();

      return request(app.getHttpServer())
        .get('/users/invalid-uuid')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should return 401 without token', () => {
      return request(app.getHttpServer())
        .get('/users/00000000-0000-0000-0000-000000000000')
        .expect(401);
    });
  });

  describe('PATCH /users/:id', () => {
    it('should update own name', async () => {
      const { accessToken, userId } = await registerAndGetToken();

      const res = await request(app.getHttpServer())
        .patch(`/users/${userId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(res.body.name).toBe('Updated Name');
      expect(res.body).not.toHaveProperty('password');
    });

    it('should update own email', async () => {
      const { accessToken, userId } = await registerAndGetToken();

      const res = await request(app.getHttpServer())
        .patch(`/users/${userId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: 'newemail@example.com' })
        .expect(200);

      expect(res.body.email).toBe('newemail@example.com');
    });

    it('should return 409 when email is already taken', async () => {
      const { accessToken, userId } = await registerAndGetToken();
      await registerAndGetToken({
        email: 'other@example.com',
        password: 'password123',
        name: 'Other',
      });

      return request(app.getHttpServer())
        .patch(`/users/${userId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: 'other@example.com' })
        .expect(409);
    });

    it('should return 403 when updating another user', async () => {
      const { accessToken } = await registerAndGetToken();
      const other = await registerAndGetToken({
        email: 'other@example.com',
        password: 'password123',
        name: 'Other',
      });

      return request(app.getHttpServer())
        .patch(`/users/${other.userId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Hacked' })
        .expect(403);
    });

    it('should return 400 for invalid email format', async () => {
      const { accessToken, userId } = await registerAndGetToken();

      return request(app.getHttpServer())
        .patch(`/users/${userId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: 'not-an-email' })
        .expect(400);
    });

    it('should return 401 without token', () => {
      return request(app.getHttpServer())
        .patch('/users/00000000-0000-0000-0000-000000000000')
        .send({ name: 'Test' })
        .expect(401);
    });
  });

  describe('DELETE /users/:id', () => {
    it('should delete own account', async () => {
      const { accessToken, userId } = await registerAndGetToken();

      await request(app.getHttpServer())
        .delete(`/users/${userId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      // Verify user is gone
      await request(app.getHttpServer())
        .get(`/users/${userId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 403 when deleting another user', async () => {
      const { accessToken } = await registerAndGetToken();
      const other = await registerAndGetToken({
        email: 'other@example.com',
        password: 'password123',
        name: 'Other',
      });

      return request(app.getHttpServer())
        .delete(`/users/${other.userId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });

    it('should return 401 without token', () => {
      return request(app.getHttpServer())
        .delete('/users/00000000-0000-0000-0000-000000000000')
        .expect(401);
    });
  });

  describe('Full CRUD flow', () => {
    it('should register -> get profile -> update -> verify -> delete -> verify gone', async () => {
      // Register
      const { accessToken, userId } = await registerAndGetToken();

      // Get profile
      const getRes = await request(app.getHttpServer())
        .get(`/users/${userId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(getRes.body.email).toBe(testUser.email);

      // Update name
      const updateRes = await request(app.getHttpServer())
        .patch(`/users/${userId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(updateRes.body.name).toBe('Updated Name');

      // Verify update persisted
      const verifyRes = await request(app.getHttpServer())
        .get(`/users/${userId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(verifyRes.body.name).toBe('Updated Name');

      // Delete
      await request(app.getHttpServer())
        .delete(`/users/${userId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      // Verify deleted
      await request(app.getHttpServer())
        .get(`/users/${userId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });
});
