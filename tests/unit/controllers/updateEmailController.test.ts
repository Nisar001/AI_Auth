import { UpdateEmailController } from '../../../src/modules/controllers/updateEmailController';
import { mockRequest, mockResponse, mockNext } from '../../utils/mockExpress';
import { User } from '../../../src/models/User';
import { OtpService } from '../../../src/services/otpService';
import { PasswordUtils } from '../../../src/utils/passwordUtils';
import { ApiError } from '../../../src/utils/ApiError';
import { AppDataSource } from '../../../src/config/db';

jest.mock('../../../src/services/otpService');
jest.mock('../../../src/utils/passwordUtils');
jest.mock('../../../src/config/db');


const mockUserRepository = {
  findOne: jest.fn(),
  save: jest.fn(),
  update: jest.fn()
};
const mockOtpRepository = {
  findOne: jest.fn(),
  save: jest.fn(),
  update: jest.fn()
};

let getRepositorySpy: jest.SpyInstance;

describe('UpdateEmailController', () => {
  let controller: UpdateEmailController;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock AppDataSource.getRepository globally
    if (getRepositorySpy) getRepositorySpy.mockRestore();
    getRepositorySpy = jest.spyOn(AppDataSource, 'getRepository').mockImplementation((model: any) => {
      if (model.name === 'User') return mockUserRepository as any;
      return mockOtpRepository as any;
    });
    // Mock OtpService.generateAndSendOtp for all instances
    (OtpService.prototype.generateAndSendOtp as jest.Mock) = jest.fn();
    controller = new UpdateEmailController();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateEmail', () => {
    it('should send OTP to new email if password is correct', async () => {
      const mockUser = { 
        id: 'user-id', 
        email: 'old@example.com', 
        password: 'hashedPass', 
        pendingEmail: undefined 
      } as User;

      const req = mockRequest(
        { newEmail: 'new@example.com', currentPassword: 'currentPass' },
        { id: 'user-id' }
      );

      mockUserRepository.findOne.mockResolvedValueOnce(mockUser);
      (PasswordUtils.comparePassword as jest.Mock).mockResolvedValueOnce(true);
      mockUserRepository.save.mockResolvedValueOnce(mockUser);
      (OtpService.prototype.generateAndSendOtp as jest.Mock).mockResolvedValueOnce({ success: true });

      const res = mockResponse();
      const next = jest.fn();

      await controller.rawUpdateEmail(req as any, res as any, next);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-id' }
      });

      expect(OtpService.prototype.generateAndSendOtp).toHaveBeenCalledWith(
        expect.objectContaining({ 
          id: 'user-id',
          email: 'new@example.com'
        }),
        'email',
        'email update'
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(next).not.toHaveBeenCalled();
    });

    it('should throw error if password is incorrect', async () => {
      const mockUser = { 
        id: 'user-id', 
        email: 'old@example.com', 
        password: 'hashedPass' 
      } as User;

      const req = mockRequest(
        { newEmail: 'new@example.com', currentPassword: 'wrongPass' },
        { id: 'user-id' }
      );

      mockUserRepository.findOne.mockResolvedValueOnce(mockUser);
      (PasswordUtils.comparePassword as jest.Mock).mockResolvedValueOnce(false);

      const res = mockResponse();
      const next = jest.fn();

      let thrownError;
      try {
        await controller.rawUpdateEmail(req as any, res as any, next);
      } catch (err) {
        thrownError = err;
      }
      expect(thrownError).toBeInstanceOf(ApiError);
      expect((thrownError as ApiError).statusCode).toBe(401);
    });
  });

  describe('confirmUpdateEmail', () => {
    it('should confirm OTP and update email', async () => {
      const mockUser = { 
        id: 'user-id', 
        pendingEmail: 'new@example.com', 
        email: 'old@example.com', 
        isEmailVerified: false 
      } as User;

      const mockOtpRecord = {
        user: { id: 'user-id' },
        type: 'email',
        otp: '123456',
        expiresAt: new Date(Date.now() + 60000),
        used: false,
        purpose: 'email update'
      };

      const req = mockRequest(
        { newEmail: 'new@example.com', otp: '123456' },
        { id: 'user-id' },
        {},
        {},
        '127.0.0.1'
      );

      mockUserRepository.findOne.mockResolvedValueOnce(mockUser);
      mockOtpRepository.findOne.mockResolvedValueOnce(mockOtpRecord);
      mockUserRepository.save.mockResolvedValueOnce({ 
        ...mockUser, 
        email: 'new@example.com',
        pendingEmail: undefined,
        isEmailVerified: true 
      });
      mockOtpRepository.save.mockResolvedValueOnce({ ...mockOtpRecord, used: true });
      mockOtpRepository.update.mockResolvedValueOnce({ affected: 1 });

      const res = mockResponse();
      const next = jest.fn();

      await controller.rawConfirmUpdateEmail(req as any, res as any, next);

      expect(mockOtpRepository.findOne).toHaveBeenCalledWith({
        where: {
          user: { id: 'user-id' },
          type: 'email',
          otp: '123456',
          used: false,
          purpose: 'email update'
        },
        order: { createdAt: 'DESC' }
      });

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'user-id',
          email: 'new@example.com',
          pendingEmail: undefined,
          isEmailVerified: true
        })
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(next).not.toHaveBeenCalled();
    });

    it('should throw error if OTP is expired', async () => {
      const mockUser = { 
        id: 'user-id', 
        pendingEmail: 'new@example.com' 
      } as User;

      const mockOtpRecord = {
        user: { id: 'user-id' },
        type: 'email',
        otp: '123456',
        expiresAt: new Date(Date.now() - 60000),
        used: false,
        purpose: 'email update'
      };

      const req = mockRequest(
        { newEmail: 'new@example.com', otp: '123456' },
        { id: 'user-id' },
        {},
        {},
        '127.0.0.1'
      );

      mockUserRepository.findOne.mockResolvedValueOnce(mockUser);
      mockOtpRepository.findOne.mockResolvedValueOnce(mockOtpRecord);
      mockOtpRepository.save.mockResolvedValueOnce({ ...mockOtpRecord, used: true });

      const res = mockResponse();
      const next = jest.fn();

      let thrownError;
      try {
        await controller.rawConfirmUpdateEmail(req as any, res as any, next);
      } catch (err) {
        thrownError = err;
      }
      expect(thrownError).toBeInstanceOf(ApiError);
      expect((thrownError as ApiError).statusCode).toBe(400);
      expect((thrownError as ApiError).message).toBe('OTP has expired. Please request a new one.');
    });
  });
});
