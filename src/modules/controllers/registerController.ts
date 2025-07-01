import { Request, Response } from 'express';
import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/db';
import { User } from '../../models/User';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { PasswordUtils } from '../../utils/passwordUtils';
import { JwtUtils, JwtPayload } from '../../utils/jwtUtils';
import { OtpService } from '../../services/otpService';
import { EmailService } from '../../services/emailService';
import { SmsService } from '../../services/smsService';
import { RegisterInput } from '../../validations/authValidations';
import { asyncHandler } from '../../middlewares/errorHandler';
import logger from '../../utils/logger';

export class RegisterController {
  private userRepository: Repository<User>;
  private otpService: OtpService;
  private emailService: EmailService;
  private smsService: SmsService;

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
    this.otpService = new OtpService();
    this.emailService = new EmailService();
    this.smsService = new SmsService();
  }

  register = asyncHandler(async (req: Request, res: Response) => {
    try {
      const {
        fname,
        mname,
        lname,
        email,
        password,
        countryCode,
        phone,
        dob,
        address
      }: RegisterInput = req.body;

      // Additional server-side validation and sanitization
      const sanitizedData = {
        fname: fname.trim(),
        mname: mname ? mname.trim() : undefined,
        lname: lname.trim(),
        email: email.toLowerCase().trim(),
        password: password,
        countryCode: countryCode.trim(),
        phone: phone.trim(),
        dob: dob.trim(),
        address: {
          houseNumber: address.houseNumber.trim(),
          street: address.street.trim(),
          city: address.city.trim(),
          state: address.state.trim(),
          country: address.country.trim(),
          pincode: address.pincode.trim()
        }
      };

      // Check for empty fields after trimming
      if (!sanitizedData.fname || !sanitizedData.lname || !sanitizedData.email || 
          !sanitizedData.password || !sanitizedData.countryCode || !sanitizedData.phone ||
          !sanitizedData.dob || !sanitizedData.address.houseNumber || 
          !sanitizedData.address.street || !sanitizedData.address.city ||
          !sanitizedData.address.state || !sanitizedData.address.country ||
          !sanitizedData.address.pincode) {
        throw new ApiError(400, 'All required fields must be filled');
      }

      // Additional email validation
      const emailParts = sanitizedData.email.split('@');
      if (emailParts.length !== 2 || !emailParts[0] || !emailParts[1]) {
        throw new ApiError(400, 'Invalid email format');
      }

      // Validate date of birth format and logic
      const dobDate = new Date(sanitizedData.dob);
      if (isNaN(dobDate.getTime())) {
        throw new ApiError(400, 'Invalid date of birth format');
      }

      const today = new Date();
      const age = today.getFullYear() - dobDate.getFullYear();
      const monthDiff = today.getMonth() - dobDate.getMonth();
      const dayDiff = today.getDate() - dobDate.getDate();
      const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;

      if (actualAge < 13) {
        throw new ApiError(400, 'You must be at least 13 years old to register');
      }
      if (actualAge > 120) {
        throw new ApiError(400, 'Please enter a valid date of birth');
      }

      // Validate and format phone number
      let formattedPhone = sanitizedData.phone;
      
      // Remove any existing country code if phone starts with it
      if (formattedPhone.startsWith(sanitizedData.countryCode)) {
        formattedPhone = formattedPhone.substring(sanitizedData.countryCode.length);
      }
      
      // Remove leading + if present
      if (formattedPhone.startsWith('+')) {
        formattedPhone = formattedPhone.substring(1);
      }
      
      // Store phone without country code, country code separately
      sanitizedData.phone = formattedPhone;

      // Check if user already exists with email or phone combination
      const existingUser = await this.userRepository.findOne({
        where: [
          { email: sanitizedData.email },
          { 
            phone: sanitizedData.phone,
            countryCode: sanitizedData.countryCode
          }
        ]
      });

      if (existingUser) {
        if (existingUser.email === sanitizedData.email) {
          throw new ApiError(409, 'An account with this email address already exists');
        }
        if (existingUser.phone === sanitizedData.phone && existingUser.countryCode === sanitizedData.countryCode) {
          throw new ApiError(409, 'An account with this phone number already exists');
        }
      }

      // Validate password strength
      const passwordValidation = PasswordUtils.validatePasswordStrength(sanitizedData.password);
      if (!passwordValidation.isValid) {
        throw new ApiError(400, 'Password does not meet security requirements', passwordValidation.errors);
      }

      // Check if password contains personal information
      const personalInfo = [
        sanitizedData.fname.toLowerCase(),
        sanitizedData.lname.toLowerCase(),
        sanitizedData.email.split('@')[0].toLowerCase()
      ];
      
      const passwordLower = sanitizedData.password.toLowerCase();
      for (const info of personalInfo) {
        if (info.length > 2 && passwordLower.includes(info)) {
          throw new ApiError(400, 'Password cannot contain personal information like your name or email');
        }
      }

      // Hash password
      const hashedPassword = await PasswordUtils.hashPassword(sanitizedData.password);

      // Create user with sanitized data
      const user = this.userRepository.create({
        fname: sanitizedData.fname,
        mname: sanitizedData.mname,
        lname: sanitizedData.lname,
        email: sanitizedData.email,
        password: hashedPassword,
        countryCode: sanitizedData.countryCode,
        phone: sanitizedData.phone,
        dob: dobDate,
        houseNumber: sanitizedData.address.houseNumber,
        street: sanitizedData.address.street,
        city: sanitizedData.address.city,
        state: sanitizedData.address.state,
        country: sanitizedData.address.country,
        pincode: sanitizedData.address.pincode,
        authType: 'email',
        isEmailVerified: false,
        isPhoneVerified: false,
        is2FAEnabled: false,
        tokenVersion: 1,
        loginAttempts: 0
      });

      // Save user to database
      const savedUser = await this.userRepository.save(user);

      // Generate JWT tokens
      const tokenPayload: JwtPayload = {
        userId: savedUser.id,
        email: savedUser.email,
        phone: savedUser.phone,
        isEmailVerified: savedUser.isEmailVerified,
        isPhoneVerified: savedUser.isPhoneVerified
      };

      const accessToken = JwtUtils.generateAccessToken(tokenPayload);
      const refreshToken = JwtUtils.generateRefreshToken({
        userId: savedUser.id,
        tokenVersion: savedUser.tokenVersion
      });

      // Send verification OTPs
      try {
        await Promise.all([
          this.otpService.generateAndSendOtp(savedUser, 'email', 'email verification'),
          this.otpService.generateAndSendOtp(savedUser, 'sms', 'phone verification')
        ]);
      } catch (error) {
        logger.warn('Failed to send verification OTPs during registration:', error);
        // Don't fail registration if OTP sending fails
      }

      // Send welcome emails/SMS
      try {
        await Promise.all([
          this.emailService.sendWelcomeEmail(savedUser.email, savedUser.fname),
          this.smsService.sendWelcomeSms(savedUser.phone, savedUser.fname)
        ]);
      } catch (error) {
        logger.warn('Failed to send welcome messages:', error);
        // Don't fail registration if welcome messages fail
      }

      // Prepare response data
      const responseData = {
        user: {
          id: savedUser.id,
          fname: savedUser.fname,
          mname: savedUser.mname,
          lname: savedUser.lname,
          email: savedUser.email,
          phone: savedUser.phone,
          countryCode: savedUser.countryCode,
          isEmailVerified: savedUser.isEmailVerified,
          isPhoneVerified: savedUser.isPhoneVerified,
          is2FAEnabled: savedUser.is2FAEnabled,
          authType: savedUser.authType,
          createdAt: savedUser.createdAt
        },
        tokens: {
          accessToken,
          refreshToken
        },
        nextSteps: [
          'Verify your email address using the OTP sent to your email',
          'Verify your phone number using the OTP sent via SMS',
          'Complete your profile setup'
        ]
      };

      logger.info(`User registered successfully: ${savedUser.id} (${savedUser.email})`);

      res.status(201).json(
        ApiResponse.success(
          responseData,
          'Registration successful! Please check your email and phone for verification codes.',
          201
        )
      );
    } catch (error: any) {
      logger.error('Registration failed:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }

      // Handle database constraint errors
      if (error.code === '23505') { // PostgreSQL unique constraint error
        if (error.detail?.includes('email')) {
          throw new ApiError(409, 'An account with this email address already exists');
        }
        if (error.detail?.includes('phone')) {
          throw new ApiError(409, 'An account with this phone number already exists');
        }
        throw new ApiError(409, 'An account with this information already exists');
      }

      // Handle other database errors
      if (error.name === 'QueryFailedError') {
        throw new ApiError(500, 'Database error occurred. Please try again.');
      }

      throw new ApiError(500, 'Registration failed. Please try again later.');
    }
  });
}
