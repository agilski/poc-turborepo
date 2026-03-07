import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserService } from './user.service';
import { UserRepository } from '../domain/user.repository';

jest.mock('bcrypt');

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockUserRepository = {
  findById: jest.fn(),
  findByEmail: jest.fn(),
  findByEmailWithPassword: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: UserRepository, useValue: mockUserRepository },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      mockUserRepository.findAll.mockResolvedValue([mockUser]);

      const result = await service.findAll();

      expect(result).toEqual([mockUser]);
      expect(mockUserRepository.findAll).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await service.findById('user-1');

      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update user name', async () => {
      const updatedUser = { ...mockUser, name: 'Updated Name' };
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.update.mockResolvedValue(updatedUser);

      const result = await service.update('user-1', { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-1', {
        name: 'Updated Name',
      });
    });

    it('should update email when not taken', async () => {
      const updatedUser = { ...mockUser, email: 'new@example.com' };
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.update.mockResolvedValue(updatedUser);

      const result = await service.update('user-1', {
        email: 'new@example.com',
      });

      expect(result.email).toBe('new@example.com');
    });

    it('should throw ConflictException when email already taken', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.findByEmail.mockResolvedValue({
        ...mockUser,
        id: 'other-user',
      });

      await expect(
        service.update('user-1', { email: 'taken@example.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should hash password when updating', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.update.mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');

      await service.update('user-1', { password: 'newpassword123' });

      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 10);
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-1', {
        password: 'new-hashed-password',
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not check email conflict when email unchanged', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.update.mockResolvedValue(mockUser);

      await service.update('user-1', { email: 'test@example.com' });

      expect(mockUserRepository.findByEmail).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete user when found', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.delete.mockResolvedValue(undefined);

      await service.delete('user-1');

      expect(mockUserRepository.delete).toHaveBeenCalledWith('user-1');
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(service.delete('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
