import { Request, Response } from 'express';
import { RegisterController } from '../../../src/modules/controllers/registerController';
import { User } from '../../../src/models/User';
import { PasswordUtils } from '../../../src/utils/passwordUtils';
import { JwtUtils } from '../../../src/utils/jwtUtils';
import { ApiError } from '../../../src/utils/ApiError';
import { ApiResponse } from '../../../src/utils/ApiResponse';
import { createMockRequest, createMockResponse, createMockNext, createMockRepository } from '../../utils/mockHelpers';

// Mock dependencies
jest.mock('../../../src/config/db', () => ({
  AppDataSource: {
    getRepository: jest.fn()
  }
}));

jest.mock('../../../src/utils/passwordUtils');
jest.mock('../../../src/utils/jwtUtils');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/services/otpService');
jest.mock('../../../src/services/emailService');
jest.mock('../../../src/services/smsService');

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

describe('RegisterController', () => {
  let registerController: RegisterController;
  let mockRequest: any;
  let mockResponse: any;
  let mockNext: any;
  let mockUserRepository: any;

  const validRegistrationData = {
    fname: 'John',
    mname: 'M',
    lname: 'Doe',
    email: 'john.doe@example.com',
    password: 'SecurePassword123!',
    countryCode: '+1',
    phone: '1234567890',
    dob: '1990-01-01',
    address: {
      houseNumber: '123',
      street: 'Main St',
      city: 'Test City',
      state: 'Test State',
      country: 'Test Country',
      pincode: '12345'
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRequest = createMockRequest();
    mockResponse = createMockResponse();
    mockNext = createMockNext();
    mockUserRepository = createMockRepository();

    const { AppDataSource } = require('../../../src/config/db');
    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockUserRepository);

    registerController = new RegisterController();
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      // Arrange
      mockRequest.body = validRegistrationData;
      
      mockUserRepository.findOne.mockResolvedValue(null); // No existing user
      mockUserRepository.create.mockReturnValue({ id: 'test-user-id', ...validRegistrationData });
      mockUserRepository.save.mockResolvedValue({ 
        id: 'test-user-id', 
        ...validRegistrationData,
        createdAt: new Date(),
        isEmailVerified: false,
        isPhoneVerified: false
      });

      (PasswordUtils.validatePasswordStrength as jest.Mock).mockReturnValue({
        isValid: true,
        errors: []
      });
      (PasswordUtils.hashPassword as jest.Mock).mockResolvedValue('hashedPassword123');
      (JwtUtils.generateAccessToken as jest.Mock).mockReturnValue('mock-access-token');
      (JwtUtils.generateRefreshToken as jest.Mock).mockReturnValue('mock-refresh-token');

      // Act
      await registerController.register(mockRequest, mockResponse, mockNext);

      // Assert
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: [
          { email: validRegistrationData.email },
          { 
            phone: validRegistrationData.phone,
            countryCode: validRegistrationData.countryCode
          }
        ]
      });
      expect(PasswordUtils.validatePasswordStrength).toHaveBeenCalledWith(validRegistrationData.password);
      expect(PasswordUtils.hashPassword).toHaveBeenCalledWith(validRegistrationData.password);
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should reject registration with existing email', async () => {
      // Arrange
      mockRequest.body = validRegistrationData;
      
      const existingUser = {
        id: 'existing-user-id',
        email: validRegistrationData.email,
        phone: 'different-phone'
      };
      mockUserRepository.findOne.mockResolvedValue(existingUser);

      // Act
      await registerController.register(mockRequest, mockResponse, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.any(Error)
      );
      const calledError = mockNext.mock.calls[0][0];
      expect(calledError.statusCode).toBe(409);
      expect(calledError.message).toBe('An account with this email address already exists');
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should reject registration with existing phone number', async () => {
      // Arrange
      mockRequest.body = validRegistrationData;
      
      const existingUser = {
        id: 'existing-user-id',
        email: 'different@email.com',
        phone: validRegistrationData.phone,
        countryCode: validRegistrationData.countryCode
      };
      mockUserRepository.findOne.mockResolvedValue(existingUser);

      // Act
      await registerController.register(mockRequest, mockResponse, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.any(Error)
      );
      const calledError = mockNext.mock.calls[0][0];
      expect(calledError.statusCode).toBe(409);
      expect(calledError.message).toBe('An account with this phone number already exists');
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should reject weak passwords', async () => {
      // Arrange
      mockRequest.body = {
        ...validRegistrationData,
        password: 'weak'
      };
      
      mockUserRepository.findOne.mockResolvedValue(null);
      (PasswordUtils.validatePasswordStrength as jest.Mock).mockReturnValue({
        isValid: false,
        errors: ['Password is too weak']
      });

      // Act
      await registerController.register(mockRequest, mockResponse, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Password does not meet security requirements'
        })
      );
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should reject underage users', async () => {
      // Arrange
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() - 10); // 10 years old
      
      mockRequest.body = {
        ...validRegistrationData,
        dob: futureDate.toISOString().split('T')[0]
      };
      
      mockUserRepository.findOne.mockResolvedValue(null);

      // Act
      await registerController.register(mockRequest, mockResponse, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'You must be at least 13 years old to register'
        })
      );
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should reject invalid email format', async () => {
      // Arrange
      mockRequest.body = {
        ...validRegistrationData,
        email: 'invalid-email'
      };

      // Act
      await registerController.register(mockRequest, mockResponse, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Invalid email format'
        })
      );
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should reject empty required fields', async () => {
      // Arrange
      mockRequest.body = {
        ...validRegistrationData,
        fname: '   ', // Only spaces
        lname: ''     // Empty string
      };

      // Act
      await registerController.register(mockRequest, mockResponse, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'All required fields must be filled'
        })
      );
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should reject password containing personal information', async () => {
      // Arrange
      mockRequest.body = {
        ...validRegistrationData,
        password: 'JohnPassword123!' // Contains first name
      };
      
      mockUserRepository.findOne.mockResolvedValue(null);
      (PasswordUtils.validatePasswordStrength as jest.Mock).mockReturnValue({
        isValid: true,
        errors: []
      });

      // Act
      await registerController.register(mockRequest, mockResponse, mockNext);

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

    it('should handle database errors gracefully', async () => {
      // Arrange
      mockRequest.body = validRegistrationData;
      
      mockUserRepository.findOne.mockResolvedValue(null);
      (PasswordUtils.validatePasswordStrength as jest.Mock).mockReturnValue({
        isValid: true,
        errors: []
      });
      (PasswordUtils.hashPassword as jest.Mock).mockResolvedValue('hashedPassword123');
      
      const dbError = new Error('Database connection failed');
      (dbError as any).name = 'QueryFailedError';
      mockUserRepository.save.mockRejectedValue(dbError);

      // Act
      await registerController.register(mockRequest, mockResponse, mockNext);

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

    it('should handle unique constraint violations', async () => {
      // Arrange
      mockRequest.body = validRegistrationData;
      
      mockUserRepository.findOne.mockResolvedValue(null);
      (PasswordUtils.validatePasswordStrength as jest.Mock).mockReturnValue({
        isValid: true,
        errors: []
      });
      (PasswordUtils.hashPassword as jest.Mock).mockResolvedValue('hashedPassword123');
      
      const constraintError = new Error('Unique constraint violation');
      (constraintError as any).code = '23505';
      (constraintError as any).detail = 'Key (email)=(john.doe@example.com) already exists.';
      mockUserRepository.save.mockRejectedValue(constraintError);

      // Act
      await registerController.register(mockRequest, mockResponse, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.any(Error)
      );
      const calledError = mockNext.mock.calls[0][0];
      expect(calledError.statusCode).toBe(409);
      expect(calledError.message).toBe('An account with this email address already exists');
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should format phone number correctly', async () => {
      // Arrange
      mockRequest.body = {
        ...validRegistrationData,
        phone: '+11234567890' // Phone with country code
      };
      
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue({ id: 'test-user-id' });
      mockUserRepository.save.mockResolvedValue({ 
        id: 'test-user-id',
        phone: '1234567890' // Should be stored without country code
      });

      (PasswordUtils.validatePasswordStrength as jest.Mock).mockReturnValue({
        isValid: true,
        errors: []
      });
      (PasswordUtils.hashPassword as jest.Mock).mockResolvedValue('hashedPassword123');
      (JwtUtils.generateAccessToken as jest.Mock).mockReturnValue('mock-access-token');
      (JwtUtils.generateRefreshToken as jest.Mock).mockReturnValue('mock-refresh-token');

      // Act
      await registerController.register(mockRequest, mockResponse, mockNext);

      // Assert
      const createCall = mockUserRepository.create.mock.calls[0][0];
      expect(createCall.phone).toBe('1234567890'); // Without country code
    });

    it('should continue registration even if OTP sending fails', async () => {
      // Arrange
      mockRequest.body = validRegistrationData;
      
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue({ id: 'test-user-id' });
      mockUserRepository.save.mockResolvedValue({ 
        id: 'test-user-id',
        ...validRegistrationData,
        isEmailVerified: false,
        isPhoneVerified: false
      });

      (PasswordUtils.validatePasswordStrength as jest.Mock).mockReturnValue({
        isValid: true,
        errors: []
      });
      (PasswordUtils.hashPassword as jest.Mock).mockResolvedValue('hashedPassword123');
      (JwtUtils.generateAccessToken as jest.Mock).mockReturnValue('mock-access-token');
      (JwtUtils.generateRefreshToken as jest.Mock).mockReturnValue('mock-refresh-token');

      // Mock OTP service to fail
      const mockOtpService = require('../../../src/services/otpService');
      mockOtpService.OtpService.prototype.generateAndSendOtp = jest.fn().mockRejectedValue(new Error('OTP service down'));

      // Act
      await registerController.register(mockRequest, mockResponse, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalled();
    });
  });
});
