// Mock dependencies FIRST
jest.mock('jsonwebtoken');

// Now import everything else
import { JwtUtils, JwtPayload, RefreshTokenPayload } from '../../../src/utils/jwtUtils';
import jwt from 'jsonwebtoken';
import { ApiError } from '../../../src/utils/ApiError';

describe('JwtUtils', () => {
  const mockJwtSecret = 'test-jwt-secret';
  const mockRefreshSecret = 'test-refresh-secret';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = mockJwtSecret;
    process.env.REFRESH_TOKEN_SECRET = mockRefreshSecret;
    process.env.JWT_EXPIRY = '24h';
    process.env.REFRESH_TOKEN_EXPIRY = '7d';
  });

  describe('generateAccessToken', () => {
    it('should generate access token successfully', () => {
      // Arrange
      const payload: JwtPayload = {
        userId: 'test-user-id',
        email: 'test@example.com',
        phone: '1234567890',
        isEmailVerified: true,
        isPhoneVerified: true
      };
      const mockToken = 'mock-access-token';
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      // Act
      const result = JwtUtils.generateAccessToken(payload);

      // Assert
      expect(jwt.sign).toHaveBeenCalledWith(
        payload,
        mockJwtSecret,
        expect.objectContaining({
          expiresIn: '24h',
          issuer: 'ai-auth',
          audience: 'ai-auth-users'
        })
      );
      expect(result).toBe(mockToken);
    });

    it('should throw ApiError when JWT signing fails', () => {
      // Arrange
      const payload: JwtPayload = {
        userId: 'test-user-id',
        email: 'test@example.com',
        phone: '1234567890',
        isEmailVerified: true,
        isPhoneVerified: true
      };
      (jwt.sign as jest.Mock).mockImplementation(() => {
        throw new Error('JWT signing failed');
      });

      // Act & Assert
      expect(() => JwtUtils.generateAccessToken(payload)).toThrow(ApiError);
      expect(() => JwtUtils.generateAccessToken(payload)).toThrow('Failed to generate access token');
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate refresh token successfully', () => {
      // Arrange
      const payload: RefreshTokenPayload = {
        userId: 'test-user-id',
        tokenVersion: 1
      };
      const mockToken = 'mock-refresh-token';
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      // Act
      const result = JwtUtils.generateRefreshToken(payload);

      // Assert
      expect(jwt.sign).toHaveBeenCalledWith(
        payload,
        mockRefreshSecret,
        expect.objectContaining({
          expiresIn: '7d',
          issuer: 'ai-auth',
          audience: 'ai-auth-users'
        })
      );
      expect(result).toBe(mockToken);
    });

    it('should throw ApiError when refresh token signing fails', () => {
      // Arrange
      const payload: RefreshTokenPayload = {
        userId: 'test-user-id',
        tokenVersion: 1
      };
      (jwt.sign as jest.Mock).mockImplementation(() => {
        throw new Error('JWT signing failed');
      });

      // Act & Assert
      expect(() => JwtUtils.generateRefreshToken(payload)).toThrow(ApiError);
      expect(() => JwtUtils.generateRefreshToken(payload)).toThrow('Failed to generate refresh token');
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify access token successfully', () => {
      // Arrange
      const token = 'valid-access-token';
      const mockPayload: JwtPayload = {
        userId: 'test-user-id',
        email: 'test@example.com',
        phone: '1234567890',
        isEmailVerified: true,
        isPhoneVerified: true
      };
      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);

      // Act
      const result = JwtUtils.verifyAccessToken(token);

      // Assert
      expect(jwt.verify).toHaveBeenCalledWith(
        token,
        mockJwtSecret,
        expect.objectContaining({
          issuer: 'ai-auth',
          audience: 'ai-auth-users'
        })
      );
      expect(result).toEqual(mockPayload);
    });

    it('should throw ApiError for expired token', () => {
      // Arrange
      const token = 'expired-token';
      const mockError = new jwt.TokenExpiredError('Token expired', new Date());
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw mockError;
      });

      // Act & Assert
      expect(() => JwtUtils.verifyAccessToken(token)).toThrow(ApiError);
      expect(() => JwtUtils.verifyAccessToken(token)).toThrow('Access token has expired');
    });

    it('should throw ApiError for invalid token', () => {
      // Arrange
      const token = 'invalid-token';
      const mockError = new jwt.JsonWebTokenError('Invalid token');
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw mockError;
      });

      // Act & Assert
      expect(() => JwtUtils.verifyAccessToken(token)).toThrow(ApiError);
      expect(() => JwtUtils.verifyAccessToken(token)).toThrow('Invalid access token');
    });

    it('should throw generic ApiError for other verification errors', () => {
      // Arrange
      const token = 'problematic-token';
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Unknown verification error');
      });

      // Act & Assert
      expect(() => JwtUtils.verifyAccessToken(token)).toThrow(ApiError);
      expect(() => JwtUtils.verifyAccessToken(token)).toThrow('Token verification failed');
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify refresh token successfully', () => {
      // Arrange
      const token = 'valid-refresh-token';
      const mockPayload: RefreshTokenPayload = {
        userId: 'test-user-id',
        tokenVersion: 1
      };
      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);

      // Act
      const result = JwtUtils.verifyRefreshToken(token);

      // Assert
      expect(jwt.verify).toHaveBeenCalledWith(
        token,
        mockRefreshSecret,
        expect.objectContaining({
          issuer: 'ai-auth',
          audience: 'ai-auth-users'
        })
      );
      expect(result).toEqual(mockPayload);
    });

    it('should throw ApiError for expired refresh token', () => {
      // Arrange
      const token = 'expired-refresh-token';
      const mockError = new jwt.TokenExpiredError('Token expired', new Date());
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw mockError;
      });

      // Act & Assert
      expect(() => JwtUtils.verifyRefreshToken(token)).toThrow(ApiError);
      expect(() => JwtUtils.verifyRefreshToken(token)).toThrow('Refresh token has expired');
    });
  });

  describe('getTokenFromHeader', () => {
    it('should extract token from valid Bearer header', () => {
      // Arrange
      const authHeader = 'Bearer valid-token-string';

      // Act
      const result = JwtUtils.getTokenFromHeader(authHeader);

      // Assert
      expect(result).toBe('valid-token-string');
    });

    it('should throw ApiError for missing authorization header', () => {
      // Act & Assert
      expect(() => JwtUtils.getTokenFromHeader(undefined)).toThrow(ApiError);
      expect(() => JwtUtils.getTokenFromHeader(undefined)).toThrow('Authorization header is required');
    });

    it('should throw ApiError for invalid header format', () => {
      // Arrange
      const invalidHeaders = [
        'InvalidFormat token',
        'Bearer', // Missing token
        'token-without-bearer',
        'Bearer token extra-parts' // Too many parts
      ];

      // Act & Assert
      invalidHeaders.forEach(header => {
        expect(() => JwtUtils.getTokenFromHeader(header)).toThrow(ApiError);
        expect(() => JwtUtils.getTokenFromHeader(header)).toThrow('Invalid authorization header format');
      });
    });

    it('should handle edge cases', () => {
      // Test edge cases
      expect(() => JwtUtils.getTokenFromHeader('')).toThrow('Authorization header is required');
      expect(() => JwtUtils.getTokenFromHeader('Bearer ')).toThrow('Invalid authorization header format');
      expect(() => JwtUtils.getTokenFromHeader('Bearer')).toThrow('Invalid authorization header format');
      expect(JwtUtils.getTokenFromHeader('Bearer valid-token')).toBe('valid-token');
    });
  });

  describe('generateTempToken', () => {
    it('should generate temporary token successfully', () => {
      // Arrange
      const payload = { userId: 'test-user-id' };
      const mockToken = 'mock-temp-token';
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      // Act
      const result = JwtUtils.generateTempToken(payload);

      // Assert
      expect(jwt.sign).toHaveBeenCalledWith(
        payload,
        mockJwtSecret,
        expect.objectContaining({
          expiresIn: '10m',
          issuer: 'ai-auth',
          audience: 'ai-auth-temp'
        })
      );
      expect(result).toBe(mockToken);
    });

    it('should throw ApiError when temp token generation fails', () => {
      // Arrange
      const payload = { userId: 'test-user-id' };
      (jwt.sign as jest.Mock).mockImplementation(() => {
        throw new Error('JWT signing failed');
      });

      // Act & Assert
      expect(() => JwtUtils.generateTempToken(payload)).toThrow(ApiError);
      expect(() => JwtUtils.generateTempToken(payload)).toThrow('Failed to generate temporary token');
    });
  });
});
