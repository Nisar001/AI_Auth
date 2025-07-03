// Mock dependencies FIRST, before any imports
jest.mock('../../../src/config/db', () => ({
  AppDataSource: {
    getRepository: jest.fn()
  }
}));

jest.mock('../../../src/services/otpService');
jest.mock('../../../src/services/emailService');
jest.mock('../../../src/services/smsService');
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
import { Request, Response, NextFunction } from 'express';
import { ForgotPasswordController } from '../../../src/modules/controllers/forgotPasswordController';
import { User } from '../../../src/models/User';
import { OtpService } from '../../../src/services/otpService';
import { ApiError } from '../../../src/utils/ApiError';
import { createMockUser } from '../../utils/mockUser';

describe('ForgotPasswordController', () => {
  let forgotPasswordController: ForgotPasswordController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockUserRepository: any;

  beforeEach(() => {
    // Setup request and response mocks
    mockRequest = {
      body: {
        identifier: 'john.doe@example.com',
        method: 'email'
      },
      ip: '127.0.0.1'
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    mockNext = jest.fn();

    // Setup repository mock
    mockUserRepository = {
      findOne: jest.fn(),
      update: jest.fn()
    };

    const { AppDataSource } = require('../../../src/config/db');
    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockUserRepository);

    // Create controller instance
    forgotPasswordController = new ForgotPasswordController();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('forgotPassword', () => {
    it('should send password reset OTP via email for valid email', async () => {
      // Arrange
      const mockUser = createMockUser({
        email: 'john.doe@example.com',
        isEmailVerified: true
      });

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      
      // Mock the OTP service methods
      const mockOtpService = require('../../../src/services/otpService').OtpService;
      mockOtpService.prototype.countRecentOtps = jest.fn().mockResolvedValue(0);
      mockOtpService.prototype.generateAndSendOtp = jest.fn().mockResolvedValue(true);

      // Act
      await forgotPasswordController.forgotPassword(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'john.doe@example.com' }
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('Password reset code has been sent')
        })
      );
    });

    it('should send password reset OTP via SMS for valid phone', async () => {
      // Arrange
      mockRequest.body = {
        identifier: '+11234567890',
        method: 'sms'
      };

      const mockUser = createMockUser({
        phone: '1234567890',
        countryCode: '+1',
        isPhoneVerified: true
      });

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      // Act
      await forgotPasswordController.forgotPassword(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true
        })
      );
    });

    it('should return success message even for non-existent user (security)', async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(null);

      // Act
      await forgotPasswordController.forgotPassword(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'If an account with this identifier exists, you will receive a password reset code.'
        })
      );
    });

    it('should handle locked user accounts', async () => {
      // Arrange
      const lockedUser = createMockUser({
        email: 'john.doe@example.com',
        isEmailVerified: true,
        lockedUntil: new Date(Date.now() + 60000) // Locked for 1 minute
      });

      mockUserRepository.findOne.mockResolvedValue(lockedUser);

      // Act
      await forgotPasswordController.forgotPassword(mockRequest as Request, mockResponse as Response, mockNext);

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

    it('should handle unverified email', async () => {
      // Arrange
      const mockUser = createMockUser({
        email: 'john.doe@example.com',
        isEmailVerified: false
      });

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      // Act
      await forgotPasswordController.forgotPassword(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: expect.stringContaining('verified')
        })
      );
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should handle social login users without password', async () => {
      // Arrange
      const mockUser = createMockUser({
        email: 'john.doe@example.com',
        isEmailVerified: true,
        password: undefined,
        authType: 'google'
      });

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      
      // Mock the OTP service methods
      const mockOtpService = require('../../../src/services/otpService').OtpService;
      mockOtpService.prototype.countRecentOtps = jest.fn().mockResolvedValue(0);
      mockOtpService.prototype.generateAndSendOtp = jest.fn().mockResolvedValue(true);

      // Act
      await forgotPasswordController.forgotPassword(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('Password reset code has been sent')
        })
      );
    });
  });
});
