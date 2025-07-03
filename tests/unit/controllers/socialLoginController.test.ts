// import { SocialLoginController } from '../../../src/modules/controllers/socialLoginController';
import { ApiError } from '../../../src/utils/ApiError';
import { ApiResponse } from '../../../src/utils/ApiResponse';
import { User } from '../../../src/models/User';
import { JwtUtils } from '../../../src/utils/jwtUtils';

// Mocks
let mockUserRepository: any;
let mockEmailService: any;

jest.mock('../../../src/config/db', () => ({
  AppDataSource: { getRepository: jest.fn(() => mockUserRepository) }
}));
jest.mock('../../../src/services/emailService', () => ({
  EmailService: jest.fn(() => mockEmailService)
}));
jest.mock('../../../src/utils/jwtUtils');

describe('SocialLoginController', () => {
  let controller: any;
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    jest.resetModules(); // Clear module cache
    jest.clearAllMocks();
    mockUserRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    mockEmailService = {
      sendWelcomeEmail: jest.fn(),
    };
    jest.doMock('../../../src/config/db', () => ({
      AppDataSource: { getRepository: jest.fn(() => mockUserRepository) }
    }));
    jest.doMock('../../../src/services/emailService', () => ({
      EmailService: jest.fn(() => mockEmailService)
    }));
    jest.doMock('../../../src/utils/jwtUtils');
    const { SocialLoginController: ControllerClass } = require('../../../src/modules/controllers/socialLoginController');
    controller = new ControllerClass();
    req = { body: {}, user: { id: 'user-id' } };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  describe('getGoogleAuthUrl', () => {
    it('should return a Google OAuth URL', async () => {
      process.env.GOOGLE_CLIENT_ID = 'test-client-id';
      process.env.GOOGLE_REDIRECT_URI = 'http://localhost/callback';
      await controller.getGoogleAuthUrl(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
    it('should throw error if config missing', async () => {
      process.env.GOOGLE_CLIENT_ID = '';
      await controller.getGoogleAuthUrl(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Google OAuth configuration missing' }));
    });
  });

  describe('getGitHubAuthUrl', () => {
    it('should return a GitHub OAuth URL', async () => {
      process.env.GITHUB_CLIENT_ID = 'test-client-id';
      process.env.GITHUB_REDIRECT_URI = 'http://localhost/callback';
      await controller.getGitHubAuthUrl(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
    it('should throw error if config missing', async () => {
      process.env.GITHUB_CLIENT_ID = '';
      await controller.getGitHubAuthUrl(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'GitHub OAuth configuration missing' }));
    });
  });

  describe('socialLogin', () => {
    it('should create a new user if not found', async () => {
      req.body = { provider: 'google', accessToken: 'token', email: 'test@example.com', name: 'Test User', socialId: '123', avatar: 'avatar' };
      jest.spyOn(controller as any, 'verifyAccessToken').mockResolvedValue(true);
      // First call: find by email, Second call: find by socialId+authType
      mockUserRepository.findOne.mockImplementation((arg: any) => {
        if (arg && Array.isArray(arg.where)) return null; // No user found by email or socialId
        return null;
      });
      const userObj = {
        id: 'new-user-id',
        fname: 'Test',
        lname: 'User',
        mname: '',
        email: 'test@example.com',
        phone: '',
        countryCode: '+1',
        isEmailVerified: true,
        isPhoneVerified: false,
        is2FAEnabled: false,
        authType: 'google',
        avatar: 'avatar',
        socialId: '123',
        lastLoginAt: new Date(),
        tokenVersion: 1,
        password: 'hashed',
        city: '',
        state: '',
        country: '',
        pincode: '',
        dob: new Date('1990-01-01'),
        loginAttempts: 0
      };
      mockUserRepository.create.mockReturnValue(userObj);
      mockUserRepository.save.mockResolvedValue(userObj);
      (JwtUtils.generateAccessToken as jest.Mock).mockReturnValue('access-token');
      (JwtUtils.generateRefreshToken as jest.Mock).mockReturnValue('refresh-token');
      // Ensure res mocks are reset
      res.status.mockClear();
      res.json.mockClear();
      await controller.socialLogin(req, res, next);
      // Wait for all async code
      await new Promise(resolve => setImmediate(resolve));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
    it('should return error if provider is missing', async () => {
      req.body = { accessToken: 'token', email: 'test@example.com', socialId: '123' };
      mockUserRepository.findOne.mockReset();
      jest.spyOn(controller as any, 'verifyAccessToken').mockResolvedValue(true); // ensure no real call
      await controller.socialLogin(req, res, next);
      await Promise.resolve();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Provider, access token, email, and social ID are required' }));
    });
    it('should return error if token is invalid', async () => {
      req.body = { provider: 'google', accessToken: 'token', email: 'test@example.com', socialId: '123' };
      mockUserRepository.findOne.mockReset();
      jest.spyOn(controller as any, 'verifyAccessToken').mockResolvedValue(false);
      await controller.socialLogin(req, res, next);
      await Promise.resolve();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Invalid access token' }));
    });
  });

  describe('linkSocialAccount', () => {
    it('should link a social account to user', async () => {
      req.body = { provider: 'google', socialId: '123', email: 'test@example.com' };
      req.user = { id: 'user-id' };
      const currentUser = {
        id: 'user-id',
        email: 'test@example.com',
        socialId: undefined,
        authType: 'email',
        password: 'hashed',
        fname: 'Test',
        lname: 'User',
        mname: '',
        is2FAEnabled: false,
        countryCode: '+1',
        phone: '',
        isEmailVerified: true,
        isPhoneVerified: false,
        lastLoginAt: new Date(),
        avatar: '',
        city: '',
        state: '',
        country: '',
        pincode: '',
        dob: new Date('1990-01-01'),
        loginAttempts: 0
      };
      // First call: find current user by id, Second call: check if socialId+provider is already linked
      mockUserRepository.findOne.mockImplementationOnce(() => currentUser).mockImplementationOnce(() => null);
      const updatedUser = { ...currentUser, socialId: '123', authType: 'google' };
      mockUserRepository.save.mockResolvedValue(updatedUser);
      res.status.mockClear();
      res.json.mockClear();
      await controller.linkSocialAccount(req, res, next);
      await new Promise(resolve => setImmediate(resolve));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
    it('should throw error if already linked', async () => {
      req.body = { provider: 'google', socialId: '123', email: 'test@example.com' };
      req.user = { id: 'user-id' };
      const currentUser = {
        id: 'user-id',
        email: 'test@example.com',
        socialId: undefined,
        authType: 'email',
        password: 'hashed',
        fname: 'Test',
        lname: 'User',
        mname: '',
        is2FAEnabled: false,
        countryCode: '+1',
        phone: '',
        isEmailVerified: true,
        isPhoneVerified: false,
        lastLoginAt: new Date(),
        avatar: '',
        city: '',
        state: '',
        country: '',
        pincode: '',
        dob: new Date('1990-01-01'),
        loginAttempts: 0
      };
      const existingUser = {
        id: 'other-user',
        email: 'other@example.com',
        socialId: '123',
        authType: 'google',
        password: 'hashed',
        fname: 'Other',
        lname: 'User',
        mname: '',
        is2FAEnabled: false,
        countryCode: '+1',
        phone: '',
        isEmailVerified: true,
        isPhoneVerified: false,
        lastLoginAt: new Date(),
        avatar: '',
        city: '',
        state: '',
        country: '',
        pincode: '',
        dob: new Date('1990-01-01'),
        loginAttempts: 0
      };
      mockUserRepository.findOne.mockImplementationOnce(() => currentUser).mockImplementationOnce(() => existingUser);
      res.status.mockClear();
      res.json.mockClear();
      next.mockClear();
      await controller.linkSocialAccount(req, res, next);
      await new Promise(resolve => setImmediate(resolve));
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'This social account is already linked to another user' }));
    });
  });

  describe('unlinkSocialAccount', () => {
    it('should unlink a social account', async () => {
      mockUserRepository.findOne.mockReset();
      mockUserRepository.findOne.mockResolvedValueOnce({ id: 'user-id', email: 'test@example.com', socialId: '123', password: 'hashed', authType: 'google', mname: '', lname: 'User', is2FAEnabled: false, countryCode: '+1', phone: '', isEmailVerified: true, isPhoneVerified: false, lastLoginAt: new Date() });
      mockUserRepository.save.mockResolvedValue({ id: 'user-id', email: 'test@example.com', authType: 'email', socialId: undefined, password: 'hashed' });
      await controller.unlinkSocialAccount(req, res, next);
      await Promise.resolve();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
    it('should throw error if no social account linked', async () => {
      mockUserRepository.findOne.mockReset();
      mockUserRepository.findOne.mockResolvedValueOnce({ id: 'user-id', email: 'test@example.com', socialId: undefined, password: 'hashed', authType: 'email' });
      mockUserRepository.save.mockResolvedValue({}); // ensure save is a mock function
      await controller.unlinkSocialAccount(req, res, next);
      await Promise.resolve();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'No social account is currently linked' }));
    });
    it('should throw error if no password set', async () => {
      mockUserRepository.findOne.mockReset();
      mockUserRepository.findOne.mockResolvedValueOnce({ id: 'user-id', email: 'test@example.com', socialId: '123', password: undefined, authType: 'google' });
      mockUserRepository.save.mockResolvedValue({}); // ensure save is a mock function
      await controller.unlinkSocialAccount(req, res, next);
      await Promise.resolve();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Cannot unlink social account without setting a password first' }));
    });
  });
});
