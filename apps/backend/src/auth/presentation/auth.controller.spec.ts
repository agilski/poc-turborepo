import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from '../application/auth.service';

describe('AuthController', () => {
  let authController: AuthController;

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
