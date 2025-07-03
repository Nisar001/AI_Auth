// Mock dependencies FIRST, before any imports
jest.mock('../../../src/config/db', () => ({
  AppDataSource: {
    getRepository: jest.fn()
  }
}));

jest.mock('../../../src/utils/logger');
jest.mock('../../../src/utils/passwordUtils');

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

jest.mock('../../../src/utils/ApiError', () => {
  const ApiError = class extends Error {
    statusCode: number;
    data?: any;
    
    constructor(statusCode: number, message: string, data?: any) {
      super(message);
      this.statusCode = statusCode;
      this.name = 'ApiError';
      this.data = data;
    }
  };
  return { ApiError };
});

jest.mock('../../../src/utils/ApiResponse', () => ({
  ApiResponse: {
    success: jest.fn((data, message, statusCode) => {
      return {
        success: true,
        message: message || 'Success',
        data: data,
        statusCode: statusCode || 200
      };
    })
  }
}));

// Now import everything else
import { Request, Response, NextFunction } from 'express';
import { ResetPasswordController } from '../../../src/modules/controllers/resetPasswordController';
import { User } from '../../../src/models/User';
import { OtpService as OtpServiceModel } from '../../../src/models/OtpService';
import { PasswordUtils } from '../../../src/utils/passwordUtils';
import { ApiError } from '../../../src/utils/ApiError';
import { createMockUser } from '../../utils/mockUser';
import { createMockRepository } from '../../utils/mockHelpers';

describe('ResetPasswordController', () => {
  let resetPasswordController: ResetPasswordController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockUserRepository: any;
  let mockOtpRepository: any;

  beforeEach(() => {
    // Setup request and response mocks
    mockRequest = {
      body: {
        identifier: 'john.doe@example.com',
        otp: '123456',
        newPassword: 'NewPassword123!'
      },
      ip: '127.0.0.1'
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    mockNext = jest.fn();

    // Setup repository mocks
    mockUserRepository = createMockRepository();
    mockOtpRepository = createMockRepository();

    const { AppDataSource } = require('../../../src/config/db');
    (AppDataSource.getRepository as jest.Mock)
      .mockImplementation((entity) => {
        if (entity === User) return mockUserRepository;
        if (entity === OtpServiceModel) return mockOtpRepository;
        return null;
      });

    // Create controller instance
    resetPasswordController = new ResetPasswordController();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('resetPassword', () => {
    it('should successfully reset password with valid inputs', async () => {
      // Arrange
      const mockUser = createMockUser({
        email: 'john.doe@example.com',
        isEmailVerified: true
      });

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const now = new Date();
      const futureDate = new Date(now.getTime() + 3600000); // 1 hour in the future
      
      const mockOtpRecord = {
        id: 'otp-id',
        user: mockUser,
        otp: '123456',
        type: 'email' as const,
        purpose: 'password_reset',
        expiresAt: futureDate,
        used: false,
        createdAt: now
      };

      mockOtpRepository.findOne.mockResolvedValue(mockOtpRecord);
      
      // Mock password utilities
      (PasswordUtils.validatePasswordStrength as jest.Mock).mockReturnValue({
        isValid: true,
        errors: []
      });
      
      (PasswordUtils.comparePassword as jest.Mock).mockResolvedValue(false); // New password is different
      (PasswordUtils.hashPassword as jest.Mock).mockResolvedValue('newHashedPassword');

      // Act
      await resetPasswordController.resetPassword(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'john.doe@example.com' }
      });
      
      expect(mockOtpRepository.findOne).toHaveBeenCalledWith({
        where: {
          user: { id: mockUser.id },
          purpose: 'password_reset',
          otp: '123456',
          used: false
        },
        order: { createdAt: 'DESC' }
      });
      
      expect(PasswordUtils.validatePasswordStrength).toHaveBeenCalledWith('NewPassword123!');
      expect(PasswordUtils.comparePassword).toHaveBeenCalledWith('NewPassword123!', 'hashedPassword123');
      expect(PasswordUtils.hashPassword).toHaveBeenCalledWith('NewPassword123!');
      
      // Verify user is updated
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          password: 'newHashedPassword',
          tokenVersion: 2, // Incremented from 1
          loginAttempts: 0,
          lockedUntil: undefined
        })
      );
      
      // Verify OTP is marked as used
      expect(mockOtpRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          used: true
        })
      );
      
      // Verify all other OTPs are marked as used
      expect(mockOtpRepository.update).toHaveBeenCalled();
      
      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('password has been reset successfully')
        })
      );
      
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle user not found error', async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(null);

      // Act
      await resetPasswordController.resetPassword(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: 'User not found'
        })
      );
      
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
    
    it('should handle locked user account', async () => {
      // Arrange
      const lockedUser = createMockUser({
        email: 'john.doe@example.com',
        isEmailVerified: true,
        lockedUntil: new Date(Date.now() + 60000) // Locked for 1 minute
      });

      mockUserRepository.findOne.mockResolvedValue(lockedUser);

      // Act
      await resetPasswordController.resetPassword(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 423,
          message: 'Account is temporarily locked. Please try again later.'
        })
      );
      
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
    
    it('should handle invalid OTP error', async () => {
      // Arrange
      const mockUser = createMockUser({
        email: 'john.doe@example.com',
        isEmailVerified: true
      });

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockOtpRepository.findOne.mockResolvedValue(null); // No valid OTP found

      // Act
      await resetPasswordController.resetPassword(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Invalid or expired reset code'
        })
      );
      
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
    
    it('should handle expired OTP', async () => {
      // Arrange
      const mockUser = createMockUser({
        email: 'john.doe@example.com',
        isEmailVerified: true
      });

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      
      const pastDate = new Date(Date.now() - 3600000); // 1 hour in the past
      
      const mockOtpRecord = {
        id: 'otp-id',
        user: mockUser,
        otp: '123456',
        type: 'email' as const,
        purpose: 'password_reset',
        expiresAt: pastDate, // Expired
        used: false,
        createdAt: new Date()
      };

      mockOtpRepository.findOne.mockResolvedValue(mockOtpRecord);

      // Act
      await resetPasswordController.resetPassword(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockOtpRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          used: true
        })
      );
      
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Reset code has expired. Please request a new one.'
        })
      );
      
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
    
    it('should handle weak password error', async () => {
      // Arrange
      const mockUser = createMockUser({
        email: 'john.doe@example.com',
        isEmailVerified: true
      });

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      
      const now = new Date();
      const futureDate = new Date(now.getTime() + 3600000); // 1 hour in the future
      
      const mockOtpRecord = {
        id: 'otp-id',
        user: mockUser,
        otp: '123456',
        type: 'email' as const,
        purpose: 'password_reset',
        expiresAt: futureDate,
        used: false,
        createdAt: now
      };

      mockOtpRepository.findOne.mockResolvedValue(mockOtpRecord);
      
      // Mock password validation to fail
      (PasswordUtils.validatePasswordStrength as jest.Mock).mockReturnValue({
        isValid: false,
        errors: ['Password must contain at least one uppercase letter', 'Password must contain at least one number']
      });

      // Act
      await resetPasswordController.resetPassword(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Password does not meet security requirements',
          data: ['Password must contain at least one uppercase letter', 'Password must contain at least one number']
        })
      );
      
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
    
    it('should handle same password error', async () => {
      // Arrange
      const mockUser = createMockUser({
        email: 'john.doe@example.com',
        isEmailVerified: true,
        password: 'currentHashedPassword'
      });

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      
      const now = new Date();
      const futureDate = new Date(now.getTime() + 3600000); // 1 hour in the future
      
      const mockOtpRecord = {
        id: 'otp-id',
        user: mockUser,
        otp: '123456',
        type: 'email' as const,
        purpose: 'password_reset',
        expiresAt: futureDate,
        used: false,
        createdAt: now
      };

      mockOtpRepository.findOne.mockResolvedValue(mockOtpRecord);
      
      // Mock password validation
      (PasswordUtils.validatePasswordStrength as jest.Mock).mockReturnValue({
        isValid: true,
        errors: []
      });
      
      // Mock password comparison to indicate same password
      (PasswordUtils.comparePassword as jest.Mock).mockResolvedValue(true);

      // Act
      await resetPasswordController.resetPassword(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'New password must be different from your current password'
        })
      );
      
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
    
    it('should handle password with personal info error', async () => {
      // Arrange
      const mockUser = createMockUser({
        email: 'john.doe@example.com',
        fname: 'John',
        lname: 'Doe',
        isEmailVerified: true
      });

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      
      const now = new Date();
      const futureDate = new Date(now.getTime() + 3600000); // 1 hour in the future
      
      const mockOtpRecord = {
        id: 'otp-id',
        user: mockUser,
        otp: '123456',
        type: 'email' as const,
        purpose: 'password_reset',
        expiresAt: futureDate,
        used: false,
        createdAt: now
      };

      mockOtpRepository.findOne.mockResolvedValue(mockOtpRecord);
      
      // Password contains user's first name
      mockRequest.body.newPassword = 'John123!Password';
      
      // Mock password validation
      (PasswordUtils.validatePasswordStrength as jest.Mock).mockReturnValue({
        isValid: true,
        errors: []
      });
      
      // Mock password comparison
      (PasswordUtils.comparePassword as jest.Mock).mockResolvedValue(false);

      // Act
      await resetPasswordController.resetPassword(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Password cannot contain personal information like your name or email'
        })
      );
      
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
    
    it('should handle phone number identifier correctly', async () => {
      // Arrange
      mockRequest.body.identifier = '+11234567890';
      
      const mockUser = createMockUser({
        phone: '1234567890',
        countryCode: '+1',
        isPhoneVerified: true
      });

      mockUserRepository.findOne.mockImplementation((options: any) => {
        // First call with email returns null
        if (options.where.email) {
          return Promise.resolve(null);
        }
        // Second call with phone returns the user
        if (options.where.phone === '+11234567890') {
          return Promise.resolve(mockUser);
        }
        return Promise.resolve(null);
      });
      
      const now = new Date();
      const futureDate = new Date(now.getTime() + 3600000); // 1 hour in the future
      
      const mockOtpRecord = {
        id: 'otp-id',
        user: mockUser,
        otp: '123456',
        type: 'sms' as const,
        purpose: 'password_reset',
        expiresAt: futureDate,
        used: false,
        createdAt: now
      };

      mockOtpRepository.findOne.mockResolvedValue(mockOtpRecord);
      
      // Mock password utilities
      (PasswordUtils.validatePasswordStrength as jest.Mock).mockReturnValue({
        isValid: true,
        errors: []
      });
      
      (PasswordUtils.comparePassword as jest.Mock).mockResolvedValue(false);
      (PasswordUtils.hashPassword as jest.Mock).mockResolvedValue('newHashedPassword');

      // Act
      await resetPasswordController.resetPassword(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: '+11234567890' }
      });
      
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { phone: '+11234567890' }
      });
      
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalled();
    });
    
    it('should handle database errors gracefully', async () => {
      // Arrange
      mockUserRepository.findOne.mockRejectedValue({
        name: 'QueryFailedError',
        message: 'Database error'
      });

      // Act
      await resetPasswordController.resetPassword(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          message: 'Database error occurred. Please try again.'
        })
      );
      
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
    
    it('should handle unexpected errors gracefully', async () => {
      // Arrange
      mockUserRepository.findOne.mockRejectedValue(new Error('Unexpected error'));

      // Act
      await resetPasswordController.resetPassword(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          message: 'Password reset failed. Please try again later.'
        })
      );
      
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
  });
});
