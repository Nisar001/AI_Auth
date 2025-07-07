// Mock dependencies FIRST, before any imports
jest.mock('../../../src/config/db', () => ({
  AppDataSource: {
    getRepository: jest.fn()
  }
}));
jest.mock('../../../src/utils/passwordUtils');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/middlewares/errorHandler', () => ({
  asyncHandler: (fn: Function) => {
    return async (req: any, res: any, next: any) => {
      try {
        await fn(req, res, next);
      } catch (error) {
        next(error);
      }
    };
  }
}));
jest.mock('../../../src/utils/ApiResponse', () => ({
  ApiResponse: {
    success: jest.fn((data, message, statusCode) => {
      return {
        success: true,
        message: message || 'Password changed successfully. Please login again with your new password.',
        data: data,
        statusCode: statusCode || 200
      };
    })
  }
}));
jest.mock('../../../src/utils/ApiError', () => {
  const ApiError = class extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
      this.name = 'ApiError';
    }
  };
  return { ApiError };
});

// Now import everything else
import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '../../../src/middlewares/auth';
import { createMockUser } from '../../utils/mockUser';
import { ChangePasswordController } from '../../../src/modules/controllers/changePasswordController';
import { User } from '../../../src/models/User';
import { PasswordUtils } from '../../../src/utils/passwordUtils';
import { ApiError } from '../../../src/utils/ApiError';

describe('ChangePasswordController', () => {
  let changePasswordController: ChangePasswordController;
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockUserRepository: any;

  beforeEach(() => {
    mockRequest = {
      user: { id: '1' } as User,
      body: {}
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();

    mockUserRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn()
    };

    const { AppDataSource } = require('../../../src/config/db');
    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockUserRepository);
    changePasswordController = new ChangePasswordController();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('changePassword', () => {
    it('should successfully change password with valid current password', async () => {
      mockRequest.body = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewSecurePass123!',
        confirmPassword: 'NewSecurePass123!'
      };

      const mockUser = createMockUser({
        id: '1',
        email: 'john.doe@example.com',
        password: 'oldHashedPassword',
        tokenVersion: 1
      });

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (PasswordUtils.comparePassword as jest.Mock)
        .mockResolvedValueOnce(true)   // for current password verification
        .mockResolvedValueOnce(false); // for checking if new password is different
      (PasswordUtils.validatePasswordStrength as jest.Mock).mockReturnValue({
        isValid: true,
        errors: []
      });
      (PasswordUtils.hashPassword as jest.Mock).mockResolvedValue('newHashedPassword');
      mockUserRepository.update.mockResolvedValue({ affected: 1 });

      await changePasswordController.changePassword(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(PasswordUtils.comparePassword).toHaveBeenNthCalledWith(1, 'OldPassword123!', 'oldHashedPassword');
      expect(PasswordUtils.comparePassword).toHaveBeenNthCalledWith(2, 'NewSecurePass123!', 'oldHashedPassword');
      expect(PasswordUtils.hashPassword).toHaveBeenCalledWith('NewSecurePass123!');

      expect(mockUserRepository.update).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({
          password: 'newHashedPassword',
          tokenVersion: 2,
          lastPasswordChange: expect.any(Date)
        })
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Password changed successfully. Please login again with your new password.',
          data: expect.objectContaining({
            message: 'Password changed successfully',
            timestamp: expect.any(String),
            securityNote: expect.stringContaining('All existing sessions have been invalidated')
          })
        })
      );
    });

    it('should return error for incorrect current password', async () => {
      mockRequest.body = {
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewSecurePass123!',
        confirmPassword: 'NewSecurePass123!'
      };

      const mockUser = createMockUser({
        id: '1',
        email: 'john.doe@example.com',
        password: 'oldHashedPassword',
        tokenVersion: 1
      });

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (PasswordUtils.comparePassword as jest.Mock).mockResolvedValue(false);

      await changePasswordController.changePassword(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Current password is incorrect'
        })
      );
    });

    it('should return error when new password is same as current password', async () => {
      mockRequest.body = {
        currentPassword: 'SamePassword123!',
        newPassword: 'SamePassword123!',
        confirmPassword: 'SamePassword123!'
      };

      const mockUser = createMockUser({
        id: '1',
        email: 'john.doe@example.com',
        password: 'oldHashedPassword',
        tokenVersion: 1
      });

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (PasswordUtils.comparePassword as jest.Mock)
        .mockResolvedValueOnce(true)  // current password check passes
        .mockResolvedValueOnce(true); // new password same as current

      await changePasswordController.changePassword(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'New password must be different from current password'
        })
      );
    });

    it('should return error for user not found', async () => {
      mockRequest.body = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewSecurePass123!',
        confirmPassword: 'NewSecurePass123!'
      };

      mockUserRepository.findOne.mockResolvedValue(null);

      await changePasswordController.changePassword(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: 'User not found'
        })
      );
    });

    it('should return error for missing authentication', async () => {
      mockRequest.user = undefined;
      mockRequest.body = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewSecurePass123!',
        confirmPassword: 'NewSecurePass123!'
      };

      await changePasswordController.changePassword(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'User not authenticated'
        })
      );
    });

    it('should return error for user with no password set', async () => {
      mockRequest.body = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewSecurePass123!',
        confirmPassword: 'NewSecurePass123!'
      };

      const mockUser = createMockUser({
        id: '1',
        email: 'john.doe@example.com',
        password: undefined,
        tokenVersion: 1
      });

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      await changePasswordController.changePassword(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'User account has no password set. Please use password reset instead.'
        })
      );
    });

    it('should handle password hashing error', async () => {
      mockRequest.body = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewSecurePass123!',
        confirmPassword: 'NewSecurePass123!'
      };

      const mockUser = createMockUser({
        id: '1',
        email: 'john.doe@example.com',
        password: 'oldHashedPassword',
        tokenVersion: 1
      });

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (PasswordUtils.comparePassword as jest.Mock)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      (PasswordUtils.hashPassword as jest.Mock).mockRejectedValue(new Error('Hash error'));

      await changePasswordController.changePassword(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle database update error', async () => {
      mockRequest.body = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewSecurePass123!',
        confirmPassword: 'NewSecurePass123!'
      };

      const mockUser = createMockUser({
        id: '1',
        email: 'john.doe@example.com',
        password: 'oldHashedPassword',
        tokenVersion: 1
      });

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (PasswordUtils.comparePassword as jest.Mock)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      (PasswordUtils.hashPassword as jest.Mock).mockResolvedValueOnce('newHashedPassword');
      mockUserRepository.update.mockRejectedValue(new Error('Database error'));

      await changePasswordController.changePassword(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle database lookup error', async () => {
      mockRequest.body = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewSecurePass123!',
        confirmPassword: 'NewSecurePass123!'
      };

      mockUserRepository.findOne.mockRejectedValue(new Error('Database error'));

      await changePasswordController.changePassword(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});