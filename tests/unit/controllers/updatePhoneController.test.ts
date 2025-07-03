import { UpdatePhoneController } from '../../../src/modules/controllers/updatePhoneController';
import { mockRequest, mockResponse, mockNext } from '../../utils/mockExpress';
import { User } from '../../../src/models/User';
import { OtpService } from '../../../src/services/otpService';
import { AppDataSource } from '../../../src/config/db';
import { PhoneUtils } from '../../../src/utils/phoneUtils';
import { createMockUser } from '../../utils/mockUser';

jest.mock('../../../src/services/otpService');
jest.mock('../../../src/utils/phoneUtils');


class MockUserRepository {
  findOne = jest.fn();
  save = jest.fn();
  update = jest.fn();
  createQueryBuilder = jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn()
  }));
}
const mockUserRepository = new MockUserRepository();


class MockOtpRepository {
  findOne = jest.fn();
  save = jest.fn();
  update = jest.fn();
}
const mockOtpRepository = new MockOtpRepository();

(AppDataSource.getRepository as jest.Mock) = jest.fn((entity) => {
  if (entity.name === 'User') {
    return mockUserRepository;
  }
  return mockOtpRepository;
});

describe('UpdatePhoneController', () => {
  let controller: UpdatePhoneController;
  let mockOtpService: jest.Mocked<OtpService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository.save.mockClear();
    jest.spyOn(require('../../../src/utils/passwordUtils').PasswordUtils, 'comparePassword').mockResolvedValue(true);
    mockOtpService = {
      generateAndSendOtp: jest.fn(),
      verifyOtp: jest.fn(),
      // ...add other methods if needed
    } as any;
    controller = new UpdatePhoneController(
      mockUserRepository as any,
      mockOtpRepository as any,
      mockOtpService as any
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updatePhone', () => {
    it('should start phone update process and send OTP', async () => {
      // Mock user
      const mockUser = createMockUser({
        phone: '1234567890',
        countryCode: '+1',
        pendingPhone: undefined
      });
      
      // Mock request
      const req = mockRequest(
        {
          newPhone: '9876543210',
          countryCode: '+1',
          currentPassword: 'testPassword123'
        },
        { id: mockUser.id }
      );
      
      // Mock repository responses
      mockUserRepository.findOne.mockResolvedValueOnce(mockUser).mockResolvedValueOnce(null);
      mockUserRepository.save.mockResolvedValue({ ...mockUser, pendingPhone: '9876543210' });
      
      // Mock OTP service
      mockOtpService.generateAndSendOtp.mockResolvedValue({ success: true });
      
      // Mock phone utils
      (PhoneUtils.normalizeForStorage as jest.Mock).mockReturnValue({
        phone: '9876543210', 
        countryCode: '+1'
      });
      
      const res = mockResponse();
      
      // Call the raw controller method
      await controller.rawUpdatePhone(req as any, res as any, mockNext);
      // Debug: print save calls
      // eslint-disable-next-line no-console
      console.log('DEBUG save calls:', mockUserRepository.save.mock.calls);
      
      // Assertions
      expect(mockUserRepository.findOne).toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(mockOtpService.generateAndSendOtp).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('confirmUpdatePhone', () => {
    it('should confirm phone update with valid OTP', async () => {
      // Mock user
      const mockUser = createMockUser({
        phone: '1234567890',
        countryCode: '+1',
        pendingPhone: '9876543210',
        isPhoneVerified: false
      });
      
      // Mock request
      const req = mockRequest(
        { newPhone: '9876543210', otp: '123456' },
        { id: mockUser.id }
      );
      
      // Mock OTP repository to return a valid OTP record
      const otpRecord = {
        otp: '123456',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes in future
        used: false,
        purpose: 'phone update',
        user: { id: mockUser.id },
        createdAt: new Date(),
      };
      mockOtpRepository.findOne.mockResolvedValueOnce(otpRecord);
      
      // Mock repository responses
      mockUserRepository.findOne.mockResolvedValueOnce(mockUser);
      mockUserRepository.save.mockResolvedValue({
        ...mockUser,
        phone: '9876543210',
        pendingPhone: null,
        isPhoneVerified: true
      });
      
      const res = mockResponse();
      
      // Call the raw controller method
      await controller.rawConfirmUpdatePhone(req as any, res as any, mockNext);
      // Debug: print save calls
      // eslint-disable-next-line no-console
      console.log('DEBUG save calls:', mockUserRepository.save.mock.calls);
      
      // Assertions
      expect(mockUserRepository.findOne).toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
