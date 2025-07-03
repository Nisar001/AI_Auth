// Mock dependencies FIRST, before any imports
jest.mock('../../../src/config/db', () => ({
  AppDataSource: {
    getRepository: jest.fn()
  }
}));

jest.mock('../../../src/utils/logger');
jest.mock('../../../src/services/emailService');
jest.mock('../../../src/services/smsService');
jest.mock('../../../src/utils/otpGenerator');
jest.mock('speakeasy');
jest.mock('qrcode');

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

// Now import everything else
import { OtpService } from '../../../src/services/otpService';
import { User } from '../../../src/models/User';
import { OtpService as OtpModel } from '../../../src/models/OtpService';
import { OtpGenerator } from '../../../src/utils/otpGenerator';
import { EmailService } from '../../../src/services/emailService';
import { SmsService } from '../../../src/services/smsService';
import { ApiError } from '../../../src/utils/ApiError';
import { createMockUser } from '../../utils/mockUser';
import { MoreThanOrEqual } from 'typeorm';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

describe('OtpService', () => {
  let otpService: OtpService;
  let mockUserRepository: any;
  let mockOtpRepository: any;
  let mockUser: User;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock repositories
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
      count: jest.fn(),
      create: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        delete: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 })
      }))
    };

    const { AppDataSource } = require('../../../src/config/db');
    (AppDataSource.getRepository as jest.Mock)
      .mockImplementation((entity) => {
        if (entity === User) return mockUserRepository;
        if (entity === OtpModel) return mockOtpRepository;
        return null;
      });

    // Create mock user
    mockUser = createMockUser({
      email: 'john.doe@example.com',
      phone: '1234567890',
      countryCode: '+1',
      isEmailVerified: true,
      isPhoneVerified: true
    });

    // Create service instance
    otpService = new OtpService();
  });

  describe('generateAndSendOtp', () => {
    it('should generate and send email OTP successfully', async () => {
      // Arrange
      const mockOtp = '123456';
      const mockExpiresAt = new Date(Date.now() + 600000); // 10 minutes in the future
      
      (OtpGenerator.generateSecureOtp as jest.Mock).mockReturnValue(mockOtp);
      (OtpGenerator.getOtpExpiry as jest.Mock).mockReturnValue(mockExpiresAt);

      const mockOtpRecord = {
        id: 'otp-id',
        user: mockUser,
        otp: mockOtp,
        type: 'email' as const,
        expiresAt: mockExpiresAt,
        used: false,
        purpose: 'verification'
      };

      mockOtpRepository.create.mockReturnValue(mockOtpRecord);
      mockOtpRepository.save.mockResolvedValue({ ...mockOtpRecord, id: 'saved-otp-id' });

      // Mock emailService
      const mockEmailService = new EmailService();
      (mockEmailService.sendOTPEmail as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await otpService.generateAndSendOtp(mockUser, 'email', 'verification');

      // Assert
      expect(OtpGenerator.generateSecureOtp).toHaveBeenCalledWith(6);
      expect(OtpGenerator.getOtpExpiry).toHaveBeenCalled();
      
      expect(mockOtpRepository.create).toHaveBeenCalledWith({
        user: mockUser,
        otp: mockOtp,
        secret: undefined,
        type: 'email',
        expiresAt: mockExpiresAt,
        used: false,
        purpose: 'verification'
      });
      
      expect(mockOtpRepository.save).toHaveBeenCalledWith(mockOtpRecord);
      
      expect(EmailService.prototype.sendOTPEmail).toHaveBeenCalledWith(
        'john.doe@example.com',
        mockOtp,
        'verification'
      );
      
      expect(result).toEqual({
        success: true,
        otpId: 'saved-otp-id'
      });
    });

    it('should generate and send SMS OTP successfully', async () => {
      // Arrange
      const mockOtp = '123456';
      const mockExpiresAt = new Date(Date.now() + 600000); // 10 minutes in the future
      
      (OtpGenerator.generateSecureOtp as jest.Mock).mockReturnValue(mockOtp);
      (OtpGenerator.getOtpExpiry as jest.Mock).mockReturnValue(mockExpiresAt);

      const mockOtpRecord = {
        id: 'otp-id',
        user: mockUser,
        otp: mockOtp,
        type: 'sms' as const,
        expiresAt: mockExpiresAt,
        used: false,
        purpose: 'login'
      };

      mockOtpRepository.create.mockReturnValue(mockOtpRecord);
      mockOtpRepository.save.mockResolvedValue({ ...mockOtpRecord, id: 'saved-otp-id' });

      // Mock smsService
      const mockSmsService = new SmsService();
      (mockSmsService.sendOTPSms as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await otpService.generateAndSendOtp(mockUser, 'sms', 'login');

      // Assert
      expect(OtpGenerator.generateSecureOtp).toHaveBeenCalledWith(6);
      expect(mockOtpRepository.create).toHaveBeenCalledWith({
        user: mockUser,
        otp: mockOtp,
        secret: undefined,
        type: 'sms',
        expiresAt: mockExpiresAt,
        used: false,
        purpose: 'login'
      });
      
      expect(SmsService.prototype.sendOTPSms).toHaveBeenCalledWith(
        '+11234567890',
        mockOtp,
        'login'
      );
      
      expect(result).toEqual({
        success: true,
        otpId: 'saved-otp-id'
      });
    });

    it('should generate auth app OTP with QR code', async () => {
      // Arrange
      const mockSecret = 'ABCDEF123456';
      const mockOtp = '123456';
      const mockQrCode = 'data:image/png;base64,qrCodeData';
      const mockExpiresAt = new Date(Date.now() + 600000);
      
      // Mock speakeasy
      (speakeasy.generateSecret as jest.Mock).mockReturnValue({
        base32: mockSecret,
        otpauth_url: 'otpauth://totp/AI%20Auth%20(john.doe@example.com)?secret=ABCDEF123456&issuer=AI%20Auth'
      });
      
      (speakeasy.totp as unknown as jest.Mock).mockReturnValue(mockOtp);
      
      // Mock QRCode
      (QRCode.toDataURL as jest.Mock).mockResolvedValue(mockQrCode);
      
      (OtpGenerator.getOtpExpiry as jest.Mock).mockReturnValue(mockExpiresAt);

      const mockOtpRecord = {
        id: 'otp-id',
        user: mockUser,
        otp: mockOtp,
        secret: mockSecret,
        type: 'auth_app' as const,
        expiresAt: mockExpiresAt,
        used: false,
        purpose: '2fa_setup'
      };

      mockOtpRepository.create.mockReturnValue(mockOtpRecord);
      mockOtpRepository.save.mockResolvedValue({ ...mockOtpRecord, id: 'saved-otp-id' });

      // Act
      const result = await otpService.generateAndSendOtp(mockUser, 'auth_app', '2fa_setup');

      // Assert
      expect(speakeasy.generateSecret).toHaveBeenCalledWith({
        name: `AI Auth (john.doe@example.com)`,
        issuer: 'AI Auth'
      });
      
      expect(QRCode.toDataURL).toHaveBeenCalledWith(
        'otpauth://totp/AI%20Auth%20(john.doe@example.com)?secret=ABCDEF123456&issuer=AI%20Auth'
      );
      
      expect(mockOtpRepository.create).toHaveBeenCalledWith({
        user: mockUser,
        otp: mockOtp,
        secret: mockSecret,
        type: 'auth_app',
        expiresAt: mockExpiresAt,
        used: false,
        purpose: '2fa_setup'
      });
      
      expect(result).toEqual({
        success: true,
        otpId: 'saved-otp-id',
        qrCode: mockQrCode,
        secret: mockSecret
      });
    });

    it('should handle errors when generating OTP', async () => {
      // Arrange
      (OtpGenerator.generateSecureOtp as jest.Mock).mockImplementation(() => {
        throw new Error('Failed to generate OTP');
      });

      // Act & Assert
      await expect(otpService.generateAndSendOtp(mockUser, 'email')).rejects.toThrow(
        new ApiError(500, 'Failed to generate OTP')
      );
    });
  });

  describe('verifyOtp', () => {
    it('should verify regular email OTP successfully', async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      
      const mockOtpRecord = {
        id: 'otp-id',
        user: mockUser,
        otp: '123456',
        type: 'email' as const,
        expiresAt: new Date(Date.now() + 3600000), // Not expired
        used: false
      };

      mockOtpRepository.findOne.mockResolvedValue(mockOtpRecord);
      (OtpGenerator.isOtpExpired as jest.Mock).mockReturnValue(false);

      // Act
      const result = await otpService.verifyOtp(mockUser.id, '123456', 'email');

      // Assert
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id }
      });
      
      expect(mockOtpRepository.findOne).toHaveBeenCalledWith({
        where: {
          user: { id: mockUser.id },
          otp: '123456',
          type: 'email',
          used: false
        },
        order: { createdAt: 'DESC' }
      });
      
      expect(OtpGenerator.isOtpExpired).toHaveBeenCalledWith(mockOtpRecord.expiresAt);
      
      expect(mockOtpRepository.save).toHaveBeenCalledWith({
        ...mockOtpRecord,
        used: true
      });
      
      expect(result).toEqual({
        isValid: true,
        otpRecord: mockOtpRecord
      });
    });

    it('should verify auth app OTP using TOTP', async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      
      const mockOtpRecord = {
        id: 'otp-id',
        user: mockUser,
        otp: '000000', // Placeholder
        secret: 'SECRET123',
        type: 'auth_app' as const,
        expiresAt: new Date(Date.now() + 3600000),
        used: false
      };

      mockOtpRepository.findOne.mockResolvedValue(mockOtpRecord);
      
      // Mock speakeasy verification
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);

      // Act
      const result = await otpService.verifyOtp(mockUser.id, '123456', 'auth_app');

      // Assert
      expect(mockOtpRepository.findOne).toHaveBeenCalledWith({
        where: {
          user: { id: mockUser.id },
          type: 'auth_app',
          used: false
        },
        order: { createdAt: 'DESC' }
      });
      
      expect(speakeasy.totp.verify).toHaveBeenCalledWith({
        secret: 'SECRET123',
        encoding: 'base32',
        token: '123456',
        window: 2
      });
      
      expect(mockOtpRepository.save).toHaveBeenCalledWith({
        ...mockOtpRecord,
        used: true
      });
      
      expect(result).toEqual({
        isValid: true,
        otpRecord: mockOtpRecord
      });
    });

    it('should return isValid=false for invalid regular OTP', async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockOtpRepository.findOne.mockResolvedValue(null); // No matching OTP found

      // Act
      const result = await otpService.verifyOtp(mockUser.id, 'invalid-code', 'sms');

      // Assert
      expect(mockOtpRepository.findOne).toHaveBeenCalledWith({
        where: {
          user: { id: mockUser.id },
          otp: 'invalid-code',
          type: 'sms',
          used: false
        },
        order: { createdAt: 'DESC' }
      });
      
      expect(result).toEqual({
        isValid: false
      });
      
      expect(mockOtpRepository.save).not.toHaveBeenCalled();
    });

    it('should return isValid=false for expired OTP', async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      
      const mockOtpRecord = {
        id: 'otp-id',
        user: mockUser,
        otp: '123456',
        type: 'email' as const,
        expiresAt: new Date(Date.now() - 3600000), // Expired (1 hour ago)
        used: false
      };

      mockOtpRepository.findOne.mockResolvedValue(mockOtpRecord);
      (OtpGenerator.isOtpExpired as jest.Mock).mockReturnValue(true); // OTP is expired

      // Act
      const result = await otpService.verifyOtp(mockUser.id, '123456', 'email');

      // Assert
      expect(OtpGenerator.isOtpExpired).toHaveBeenCalledWith(mockOtpRecord.expiresAt);
      
      expect(result).toEqual({
        isValid: false
      });
      
      expect(mockOtpRepository.save).not.toHaveBeenCalled();
    });

    it('should return isValid=false for invalid TOTP', async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      
      const mockOtpRecord = {
        id: 'otp-id',
        user: mockUser,
        otp: '000000',
        secret: 'SECRET123',
        type: 'auth_app' as const,
        expiresAt: new Date(Date.now() + 3600000),
        used: false
      };

      mockOtpRepository.findOne.mockResolvedValue(mockOtpRecord);
      
      // Mock speakeasy verification to fail
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(false);

      // Act
      const result = await otpService.verifyOtp(mockUser.id, 'invalid-code', 'auth_app');

      // Assert
      expect(speakeasy.totp.verify).toHaveBeenCalled();
      
      expect(result).toEqual({
        isValid: false
      });
      
      expect(mockOtpRepository.save).not.toHaveBeenCalled();
    });

    it('should handle user not found error', async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(otpService.verifyOtp('non-existent-user', '123456', 'email')).rejects.toThrow(
        new ApiError(404, 'User not found')
      );
    });

    it('should handle general errors gracefully', async () => {
      // Arrange
      mockUserRepository.findOne.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(otpService.verifyOtp(mockUser.id, '123456', 'email')).rejects.toThrow(
        new ApiError(500, 'Failed to verify OTP')
      );
    });
  });

  describe('resendOtp', () => {
    it('should successfully resend OTP after cooldown period', async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      
      // Previous OTP sent more than 1 minute ago
      const oldOtpRecord = {
        id: 'old-otp-id',
        user: mockUser,
        otp: '123456',
        type: 'email' as const,
        expiresAt: new Date(Date.now() + 3600000),
        used: false,
        createdAt: new Date(Date.now() - 120000) // 2 minutes ago
      };

      mockOtpRepository.findOne.mockResolvedValue(oldOtpRecord);
      
      // Mock the generateAndSendOtp method
      const generateResult = {
        success: true,
        otpId: 'new-otp-id'
      };
      
      jest.spyOn(otpService, 'generateAndSendOtp').mockResolvedValue(generateResult);

      // Act
      const result = await otpService.resendOtp(mockUser.id, 'email', 'verification');

      // Assert
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id }
      });
      
      expect(mockOtpRepository.findOne).toHaveBeenCalledWith({
        where: {
          user: { id: mockUser.id },
          type: 'email',
          used: false
        },
        order: { createdAt: 'DESC' }
      });
      
      // Old OTPs should be invalidated
      expect(mockOtpRepository.update).toHaveBeenCalledWith(
        {
          user: { id: mockUser.id },
          type: 'email',
          used: false
        },
        { used: true }
      );
      
      // New OTP should be generated and sent
      expect(otpService.generateAndSendOtp).toHaveBeenCalledWith(mockUser, 'email', 'verification');
      
      expect(result).toEqual(generateResult);
    });

    it('should reject resend if cooldown period has not passed', async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      
      // Previous OTP sent less than 1 minute ago
      const recentOtpRecord = {
        id: 'recent-otp-id',
        user: mockUser,
        otp: '123456',
        type: 'email' as const,
        expiresAt: new Date(Date.now() + 3600000),
        used: false,
        createdAt: new Date(Date.now() - 30000) // 30 seconds ago
      };

      mockOtpRepository.findOne.mockResolvedValue(recentOtpRecord);

      // Act & Assert
      await expect(otpService.resendOtp(mockUser.id, 'email')).rejects.toThrow(
        new ApiError(429, 'Please wait before requesting another OTP')
      );
      
      expect(mockOtpRepository.update).not.toHaveBeenCalled();
      expect(mockOtpRepository.save).not.toHaveBeenCalled();
    });

    it('should handle user not found error', async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(otpService.resendOtp('non-existent-user', 'email')).rejects.toThrow(
        new ApiError(404, 'User not found')
      );
    });
  });

  describe('generateSecretFor2FA', () => {
    it('should generate 2FA secret and QR code successfully', async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      
      const mockSecret = {
        base32: 'BASE32SECRET',
        otpauth_url: 'otpauth://totp/AI%20Auth%20(john.doe@example.com)?secret=BASE32SECRET&issuer=AI%20Auth'
      };
      
      const mockQrCode = 'data:image/png;base64,qrCodeData';
      
      (speakeasy.generateSecret as jest.Mock).mockReturnValue(mockSecret);
      (QRCode.toDataURL as jest.Mock).mockResolvedValue(mockQrCode);
      
      const mockOtpRecord = {
        id: 'otp-id',
        user: mockUser,
        otp: '000000',
        secret: 'BASE32SECRET',
        type: 'auth_app' as const,
        expiresAt: new Date(Date.now() + 600000),
        used: false
      };
      
      mockOtpRepository.create.mockReturnValue(mockOtpRecord);
      mockOtpRepository.save.mockResolvedValue({ ...mockOtpRecord, id: 'saved-otp-id' });

      // Act
      const result = await otpService.generateSecretFor2FA(mockUser.id);

      // Assert
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id }
      });
      
      expect(speakeasy.generateSecret).toHaveBeenCalledWith({
        name: `AI Auth (john.doe@example.com)`,
        issuer: 'AI Auth'
      });
      
      expect(QRCode.toDataURL).toHaveBeenCalledWith(mockSecret.otpauth_url);
      
      expect(mockOtpRepository.create).toHaveBeenCalledWith({
        user: mockUser,
        otp: '000000',
        secret: 'BASE32SECRET',
        type: 'auth_app',
        expiresAt: expect.any(Date),
        used: false
      });
      
      expect(result).toEqual({
        secret: 'BASE32SECRET',
        qrCode: mockQrCode
      });
    });

    it('should handle user not found error', async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(otpService.generateSecretFor2FA('non-existent-user')).rejects.toThrow(
        new ApiError(404, 'User not found')
      );
    });

    it('should handle general errors gracefully', async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (speakeasy.generateSecret as jest.Mock).mockImplementation(() => {
        throw new Error('Failed to generate secret');
      });

      // Act & Assert
      await expect(otpService.generateSecretFor2FA(mockUser.id)).rejects.toThrow(
        new ApiError(500, 'Failed to generate 2FA secret')
      );
    });
  });

  describe('countRecentOtps', () => {
    it('should correctly count recent OTPs', async () => {
      // Arrange
      const since = new Date(Date.now() - 3600000); // 1 hour ago
      mockOtpRepository.count.mockResolvedValue(3);

      // Act
      const result = await otpService.countRecentOtps(mockUser.id, 'email', 'verification', since);

      // Assert
      expect(mockOtpRepository.count).toHaveBeenCalledWith({
        where: {
          user: { id: mockUser.id },
          type: 'email',
          purpose: 'verification',
          createdAt: MoreThanOrEqual(since)
        }
      });
      
      expect(result).toBe(3);
    });

    it('should return 0 if counting fails', async () => {
      // Arrange
      const since = new Date(Date.now() - 3600000);
      mockOtpRepository.count.mockRejectedValue(new Error('Count failed'));

      // Act
      const result = await otpService.countRecentOtps(mockUser.id, 'email', 'verification', since);

      // Assert
      expect(result).toBe(0);
    });
  });
});
