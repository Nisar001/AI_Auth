// Mock dependencies FIRST, before any imports
jest.mock('../../../src/config/db', () => ({
  AppDataSource: {
    getRepository: jest.fn()
  }
}));
jest.mock('../../../src/services/otpService');
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
import { Request, Response } from 'express';
import { EmailVerificationController } from '../../../src/modules/controllers/emailVerificationController';
import { User } from '../../../src/models/User';
import { OtpService as OtpServiceEntity } from '../../../src/models/OtpService';
import { createMockUser } from '../../utils/mockUser';

describe('EmailVerificationController', () => {
  let emailVerificationController: EmailVerificationController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;
  let mockUserRepository: any;
  let mockOtpRepository: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRequest = {
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

    mockOtpRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      count: jest.fn()
    };

    const { AppDataSource } = require('../../../src/config/db');
    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity) => {
      if (entity === User) return mockUserRepository;
      if (entity === OtpServiceEntity) return mockOtpRepository;
      return {};
    });

    emailVerificationController = new EmailVerificationController();
  });

  describe('verifyEmail', () => {
    const validVerificationData = {
      email: 'john.doe@example.com',
      otp: '123456'
    };

    it('should successfully verify email with valid OTP', async () => {
      // Arrange
      mockRequest.body = validVerificationData;
      
      const mockUser = createMockUser({
        email: 'john.doe@example.com',
        isEmailVerified: false
      });

      const mockOtp = {
        id: 'otp-id',
        otp: '123456',
        type: 'email',
        expiresAt: new Date(Date.now() + 2 * 60 * 1000), // 2 minutes from now
        used: false,
        user: mockUser
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockOtpRepository.findOne.mockResolvedValue(mockOtp);
      mockOtpRepository.find.mockResolvedValue([mockOtp]); // For debugging
      mockOtpRepository.count.mockResolvedValue(1); // For rate limiting check
      mockOtpRepository.save.mockResolvedValue(mockOtp);
      mockUserRepository.save.mockResolvedValue(mockUser);
      mockOtpRepository.update.mockResolvedValue({ affected: 1 });

      // Act
      await emailVerificationController.verifyEmail(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: validVerificationData.email }
      });
      expect(mockOtpRepository.findOne).toHaveBeenCalledWith({
        where: {
          user: { id: mockUser.id },
          type: 'email',
          otp: validVerificationData.otp,
          used: false,
          purpose: 'email verification'
        },
        order: { createdAt: 'DESC' }
      });
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isEmailVerified: true
        })
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Email verified successfully'
        })
      );
    });

    it('should reject verification for non-existent user', async () => {
      // Arrange
      mockRequest.body = validVerificationData;
      mockUserRepository.findOne.mockResolvedValue(null);

      // Act
      await emailVerificationController.verifyEmail(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: 'User not found'
        })
      );
    });

    it('should reject verification for already verified email', async () => {
      // Arrange
      mockRequest.body = validVerificationData;
      
      const mockUser = createMockUser({
        email: 'john.doe@example.com',
        isEmailVerified: true
      });

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      // Act
      await emailVerificationController.verifyEmail(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Email is already verified'
        })
      );
    });

    it('should reject verification with invalid OTP', async () => {
      // Arrange
      mockRequest.body = {
        ...validVerificationData,
        otp: '999999'
      };
      
      const mockUser = createMockUser({
        email: 'john.doe@example.com',
        isEmailVerified: false
      });

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockOtpRepository.findOne.mockResolvedValue(null); // No matching OTP found
      mockOtpRepository.find.mockResolvedValue([]); // No OTPs found for debugging

      // Act
      await emailVerificationController.verifyEmail(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Invalid or expired OTP'
        })
      );
    });

    it('should reject verification with expired OTP', async () => {
      // Arrange
      mockRequest.body = validVerificationData;
      
      const mockUser = createMockUser({
        email: 'john.doe@example.com',
        isEmailVerified: false
      });

      const mockOtp = {
        id: 'otp-id',
        otp: '123456',
        type: 'email',
        expiresAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        used: false,
        user: mockUser,
        save: jest.fn()
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockOtpRepository.findOne.mockResolvedValue(mockOtp);
      mockOtpRepository.save.mockResolvedValue(mockOtp);
      mockOtpRepository.find.mockResolvedValue([mockOtp]);

      // Act
      await emailVerificationController.verifyEmail(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'OTP has expired. Please request a new one.'
        })
      );
    });

    it('should reject verification with already used OTP', async () => {
      // Arrange
      mockRequest.body = validVerificationData;
      
      const mockUser = createMockUser({
        email: 'john.doe@example.com',
        isEmailVerified: false
      });

      mockOtpRepository.findOne.mockResolvedValue(null); // No unused OTP found
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockOtpRepository.find.mockResolvedValue([]); // No OTPs found for debugging

      // Act
      await emailVerificationController.verifyEmail(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Invalid or expired OTP'
        })
      );
    });

    it('should handle malformed email addresses', async () => {
      // Arrange
      mockRequest.body = {
        email: 'invalid-email',
        otp: '123456'
      };

      mockUserRepository.findOne.mockResolvedValue(null); // User not found

      // Act
      await emailVerificationController.verifyEmail(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: 'User not found'
        })
      );
    });

    it('should handle malformed OTP', async () => {
      // Arrange
      mockRequest.body = {
        email: 'john.doe@example.com',
        otp: '12345' // Only 5 digits
      };

      mockUserRepository.findOne.mockResolvedValue(null); // User not found with this email

      // Act
      await emailVerificationController.verifyEmail(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: 'User not found'
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      mockRequest.body = validVerificationData;
      mockUserRepository.findOne.mockRejectedValue(new Error('Database connection failed'));

      // Act
      await emailVerificationController.verifyEmail(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          message: 'Email verification failed. Please try again later.'
        })
      );
    });

    it('should provide appropriate success message', async () => {
      // Arrange
      mockRequest.body = validVerificationData;
      
      const mockUser = createMockUser({
        email: 'john.doe@example.com',
        isEmailVerified: false
      });

      const mockOtp = {
        id: 'otp-id',
        otp: '123456',
        type: 'email',
        expiresAt: new Date(Date.now() + 2 * 60 * 1000),
        used: false,
        user: mockUser
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockOtpRepository.findOne.mockResolvedValue(mockOtp);
      mockOtpRepository.find.mockResolvedValue([mockOtp]);
      mockOtpRepository.count.mockResolvedValue(1);
      mockOtpRepository.save.mockResolvedValue(mockOtp);
      mockUserRepository.save.mockResolvedValue(mockUser);
      mockOtpRepository.update.mockResolvedValue({ affected: 1 });

      // Act
      await emailVerificationController.verifyEmail(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('Email verified successfully')
        })
      );
    });
  });
});
