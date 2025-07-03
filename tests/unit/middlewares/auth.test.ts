// Mock dependencies FIRST, before any imports
jest.mock('../../../src/config/db', () => ({
  AppDataSource: {
    getRepository: jest.fn()
  }
}));

jest.mock('../../../src/utils/jwtUtils');

jest.mock('../../../src/utils/ApiResponse', () => ({
  ApiResponse: {
    error: jest.fn((message, statusCode) => ({
      success: false,
      message,
      statusCode
    })),
    success: jest.fn((data, message, statusCode) => ({
      success: true,
      message: message || 'Success',
      data,
      statusCode: statusCode || 200
    }))
  }
}));

// Now import everything else
import { Request, Response, NextFunction } from 'express';
import { JwtUtils } from '../../../src/utils/jwtUtils';
import { ApiResponse } from '../../../src/utils/ApiResponse';
import { authenticateToken, requireEmailVerification, requirePhoneVerification, requireFullVerification } from '../../../src/middlewares/auth';
import { User } from '../../../src/models/User';
import { createMockUser } from '../../utils/mockUser';

describe('Auth Middleware', () => {
  let mockRequest: any;
  let mockResponse: any;
  let mockNext: NextFunction;
  let mockUserRepository: any;

  beforeEach(() => {
    // Setup request, response and next function
    mockRequest = {
      headers: {
        authorization: 'Bearer valid-token'
      }
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    mockNext = jest.fn();

    // Setup repository mock
    mockUserRepository = {
      findOne: jest.fn()
    };

    const { AppDataSource } = require('../../../src/config/db');
    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockUserRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticateToken', () => {
    it('should authenticate valid token and set user in request', async () => {
      // Arrange
      const mockUser = createMockUser();
      const mockPayload = { userId: mockUser.id, tokenVersion: 1, iat: 123456, exp: 234567 };
      
      (JwtUtils.getTokenFromHeader as jest.Mock).mockReturnValue('valid-token');
      (JwtUtils.verifyAccessToken as jest.Mock).mockReturnValue(mockPayload);
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      // Act
      await authenticateToken(mockRequest, mockResponse, mockNext);

      // Assert
      expect(JwtUtils.getTokenFromHeader).toHaveBeenCalledWith('Bearer valid-token');
      expect(JwtUtils.verifyAccessToken).toHaveBeenCalledWith('valid-token');
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id }
      });
      
      expect(mockRequest.user).toBe(mockUser);
      expect(mockRequest.tokenPayload).toBe(mockPayload);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should return 401 if token is invalid', async () => {
      // Arrange
      (JwtUtils.getTokenFromHeader as jest.Mock).mockReturnValue('invalid-token');
      (JwtUtils.verifyAccessToken as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act
      await authenticateToken(mockRequest, mockResponse, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token',
        statusCode: 401
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if user not found', async () => {
      // Arrange
      const mockPayload = { userId: 'non-existent-id', tokenVersion: 1, iat: 123456, exp: 234567 };
      
      (JwtUtils.getTokenFromHeader as jest.Mock).mockReturnValue('valid-token');
      (JwtUtils.verifyAccessToken as jest.Mock).mockReturnValue(mockPayload);
      mockUserRepository.findOne.mockResolvedValue(null);

      // Act
      await authenticateToken(mockRequest, mockResponse, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found',
        statusCode: 401
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle unexpected errors', async () => {
      // Arrange
      (JwtUtils.getTokenFromHeader as jest.Mock).mockReturnValue('valid-token');
      (JwtUtils.verifyAccessToken as jest.Mock).mockReturnValue({ userId: 'user-id' });
      mockUserRepository.findOne.mockRejectedValue(new Error('Database error'));

      // Act
      await authenticateToken(mockRequest, mockResponse, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Database error',
        statusCode: 401
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireEmailVerification', () => {
    it('should allow access if email is verified', () => {
      // Arrange
      const mockUser = createMockUser({ isEmailVerified: true });
      mockRequest.user = mockUser;

      // Act
      requireEmailVerification(mockRequest, mockResponse, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should deny access if email is not verified', () => {
      // Arrange
      const mockUser = createMockUser({ isEmailVerified: false });
      mockRequest.user = mockUser;

      // Act
      requireEmailVerification(mockRequest, mockResponse, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email verification required',
        statusCode: 403
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requirePhoneVerification', () => {
    it('should allow access if phone is verified', () => {
      // Arrange
      const mockUser = createMockUser({ isPhoneVerified: true });
      mockRequest.user = mockUser;

      // Act
      requirePhoneVerification(mockRequest, mockResponse, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should deny access if phone is not verified', () => {
      // Arrange
      const mockUser = createMockUser({ isPhoneVerified: false });
      mockRequest.user = mockUser;

      // Act
      requirePhoneVerification(mockRequest, mockResponse, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Phone verification required',
        statusCode: 403
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireFullVerification', () => {
    it('should allow access if both email and phone are verified', () => {
      // Arrange
      const mockUser = createMockUser({
        isEmailVerified: true,
        isPhoneVerified: true
      });
      mockRequest.user = mockUser;

      // Act
      requireFullVerification(mockRequest, mockResponse, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should deny access if email is not verified', () => {
      // Arrange
      const mockUser = createMockUser({
        isEmailVerified: false,
        isPhoneVerified: true
      });
      mockRequest.user = mockUser;

      // Act
      requireFullVerification(mockRequest, mockResponse, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Both email and phone verification required',
        statusCode: 403
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny access if phone is not verified', () => {
      // Arrange
      const mockUser = createMockUser({
        isEmailVerified: true,
        isPhoneVerified: false
      });
      mockRequest.user = mockUser;

      // Act
      requireFullVerification(mockRequest, mockResponse, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Both email and phone verification required',
        statusCode: 403
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny access if both email and phone are not verified', () => {
      // Arrange
      const mockUser = createMockUser({
        isEmailVerified: false,
        isPhoneVerified: false
      });
      mockRequest.user = mockUser;

      // Act
      requireFullVerification(mockRequest, mockResponse, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Both email and phone verification required',
        statusCode: 403
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
