// Mock dependencies FIRST, before any imports
jest.mock('../../../src/config/db', () => ({
  AppDataSource: {
    getRepository: jest.fn()
  }
}));

jest.mock('../../../src/utils/logger');
jest.mock('../../../src/utils/phoneUtils');

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
import { PhoneVerificationController } from '../../../src/modules/controllers/phoneVerificationController';
import { User } from '../../../src/models/User';
import { OtpService as OtpServiceModel } from '../../../src/models/OtpService';
import { PhoneUtils } from '../../../src/utils/phoneUtils';
import { ApiError } from '../../../src/utils/ApiError';
import { createMockUser } from '../../utils/mockUser';
import { MoreThanOrEqual } from 'typeorm';

describe('PhoneVerificationController', () => {
  let phoneVerificationController: PhoneVerificationController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockUserRepository: any;
  let mockOtpRepository: any;

  beforeEach(() => {
    // Setup request and response mocks
    mockRequest = {
      body: {
        phone: '+11234567890',
        otp: '123456'
      },
      ip: '127.0.0.1'
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    mockNext = jest.fn();

    // Setup repository mocks
    mockUserRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
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
    (AppDataSource.getRepository as jest.Mock)
      .mockImplementation((entity) => {
        if (entity === User) return mockUserRepository;
        if (entity === OtpServiceModel) return mockOtpRepository;
        return null;
      });

    // Create controller instance
    phoneVerificationController = new PhoneVerificationController();

    // Mock PhoneUtils methods
    (PhoneUtils.generateSearchFormats as jest.Mock).mockReturnValue(['+11234567890', '11234567890', '1234567890']);
    (PhoneUtils.parsePhoneNumber as jest.Mock).mockReturnValue({
      countryCode: '+1',
      phoneNumber: '1234567890',
      fullPhone: '+11234567890'
    });
    (PhoneUtils.isPhoneMatch as jest.Mock).mockReturnValue(false);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyPhone', () => {
    it('should verify phone number successfully with valid OTP', async () => {
      // Arrange
      const mockUser = createMockUser({
        phone: '1234567890',
        countryCode: '+1',
        isPhoneVerified: false
      });

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      
      const now = new Date();
      const futureDate = new Date(now.getTime() + 3600000); // 1 hour in the future
      
      const mockOtpRecord = {
        id: 'otp-id',
        user: mockUser,
        otp: '123456',
        type: 'sms',
        purpose: 'phone verification',
        expiresAt: futureDate,
        used: false,
        createdAt: now
      };

      mockOtpRepository.findOne.mockResolvedValue(mockOtpRecord);
      mockOtpRepository.find.mockResolvedValue([mockOtpRecord]);
      mockOtpRepository.count.mockResolvedValue(1); // Only 1 recent attempt

      // Act
      await phoneVerificationController.verifyPhone(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { phone: expect.any(String) }
      });
      
      expect(mockOtpRepository.findOne).toHaveBeenCalledWith({
        where: {
          user: { id: mockUser.id },
          type: 'sms',
          otp: '123456',
          used: false,
          purpose: 'phone verification'
        },
        order: { createdAt: 'DESC' }
      });
      
      // Verify OTP is marked as used
      expect(mockOtpRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          used: true
        })
      );
      
      // Verify user is updated
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isPhoneVerified: true
        })
      );
      
      // Verify all other OTPs are marked as used
      expect(mockOtpRepository.update).toHaveBeenCalled();
      
      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Phone number verified successfully'
        })
      );
      
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle user not found error', async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.find.mockResolvedValue([]);
      
      // Mock isPhoneMatch to always return false
      (PhoneUtils.isPhoneMatch as jest.Mock).mockReturnValue(false);

      // Act
      await phoneVerificationController.verifyPhone(mockRequest as Request, mockResponse as Response, mockNext);

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
    
    it('should find user with country code + phone number combination', async () => {
      // Arrange
      const mockUser = createMockUser({
        phone: '1234567890',
        countryCode: '+1',
        isPhoneVerified: false
      });

      // Mock a user found by country code + phone combination
      mockUserRepository.findOne.mockImplementationOnce(() => null) // First call returns null
        .mockImplementationOnce(() => Promise.resolve(mockUser)); // Second call returns the user
      
      const now = new Date();
      const futureDate = new Date(now.getTime() + 3600000); // 1 hour in the future
      
      const mockOtpRecord = {
        id: 'otp-id',
        user: mockUser,
        otp: '123456',
        type: 'sms',
        purpose: 'phone verification',
        expiresAt: futureDate,
        used: false,
        createdAt: now
      };

      mockOtpRepository.findOne.mockResolvedValue(mockOtpRecord);
      mockOtpRepository.find.mockResolvedValue([mockOtpRecord]);
      mockOtpRepository.count.mockResolvedValue(1);

      // Act
      await phoneVerificationController.verifyPhone(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isPhoneVerified: true
        })
      );
    });
    
    it('should handle already verified phone number', async () => {
      // Arrange
      const mockUser = createMockUser({
        phone: '1234567890',
        countryCode: '+1',
        isPhoneVerified: true // Already verified
      });

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      // Act
      await phoneVerificationController.verifyPhone(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Phone number is already verified'
        })
      );
      
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
    
    it('should handle invalid OTP error', async () => {
      // Arrange
      const mockUser = createMockUser({
        phone: '1234567890',
        countryCode: '+1',
        isPhoneVerified: false
      });

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockOtpRepository.findOne.mockResolvedValue(null); // No valid OTP found
      mockOtpRepository.find.mockResolvedValue([]);

      // Act
      await phoneVerificationController.verifyPhone(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Invalid or expired OTP'
        })
      );
      
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
    
    it('should handle expired OTP', async () => {
      // Arrange
      const mockUser = createMockUser({
        phone: '1234567890',
        countryCode: '+1',
        isPhoneVerified: false
      });

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      
      const now = new Date();
      const pastDate = new Date(now.getTime() - 3600000); // 1 hour in the past
      
      const mockOtpRecord = {
        id: 'otp-id',
        user: mockUser,
        otp: '123456',
        type: 'sms',
        purpose: 'phone verification',
        expiresAt: pastDate, // Expired
        used: false,
        createdAt: now
      };

      mockOtpRepository.findOne.mockResolvedValue(mockOtpRecord);
      mockOtpRepository.find.mockResolvedValue([mockOtpRecord]);

      // Act
      await phoneVerificationController.verifyPhone(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockOtpRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          used: true
        })
      );
      
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'OTP has expired. Please request a new one.'
        })
      );
      
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
    
    it('should handle too many verification attempts', async () => {
      // Arrange
      const mockUser = createMockUser({
        phone: '1234567890',
        countryCode: '+1',
        isPhoneVerified: false
      });

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      
      const now = new Date();
      const futureDate = new Date(now.getTime() + 3600000); // 1 hour in the future
      
      const mockOtpRecord = {
        id: 'otp-id',
        user: mockUser,
        otp: '123456',
        type: 'sms',
        purpose: 'phone verification',
        expiresAt: futureDate,
        used: false,
        createdAt: now
      };

      mockOtpRepository.findOne.mockResolvedValue(mockOtpRecord);
      mockOtpRepository.find.mockResolvedValue([mockOtpRecord]);
      
      // Mock more than 5 attempts in the past hour
      mockOtpRepository.count.mockResolvedValue(6); 

      // Act
      await phoneVerificationController.verifyPhone(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockOtpRepository.count).toHaveBeenCalledWith({
        where: {
          user: { id: mockUser.id },
          type: 'sms',
          purpose: 'phone verification',
          createdAt: expect.any(Object)
        }
      });
      
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 429,
          message: 'Too many verification attempts. Please try again later.'
        })
      );
      
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
    
    it('should find user with phoneUtils.isPhoneMatch when other methods fail', async () => {
      // Arrange
      const mockUser = createMockUser({
        phone: '1234567890',
        countryCode: '+1',
        isPhoneVerified: false
      });

      // All direct queries fail
      mockUserRepository.findOne.mockResolvedValue(null);
      
      // But we find a user in the full list
      mockUserRepository.find.mockResolvedValue([mockUser]);
      
      // And isPhoneMatch returns true for our user
      (PhoneUtils.isPhoneMatch as jest.Mock).mockReturnValue(true);
      
      const now = new Date();
      const futureDate = new Date(now.getTime() + 3600000); // 1 hour in the future
      
      const mockOtpRecord = {
        id: 'otp-id',
        user: mockUser,
        otp: '123456',
        type: 'sms',
        purpose: 'phone verification',
        expiresAt: futureDate,
        used: false,
        createdAt: now
      };

      mockOtpRepository.findOne.mockResolvedValue(mockOtpRecord);
      mockOtpRepository.find.mockResolvedValue([mockOtpRecord]);
      mockOtpRepository.count.mockResolvedValue(1);

      // Act
      await phoneVerificationController.verifyPhone(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(PhoneUtils.isPhoneMatch).toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isPhoneVerified: true
        })
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });
    
    it('should handle database errors gracefully', async () => {
      // Arrange
      mockUserRepository.findOne.mockRejectedValue({
        name: 'QueryFailedError',
        message: 'Database error'
      });

      // Act
      await phoneVerificationController.verifyPhone(mockRequest as Request, mockResponse as Response, mockNext);

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
      await phoneVerificationController.verifyPhone(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          message: 'Phone verification failed. Please try again later.'
        })
      );
      
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
  });
});
