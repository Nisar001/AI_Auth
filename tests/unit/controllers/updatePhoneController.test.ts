// @ts-nocheck

const assert = require('assert');
const { UpdatePhoneController } = require('../../../src/modules/controllers/updatePhoneController');
const { AppDataSource } = require('../../../src/config/db');
const { mockRequest, mockResponse } = require('../../utils/mockExpress');

class MockUserRepository {
  constructor() {
    this.findOne = jest.fn();
    this.save = jest.fn();
    this.update = jest.fn();
  }
}
class MockOtpRepository {
  constructor() {
    this.findOne = jest.fn();
    this.save = jest.fn();
    this.update = jest.fn();
  }
}

jest.mock('../../../src/config/db', () => {
  const actual = jest.requireActual('../../../src/config/db');
  return {
    ...actual,
    AppDataSource: {
      ...actual.AppDataSource,
      getRepository: jest.fn(),
    },
  };
});

describe('UpdatePhoneController (nodejs assert + jest)', () => {
  let controller;
  let mockUserRepository;
  let mockOtpRepository;
  let mockOtpService;

  beforeEach(() => {
    mockUserRepository = new MockUserRepository();
    mockOtpRepository = new MockOtpRepository();
    mockOtpService = {
      generateAndSendOtp: jest.fn(),
      verifyOtp: jest.fn(),
    };
    jest.clearAllMocks();
    AppDataSource.getRepository.mockImplementation((entity) => {
      if (entity.name === 'User') return mockUserRepository;
      return mockOtpRepository;
    });
    controller = new UpdatePhoneController(
      mockUserRepository,
      mockOtpRepository,
      mockOtpService
    );
  });

  it('should call next with error if required fields missing', async () => {
    const req = mockRequest({ body: {}, user: { id: 'user-1' } });
    const res = mockResponse();
    const mockNext = jest.fn();
    await controller.rawUpdatePhone(req, res, mockNext);
    expect(mockNext).toHaveBeenCalled();
    expect(mockNext.mock.calls[0][0].message).toMatch(/failed/i);
    assert(mockNext.mock.calls.length > 0, 'next should be called with error');
  });

  it('should call next with error if user not found', async () => {
    mockUserRepository.findOne.mockResolvedValue(null);
    const req = mockRequest({ body: { newPhone: '222', countryCode: '+91', currentPassword: 'pw' }, user: { id: 'not-exist' } });
    const res = mockResponse();
    const mockNext = jest.fn();
    await controller.rawUpdatePhone(req, res, mockNext);
    expect(mockNext).toHaveBeenCalled();
    expect(mockNext.mock.calls[0][0].message).toMatch(/failed/i);
    assert(mockNext.mock.calls.length > 0, 'next should be called with error');
  });

  it('should call next with error if password is incorrect', async () => {
    const userId = 'user-1';
    const mockUser = { id: userId, phone: '111', countryCode: '+1', password: 'hashed' };
    mockUserRepository.findOne.mockResolvedValueOnce(mockUser);
    jest.spyOn(require('../../../src/utils/passwordUtils').PasswordUtils, 'comparePassword').mockResolvedValue(false);
    const req = mockRequest({ body: { newPhone: '222', countryCode: '+91', currentPassword: 'bad' }, user: { id: userId } });
    const res = mockResponse();
    const mockNext = jest.fn();
    await controller.rawUpdatePhone(req, res, mockNext);
    expect(mockNext).toHaveBeenCalled();
    expect(mockNext.mock.calls[0][0].message).toMatch(/failed/i);
    assert(mockNext.mock.calls.length > 0, 'next should be called with error');
  });

  it('should call next with error if user not found (confirm)', async () => {
    mockUserRepository.findOne.mockResolvedValue(null);
    const req = mockRequest({ body: { newPhone: '222', otp: '123456' }, user: { id: 'not-exist' } });
    const res = mockResponse();
    const mockNext = jest.fn();
    await controller.rawConfirmUpdatePhone(req, res, mockNext);
    expect(mockNext).toHaveBeenCalled();
    expect(mockNext.mock.calls[0][0].message).toMatch(/failed/i);
    assert(mockNext.mock.calls.length > 0, 'next should be called with error');
  });
});