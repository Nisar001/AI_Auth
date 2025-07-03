// loginController.test.ts

jest.mock('../../../src/config/db', () => ({
  AppDataSource: {
    getRepository: jest.fn()
  }
}));

jest.mock('../../../src/utils/passwordUtils');
jest.mock('../../../src/utils/phoneUtils');
jest.mock('../../../src/utils/jwtUtils');
jest.mock('../../../src/utils/logger');

jest.mock('../../../src/middlewares/errorHandler', () => ({
  asyncHandler: (fn: Function) => async (req: any, res: any, next: any) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error);
    }
  }
}));

jest.mock('../../../src/utils/ApiResponse', () => ({
  ApiResponse: {
    success: jest.fn((data, message, statusCode) => ({
      success: true,
      message: message || 'Success',
      data,
      statusCode: statusCode || 200
    }))
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

import { Request, Response, NextFunction } from 'express';
import { LoginController } from '../../../src/modules/controllers/loginController';
import { User } from '../../../src/models/User';
import { PasswordUtils } from '../../../src/utils/passwordUtils';
import { PhoneUtils } from '../../../src/utils/phoneUtils';
import { JwtUtils } from '../../../src/utils/jwtUtils';
import { ApiError } from '../../../src/utils/ApiError';
import { createMockUser } from '../../utils/mockUser';

const mockUserRepository = {
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn()
};

const mockRequest = {
  body: {},
  ip: '127.0.0.1',
  get: jest.fn().mockReturnValue('test-user-agent')
} as unknown as Request;

const mockResponse = {
  status: jest.fn().mockReturnThis(),
  json: jest.fn()
} as unknown as Response;

const mockNext = jest.fn() as NextFunction;

describe('LoginController', () => {
  let loginController: LoginController;
  let mockUser: User;

  beforeEach(() => {
    jest.clearAllMocks();
    (require('../../../src/config/db').AppDataSource.getRepository as jest.Mock).mockReturnValue(mockUserRepository);
    loginController = new LoginController();
    mockUser = createMockUser();
    mockUser.password = 'hashedPass';
    mockUser.isEmailVerified = true;
    mockUser.isPhoneVerified = true;
    mockUser.loginAttempts = 0;
    mockUser.is2FAEnabled = false;
  });

  it('logs in with valid email and password', async () => {
    mockRequest.body = { identifier: 'test@example.com', password: 'secret' };
    mockUserRepository.findOne.mockResolvedValue(mockUser);
    (PasswordUtils.comparePassword as jest.Mock).mockResolvedValue(true);
    (JwtUtils.generateAccessToken as jest.Mock).mockReturnValue('access-token');
    (JwtUtils.generateRefreshToken as jest.Mock).mockReturnValue('refresh-token');

    await loginController.login(mockRequest, mockResponse, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalled();
  });

  it('logs in with valid phone number', async () => {
    mockRequest.body = { identifier: '+1234567890', password: 'secret' };
    mockUserRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(mockUser);
    (PhoneUtils.generateSearchFormats as jest.Mock).mockReturnValue(['+1234567890']);
    (PasswordUtils.comparePassword as jest.Mock).mockResolvedValue(true);
    (JwtUtils.generateAccessToken as jest.Mock).mockReturnValue('access-token');
    (JwtUtils.generateRefreshToken as jest.Mock).mockReturnValue('refresh-token');

    await loginController.login(mockRequest, mockResponse, mockNext);
    expect(mockResponse.status).toHaveBeenCalledWith(200);
  });

  it('fails with incorrect password', async () => {
    mockRequest.body = { identifier: 'test@example.com', password: 'wrong' };
    mockUserRepository.findOne.mockResolvedValue(mockUser);
    (PasswordUtils.comparePassword as jest.Mock).mockResolvedValue(false);

    await loginController.login(mockRequest, mockResponse, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
  });

  it('locks account after 5 failed attempts', async () => {
    mockRequest.body = { identifier: 'test@example.com', password: 'wrong' };
    mockUser.loginAttempts = 4;
    mockUserRepository.findOne.mockResolvedValue(mockUser);
    (PasswordUtils.comparePassword as jest.Mock).mockResolvedValue(false);

    await loginController.login(mockRequest, mockResponse, mockNext);
    expect(mockUserRepository.save).toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
  });

  it('requires 2FA when enabled', async () => {
    mockUser.is2FAEnabled = true;
    mockUser.preferred2FAMethods = 'email,sms';
    mockRequest.body = { identifier: 'test@example.com', password: 'secret' };
    mockUserRepository.findOne.mockResolvedValue(mockUser);
    (PasswordUtils.comparePassword as jest.Mock).mockResolvedValue(true);
    (JwtUtils.generateTempToken as jest.Mock).mockReturnValue('temp-token');

    await loginController.login(mockRequest, mockResponse, mockNext);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        requires2FA: true,
        tempToken: 'temp-token',
        availableMethods: ['email', 'sms']
      })
    }));
  });

  it('rejects login if email not verified', async () => {
    mockUser.isEmailVerified = false;
    mockRequest.body = { identifier: 'test@example.com', password: 'secret' };
    mockUserRepository.findOne.mockResolvedValue(mockUser);
    (PasswordUtils.comparePassword as jest.Mock).mockResolvedValue(true);

    await loginController.login(mockRequest, mockResponse, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
  });

  it('rejects login if phone not verified', async () => {
    mockUser.isPhoneVerified = false;
    mockRequest.body = { identifier: 'test@example.com', password: 'secret' };
    mockUserRepository.findOne.mockResolvedValue(mockUser);
    (PasswordUtils.comparePassword as jest.Mock).mockResolvedValue(true);

    await loginController.login(mockRequest, mockResponse, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
  });

  it('resets login attempts after successful login', async () => {
    mockUser.loginAttempts = 3;
    mockRequest.body = { identifier: 'test@example.com', password: 'secret' };
    mockUserRepository.findOne.mockResolvedValue(mockUser);
    (PasswordUtils.comparePassword as jest.Mock).mockResolvedValue(true);
    (JwtUtils.generateAccessToken as jest.Mock).mockReturnValue('access-token');
    (JwtUtils.generateRefreshToken as jest.Mock).mockReturnValue('refresh-token');

    await loginController.login(mockRequest, mockResponse, mockNext);
    expect(mockUserRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      loginAttempts: 0,
      lockedUntil: undefined
    }));
  });
});
