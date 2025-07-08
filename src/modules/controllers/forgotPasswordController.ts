import { Request, Response } from 'express';
import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/db';
import { User } from '../../models/User';
import { OtpService } from '../../services/otpService';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { ForgotPasswordInput } from '../../validations/authValidations';
import { asyncHandler } from '../../middlewares/errorHandler';
import logger from '../../utils/logger';

export class ForgotPasswordController {
  private userRepository: Repository<User>;
  private otpService: OtpService;

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
    this.otpService = new OtpService();
  }

  forgotPassword = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { identifier, method }: ForgotPasswordInput = req.body;

      // Sanitize input
      const sanitizedIdentifier = identifier.toLowerCase().trim();
      const sanitizedMethod = method.toLowerCase();

      if (!sanitizedIdentifier) {
        throw new ApiError(400, 'Email or phone number is required');
      }

      if (!['email', 'sms'].includes(sanitizedMethod)) {
        throw new ApiError(400, 'Method must be either email or sms');
      }

      // Find user by email or phone with proper phone number handling
      let user = await this.userRepository.findOne({
        where: { email: sanitizedIdentifier }
      });

      // If not found by email and identifier looks like a phone number, try phone matching
      if (!user && (sanitizedIdentifier.startsWith('+') || /^\d+$/.test(sanitizedIdentifier))) {
        // Try different phone number formats
        
        // First try direct match
        user = await this.userRepository.findOne({
          where: { phone: sanitizedIdentifier }
        });

        // If not found and starts with +, try country code + phone split
        if (!user && sanitizedIdentifier.startsWith('+')) {
          const match = sanitizedIdentifier.match(/^(\+\d{1,4})(.+)$/);
          if (match) {
            const countryCode = match[1];
            const phoneNumber = match[2];
            
            user = await this.userRepository.findOne({
              where: { 
                phone: phoneNumber, 
                countryCode: countryCode 
              }
            });
          }
        }

        // If still not found, try without + prefix
        if (!user && sanitizedIdentifier.startsWith('+')) {
          const phoneWithoutPlus = sanitizedIdentifier.substring(1);
          user = await this.userRepository.findOne({
            where: { phone: phoneWithoutPlus }
          });
        }
      }

      // Don't reveal if user exists or not for security reasons
      if (!user) {
        logger.warn('Password reset attempt for non-existent user', {
          identifier: sanitizedIdentifier,
          method: sanitizedMethod,
          ip: req.ip
        });
        
        // Return success message even if user doesn't exist
        return res.status(200).json(
          ApiResponse.success(
            {},
            'If an account with this identifier exists, you will receive a password reset code.',
            200
          )
        );
      }

      // Check if user is locked
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        throw new ApiError(423, 'Account is temporarily locked. Please try again later.');
      }

      // Validate method against user's verified contact info
      if (sanitizedMethod === 'email' && !user.isEmailVerified) {
        throw new ApiError(400, 'Email is not verified. Please verify your email first.');
      }

      if (sanitizedMethod === 'sms' && !user.isPhoneVerified) {
        throw new ApiError(400, 'Phone number is not verified. Please verify your phone first.');
      }

      // Check for rate limiting - max 3 password reset requests per hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentRequests = await this.otpService.countRecentOtps(
        user.id,
        sanitizedMethod === 'email' ? 'email' : 'sms',
        'password_reset',
        oneHourAgo
      );

      if (recentRequests >= 3) {
        throw new ApiError(429, 'Too many password reset requests. Please try again later.');
      }

      // Generate and send password reset OTP
      try {
        await this.otpService.generateAndSendOtp(
          user,
          sanitizedMethod === 'email' ? 'email' : 'sms',
          'password_reset'
        );

        logger.info('Password reset OTP sent', {
          userId: user.id,
          method: sanitizedMethod,
          identifier: sanitizedIdentifier
        });

        res.status(200).json(
          ApiResponse.success(
            {
              message: `Password reset code sent via ${sanitizedMethod}`,
              method: sanitizedMethod
            },
            `Password reset code has been sent to your ${sanitizedMethod === 'email' ? 'email' : 'phone number'}.`,
            200
          )
        );
      } catch (otpError) {
        logger.error('Failed to send password reset OTP', {
          userId: user.id,
          method: sanitizedMethod,
          error: otpError
        });

        throw new ApiError(500, `Failed to send password reset code via ${sanitizedMethod}. Please try again.`);
      }
    } catch (error: any) {
      logger.error('Forgot password request failed:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }

      // Handle database errors
      if (error.name === 'QueryFailedError') {
        throw new ApiError(500, 'Database error occurred. Please try again.');
      }

      throw new ApiError(500, 'Password reset request failed. Please try again later.');
    }
  });
}
