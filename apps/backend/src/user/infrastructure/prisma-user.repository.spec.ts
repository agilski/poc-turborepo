import { Test, TestingModule } from '@nestjs/testing';
import { PrismaUserRepository } from './prisma-user.repository';
import { PrismaService } from '../../prisma/prisma.service';

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  password: 'hashed-password',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockUserWithoutPassword = {
  id: mockUser.id,
  email: mockUser.email,
  name: mockUser.name,
  createdAt: mockUser.createdAt,
  updatedAt: mockUser.updatedAt,
};

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('PrismaUserRepository', () => {
  let repository: PrismaUserRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaUserRepository,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    repository = module.get<PrismaUserRepository>(PrismaUserRepository);
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return user without password when found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await repository.findById('user-1');

      expect(result).toEqual(mockUserWithoutPassword);
      expect(result).not.toHaveProperty('password');
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
    });

    it('should return null when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should return user without password when found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await repository.findByEmail('test@example.com');

      expect(result).toEqual(mockUserWithoutPassword);
      expect(result).not.toHaveProperty('password');
    });

    it('should return null when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await repository.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findByEmailWithPassword', () => {
    it('should return user with password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result =
        await repository.findByEmailWithPassword('test@example.com');

      expect(result).toEqual(mockUser);
      expect(result).toHaveProperty('password');
    });

    it('should return null when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result =
        await repository.findByEmailWithPassword('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return array of users without passwords', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([mockUser]);

      const result = await repository.findAll();

      expect(result).toEqual([mockUserWithoutPassword]);
      expect(result[0]).not.toHaveProperty('password');
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no users exist', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('should create user and return without password', async () => {
      mockPrismaService.user.create.mockResolvedValue(mockUser);

      const result = await repository.create({
        email: 'test@example.com',
        password: 'hashed-password',
        name: 'Test User',
      });

      expect(result).toEqual(mockUserWithoutPassword);
      expect(result).not.toHaveProperty('password');
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
          password: 'hashed-password',
          name: 'Test User',
        },
      });
    });
  });

  describe('update', () => {
    it('should update user and return without password', async () => {
      const updatedUser = { ...mockUser, name: 'Updated Name' };
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await repository.update('user-1', {
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
      expect(result).not.toHaveProperty('password');
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { name: 'Updated Name' },
      });
    });
  });

  describe('delete', () => {
    it('should delete user', async () => {
      mockPrismaService.user.delete.mockResolvedValue(mockUser);

      await repository.delete('user-1');

      expect(mockPrismaService.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
    });
  });
});
