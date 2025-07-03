// tests/unit/controllers/twoFAController.simplified.test.ts
import { TwoFAController } from '../../../src/modules/controllers/twoFAController';
import { createMockUser } from '../../utils/mockUser';
import { ApiError } from '../../../src/utils/ApiError';
import { PasswordUtils } from '../../../src/utils/passwordUtils';
import { OtpService } from '../../../src/services/otpService';

// Mock dependencies
jest.mock('../../../src/utils/passwordUtils');
jest.mock('../../../src/services/otpService');

describe('TwoFAController', () => {
  // Mock user data
  const mockUser = createMockUser();
  
  // Mock repositories and services
  let mockUserRepository: any;
  let mockOtpService: any;
  let twoFAController: TwoFAController;
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    jest.resetAllMocks();
    mockUserRepository = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(user => Promise.resolve(user))
    };
    mockOtpService = {
      generateAndSendOtp: jest.fn().mockResolvedValue({ success: true, otpId: 'test-otp-id' }),
      generateSecretFor2FA: jest.fn().mockResolvedValue({ secret: 'test-secret', qrCode: 'test-qr-code' }),
      verifyOtp: jest.fn().mockResolvedValue({ isValid: true, otpRecord: { secret: 'test-secret', type: 'email' } })
    };
    // Inject mocks via constructor
    twoFAController = new TwoFAController(mockUserRepository, mockOtpService);
    mockReq = { user: { id: mockUser.id }, body: {} };
    mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    mockNext = jest.fn();
    mockUserRepository.findOne.mockResolvedValue(mockUser);
    (PasswordUtils.comparePassword as jest.Mock).mockResolvedValue(true);
  });
  
  describe('addAdditional2FAMethod', () => {
    it('should initiate setup for additional 2FA method with email', async () => {
      // Arrange
      const user2FA = {
        ...mockUser,
        is2FAEnabled: true,
        preferred2FAMethods: 'sms',
        isEmailVerified: true // required for email 2FA
      };
      mockUserRepository.findOne.mockResolvedValue(user2FA);
      mockReq.body = { method: 'email', password: 'test-password' };

      // Act
      await twoFAController.addAdditional2FAMethodRaw(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockOtpService.generateAndSendOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          id: user2FA.id,
          email: user2FA.email,
          is2FAEnabled: true
        }),
        'email',
        '2fa_additional_setup'
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalled();
    });
    
    it('should reject setup if 2FA is not enabled', async () => {
      // Arrange
      const userWithout2FA = { ...mockUser, is2FAEnabled: false, isEmailVerified: true };
      mockUserRepository.findOne.mockResolvedValue(userWithout2FA);
      mockReq.body = { method: 'email', password: 'test-password' };

      // Act
      await twoFAController.addAdditional2FAMethodRaw(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: '2FA must be enabled first before adding additional methods'
        })
      );
    });
    
    it('should reject setup if method is already enabled', async () => {
      // Arrange
      const userWithEmail2FA = {
        ...mockUser,
        is2FAEnabled: true,
        preferred2FAMethods: 'email,sms',
        isEmailVerified: true
      };
      mockUserRepository.findOne.mockResolvedValue(userWithEmail2FA);
      mockReq.body = { method: 'email', password: 'test-password' };

      // Act
      await twoFAController.addAdditional2FAMethodRaw(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'email is already enabled for 2FA'
        })
      );
    });
  });
  
  describe('verifyAdditional2FAMethod', () => {
    it('should verify and add SMS as additional 2FA method', async () => {
      // Arrange
      const userWith2FA = {
        ...mockUser,
        is2FAEnabled: true,
        preferred2FAMethods: 'email',
        isPhoneVerified: true
      };
      mockUserRepository.findOne.mockResolvedValue(userWith2FA);
      mockOtpService.verifyOtp.mockResolvedValue({
        isValid: true,
        otpRecord: { type: 'sms' }
      });
      mockReq.body = { code: '123456', method: 'sms' };

      // Act
      await twoFAController.verifyAdditional2FAMethodRaw(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: userWith2FA.id,
          preferred2FAMethods: 'email,sms'
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalled();
    });
    
    it('should reject verification with invalid code', async () => {
      // Arrange
      const userWith2FA = {
        ...mockUser,
        is2FAEnabled: true,
        preferred2FAMethods: 'email',
        isPhoneVerified: true
      };
      mockUserRepository.findOne.mockResolvedValue(userWith2FA);
      mockOtpService.verifyOtp.mockResolvedValue({ isValid: false });
      mockReq.body = { code: '123456', method: 'sms' };

      // Act
      await twoFAController.verifyAdditional2FAMethodRaw(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Invalid or expired verification code'
        })
      );
    });
    
    it('should handle errors during verification', async () => {
      // Arrange
      const userWith2FA = {
        ...mockUser,
        is2FAEnabled: true,
        preferred2FAMethods: 'email',
        isPhoneVerified: true
      };
      mockUserRepository.findOne.mockResolvedValue(userWith2FA);
      mockOtpService.verifyOtp.mockRejectedValue(new Error('Database error'));
      mockReq.body = { code: '123456', method: 'sms' };

      // Act
      await twoFAController.verifyAdditional2FAMethodRaw(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          message: 'Additional 2FA method verification failed. Please try again later.'
        })
      );
    });
  });
});
