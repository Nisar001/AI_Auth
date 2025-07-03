import { User } from '../../src/models/User';

export const createMockUser = (overrides: Partial<User> = {}): User => {
  const defaultUser: User = {
    id: 'test-user-id',
    fname: 'John',
    mname: 'M',
    lname: 'Doe',
    email: 'john.doe@example.com',
    isEmailVerified: true,
    countryCode: '+1',
    phone: '1234567890',
    isPhoneVerified: true,
    houseNumber: '123',
    street: 'Main St',
    city: 'Test City',
    state: 'Test State',
    country: 'Test Country',
    pincode: '12345',
    password: 'hashedPassword123',
    dob: new Date('1990-01-01'),
    authType: 'email',
    tempEmail: undefined,
    tempPhone: undefined,
    pendingEmail: undefined,
    pendingPhone: undefined,
    is2FAEnabled: false,
    twoFASecret: undefined,
    preferred2FAMethods: 'email,sms',
    socialId: undefined,
    avatar: undefined,
    tokenVersion: 1,
    lastLoginAt: undefined,
    lastPasswordChange: undefined,
    loginAttempts: 0,
    lockedUntil: undefined,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    ...overrides
  };

  return defaultUser;
};
