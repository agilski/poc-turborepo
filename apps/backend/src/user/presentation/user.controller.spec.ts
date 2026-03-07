import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from '../application/user.service';

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockUserService = {
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

describe('UserController', () => {
  let controller: UserController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: mockUserService }],
    }).compile();

    controller = module.get<UserController>(UserController);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      mockUserService.findAll.mockResolvedValue([mockUser]);

      const result = await controller.findAll();

      expect(result).toEqual([mockUser]);
    });
  });

  describe('findOne', () => {
    it('should return a single user', async () => {
      mockUserService.findById.mockResolvedValue(mockUser);

      const result = await controller.findOne('user-1');

      expect(result).toEqual(mockUser);
      expect(mockUserService.findById).toHaveBeenCalledWith('user-1');
    });
  });

  describe('update', () => {
    it('should update own profile', async () => {
      const updatedUser = { ...mockUser, name: 'Updated' };
      mockUserService.update.mockResolvedValue(updatedUser);

      const result = await controller.update(
        'user-1',
        { name: 'Updated' },
        { userId: 'user-1', email: 'test@example.com' },
      );

      expect(result.name).toBe('Updated');
      expect(mockUserService.update).toHaveBeenCalledWith('user-1', {
        name: 'Updated',
      });
    });

    it('should throw ForbiddenException when updating another user', async () => {
      await expect(
        controller.update(
          'other-user',
          { name: 'Updated' },
          { userId: 'user-1', email: 'test@example.com' },
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockUserService.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete own profile', async () => {
      mockUserService.delete.mockResolvedValue(undefined);

      await controller.delete('user-1', {
        userId: 'user-1',
        email: 'test@example.com',
      });

      expect(mockUserService.delete).toHaveBeenCalledWith('user-1');
    });

    it('should throw ForbiddenException when deleting another user', async () => {
      await expect(
        controller.delete('other-user', {
          userId: 'user-1',
          email: 'test@example.com',
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockUserService.delete).not.toHaveBeenCalled();
    });
  });
});
