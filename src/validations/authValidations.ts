import { z } from 'zod';

// Phone validation regex for international format
const phoneRegex = /^\+[1-9]\d{1,14}$/;

// Email validation with stricter rules
const emailSchema = z.string()
  .trim()
  .min(1, 'Email is required')
  .email('Invalid email format')
  .min(5, 'Email must be at least 5 characters')
  .max(100, 'Email must not exceed 100 characters')
  .toLowerCase()
  .refine((email) => !email.includes('..'), 'Email cannot contain consecutive dots')
  .refine((email) => !email.startsWith('.') && !email.endsWith('.'), 'Email cannot start or end with a dot');

// Password validation with enhanced security
const passwordSchema = z.string()
  .min(1, 'Password is required')
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/\d/, 'Password must contain at least one number')
  .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character')
  .refine((password) => !/\s/.test(password), 'Password cannot contain spaces')
  .refine((password) => {
    // Check for common weak passwords
    const commonPasswords = ['password', '123456', 'qwerty', 'admin', 'letmein'];
    return !commonPasswords.some(common => 
      password.toLowerCase().includes(common)
    );
  }, 'Password is too common, please choose a stronger password');

// Phone validation with enhanced checks
const phoneSchema = z.string()
  .trim()
  .min(1, 'Phone number is required')
  .regex(phoneRegex, 'Invalid phone format. Use international format: +1234567890')
  .refine((phone) => {
    // Remove + and check if remaining are all digits
    const digits = phone.slice(1);
    return /^\d+$/.test(digits);
  }, 'Phone number must contain only digits after country code');

// Name validation with enhanced rules
const nameSchema = z.string()
  .trim()
  .min(1, 'Name is required')
  .min(2, 'Name must be at least 2 characters')
  .max(50, 'Name must not exceed 50 characters')
  .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')
  .refine((name) => name.trim().length > 0, 'Name cannot be empty or only spaces')
  .refine((name) => {
    // Check for excessive consecutive spaces, hyphens, or apostrophes
    return !/(\s{2,}|'{2,}|-{2,})/.test(name);
  }, 'Name cannot contain consecutive spaces, hyphens, or apostrophes');

// Date validation for DOB with enhanced checks
const dobSchema = z.string()
  .min(1, 'Date of birth is required')
  .refine((date) => {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }, 'Invalid date format')
  .refine((date) => {
    const parsed = new Date(date);
    const now = new Date();
    const age = now.getFullYear() - parsed.getFullYear();
    const monthDiff = now.getMonth() - parsed.getMonth();
    const dayDiff = now.getDate() - parsed.getDate();
    
    // Adjust age if birthday hasn't occurred this year
    const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
    
    return actualAge >= 13 && actualAge <= 120;
  }, 'You must be between 13 and 120 years old')
  .refine((date) => {
    const parsed = new Date(date);
    const now = new Date();
    return parsed <= now;
  }, 'Date of birth cannot be in the future');

// Country code validation with enhanced checks
const countryCodeSchema = z.string()
  .trim()
  .min(1, 'Country code is required')
  .regex(/^\+[1-9]\d{0,3}$/, 'Invalid country code format. Must start with + followed by 1-4 digits');

// Address validation with enhanced rules
const addressSchema = z.object({
  houseNumber: z.string()
    .trim()
    .min(1, 'House number is required')
    .max(20, 'House number too long')
    .regex(/^[a-zA-Z0-9\s\-\/]+$/, 'House number can only contain letters, numbers, spaces, hyphens, and slashes'),
  
  street: z.string()
    .trim()
    .min(1, 'Street is required')
    .min(2, 'Street must be at least 2 characters')
    .max(100, 'Street name too long')
    .regex(/^[a-zA-Z0-9\s\-\.,']+$/, 'Street name contains invalid characters'),
  
  city: z.string()
    .trim()
    .min(1, 'City is required')
    .min(2, 'City must be at least 2 characters')
    .max(50, 'City name too long')
    .regex(/^[a-zA-Z\s\-'\.]+$/, 'City name can only contain letters, spaces, hyphens, apostrophes, and dots'),
  
  state: z.string()
    .trim()
    .min(1, 'State is required')
    .min(2, 'State must be at least 2 characters')
    .max(50, 'State name too long')
    .regex(/^[a-zA-Z\s\-'\.]+$/, 'State name can only contain letters, spaces, hyphens, apostrophes, and dots'),
  
  country: z.string()
    .trim()
    .min(1, 'Country is required')
    .min(2, 'Country must be at least 2 characters')
    .max(50, 'Country name too long')
    .regex(/^[a-zA-Z\s\-'\.]+$/, 'Country name can only contain letters, spaces, hyphens, apostrophes, and dots'),
  
  pincode: z.string()
    .trim()
    .min(1, 'Pincode is required')
    .min(4, 'Pincode must be at least 4 characters')
    .max(10, 'Pincode too long')
    .regex(/^[a-zA-Z0-9\s\-]+$/, 'Pincode can only contain letters, numbers, spaces, and hyphens')
});

// Register validation schema with enhanced validation
export const registerSchema = z.object({
  fname: nameSchema,
  mname: nameSchema.optional().or(z.literal('')), // Allow empty string for optional middle name
  lname: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  countryCode: countryCodeSchema,
  phone: phoneSchema,
  dob: dobSchema,
  address: addressSchema
}).superRefine((data, ctx) => {
  // Cross-field validation
  
  // Ensure phone number and country code are compatible
  const phoneWithoutCode = data.phone.startsWith(data.countryCode) 
    ? data.phone.slice(data.countryCode.length)
    : data.phone;
  
  if (phoneWithoutCode.length < 7 || phoneWithoutCode.length > 15) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid phone number length for the given country code',
      path: ['phone']
    });
  }

  // Validate that first name and last name are different
  if (data.fname.toLowerCase().trim() === data.lname.toLowerCase().trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'First name and last name should be different',
      path: ['lname']
    });
  }

  // Email domain validation (basic check for common domains)
  const emailDomain = data.email.split('@')[1];
  if (emailDomain && emailDomain.split('.').length < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid email domain format',
      path: ['email']
    });
  }
});

// Login validation schema with enhanced checks
export const loginSchema = z.object({
  identifier: z.string()
    .trim()
    .min(1, 'Email or phone is required')
    .refine((identifier) => {
      // Check if it's a valid email or phone format
      const isEmail = z.string().email().safeParse(identifier).success;
      const isPhone = phoneRegex.test(identifier);
      return isEmail || isPhone;
    }, 'Please enter a valid email address or phone number'),
  
  password: z.string()
    .min(1, 'Password is required')
    .max(128, 'Password too long')
});

// OTP validation schema with enhanced checks
export const otpSchema = z.object({
  otp: z.string()
    .trim()
    .min(1, 'OTP is required')
    .length(6, 'OTP must be exactly 6 digits')
    .regex(/^\d{6}$/, 'OTP must contain only numbers')
    .refine((otp) => {
      // Check for sequential numbers (123456, 654321)
      const isSequential = /^(012345|123456|234567|345678|456789|567890|987654|876543|765432|654321|543210|432109)$/.test(otp);
      return !isSequential;
    }, 'OTP cannot be sequential numbers')
    .refine((otp) => {
      // Check for repeated numbers (111111, 222222, etc.)
      const isRepeated = /^(\d)\1{5}$/.test(otp);
      return !isRepeated;
    }, 'OTP cannot be repeated numbers')
});

// Email verification schema
export const emailVerificationSchema = z.object({
  email: emailSchema,
  otp: z.string().length(6, 'OTP must be exactly 6 digits')
});

// Phone verification schema
export const phoneVerificationSchema = z.object({
  phone: phoneSchema,
  otp: z.string().length(6, 'OTP must be exactly 6 digits')
});

// Forgot password schema
export const forgotPasswordSchema = z.object({
  identifier: z.string().min(1, 'Email or phone is required'),
  method: z.enum(['email', 'sms'], {
    errorMap: () => ({ message: 'Method must be either email or sms' })
  })
});

// Reset password schema
export const resetPasswordSchema = z.object({
  identifier: z.string().min(1, 'Email or phone is required'),
  otp: z.string().length(6, 'OTP must be exactly 6 digits'),
  newPassword: passwordSchema
});

// Update email schema
export const updateEmailSchema = z.object({
  newEmail: emailSchema,
  currentPassword: z.string().min(1, 'Current password is required')
});

// Confirm update email schema
export const confirmUpdateEmailSchema = z.object({
  newEmail: emailSchema,
  otp: z.string().length(6, 'OTP must be exactly 6 digits')
});

// Update phone schema
export const updatePhoneSchema = z.object({
  newPhone: phoneSchema,
  countryCode: countryCodeSchema,
  currentPassword: z.string().min(1, 'Current password is required')
});

// Confirm update phone schema
export const confirmUpdatePhoneSchema = z.object({
  newPhone: phoneSchema,
  otp: z.string().length(6, 'OTP must be exactly 6 digits')
});

// Profile update schema
export const updateProfileSchema = z.object({
  fname: nameSchema.optional(),
  mname: nameSchema.optional(),
  lname: nameSchema.optional(),
  dob: dobSchema.optional(),
  address: addressSchema.partial().optional()
});

// Resend OTP schema
export const resendOtpSchema = z.object({
  identifier: z.string().min(1, 'Email or phone is required'),
  type: z.enum(['email', 'sms'], {
    errorMap: () => ({ message: 'Type must be either email or sms' })
  })
});

// 2FA setup schema
export const setup2FASchema = z.object({
  method: z.enum(['email', 'sms', 'auth_app'], {
    errorMap: () => ({ message: 'Method must be email, sms, or auth_app' })
  }),
  password: z.string().min(1, 'Password is required for 2FA setup')
});

// Verify 2FA schema
export const verify2FASchema = z.object({
  code: z.string().min(6, 'Code must be at least 6 characters'),
  method: z.enum(['email', 'sms', 'auth_app'])
});

// Social login schema
export const socialLoginSchema = z.object({
  provider: z.enum(['google', 'github', 'facebook', 'apple'], {
    errorMap: () => ({ message: 'Provider must be google, github, facebook, or apple' })
  }),
  accessToken: z.string().min(1, 'Access token is required'),
  email: emailSchema,
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  socialId: z.string().min(1, 'Social ID is required'),
  avatar: z.string().url('Invalid avatar URL').optional()
});

// Social auth callback schema
export const socialAuthCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().optional()
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type OtpInput = z.infer<typeof otpSchema>;
export type EmailVerificationInput = z.infer<typeof emailVerificationSchema>;
export type PhoneVerificationInput = z.infer<typeof phoneVerificationSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateEmailInput = z.infer<typeof updateEmailSchema>;
export type ConfirmUpdateEmailInput = z.infer<typeof confirmUpdateEmailSchema>;
export type UpdatePhoneInput = z.infer<typeof updatePhoneSchema>;
export type ConfirmUpdatePhoneInput = z.infer<typeof confirmUpdatePhoneSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ResendOtpInput = z.infer<typeof resendOtpSchema>;
export type Setup2FAInput = z.infer<typeof setup2FASchema>;
export type Verify2FAInput = z.infer<typeof verify2FASchema>;
export type SocialLoginInput = z.infer<typeof socialLoginSchema>;
export type SocialAuthCallbackInput = z.infer<typeof socialAuthCallbackSchema>;
