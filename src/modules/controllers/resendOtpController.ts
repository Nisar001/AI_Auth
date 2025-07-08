import { Request, Response } from 'express';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { AppDataSource } from '../../config/db';
import { User } from '../../models/User';
import { OtpService as OtpServiceModel } from '../../models/OtpService';
import { OtpService } from '../../services/otpService';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { PhoneUtils } from '../../utils/phoneUtils';
import { ResendOtpInput } from '../../validations/authValidations';
import { asyncHandler } from '../../middlewares/errorHandler';
import logger from '../../utils/logger';

export class ResendOtpController {
  private userRepository: Repository<User>;
  private otpRepository: Repository<OtpServiceModel>;
  private otpService: OtpService;

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
    this.otpRepository = AppDataSource.getRepository(OtpServiceModel);
    this.otpService = new OtpService();
  }

  resendOtp = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { identifier, type }: ResendOtpInput = req.body;

      // Sanitize input
      const sanitizedIdentifier = identifier.toLowerCase().trim();
      const sanitizedType = type.toLowerCase();

      if (!sanitizedIdentifier) {
        throw new ApiError(400, 'Email or phone number is required');
      }

      if (!['email', 'sms'].includes(sanitizedType)) {
        throw new ApiError(400, 'Type must be either email or sms');
      }

      // Find user by email or phone with proper phone number handling
      let user = await this.userRepository.findOne({
        where: { email: sanitizedIdentifier }
      });

      // If not found by email and identifier looks like a phone number, try phone matching
      if (!user && (sanitizedIdentifier.startsWith('+') || /^\d+$/.test(sanitizedIdentifier))) {
        // Use phone utility for comprehensive phone matching
        const searchFormats = PhoneUtils.generateSearchFormats(sanitizedIdentifier);
        
        // Try direct phone match first
        for (const format of searchFormats) {
          user = await this.userRepository.findOne({
            where: { phone: format }
          });
          if (user) break;
        }
        
        // If not found, try country code + phone combination
        if (!user) {
          const parsed = PhoneUtils.parsePhoneNumber(sanitizedIdentifier);
          if (parsed.countryCode && parsed.phoneNumber) {
            user = await this.userRepository.findOne({
              where: { 
                phone: parsed.phoneNumber, 
                countryCode: parsed.countryCode 
              }
            });
          }
        }
        
        // If still not found, try finding any user and check if phone matches
        if (!user) {
          const allUsers = await this.userRepository.find();
          user = allUsers.find(u => 
            PhoneUtils.isPhoneMatch(sanitizedIdentifier, u.phone, u.countryCode)
          ) || null;
        }
      }

      if (!user) {
        // Don't reveal if user exists or not for security reasons
        logger.warn('OTP resend attempt for non-existent user', {
          identifier: sanitizedIdentifier,
          type: sanitizedType,
          ip: req.ip
        });
        
        return res.status(200).json(
          ApiResponse.success(
            {},
            'If an account with this identifier exists, a new OTP has been sent.',
            200
          )
        );
      }

      // Check if account is locked
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        throw new ApiError(423, 'Account is temporarily locked. Please try again later.');
      }

      // Validate contact info based on type
      if (sanitizedType === 'email') {
        if (user.email !== sanitizedIdentifier) {
          throw new ApiError(400, 'Email address does not match our records');
        }
      } else {
        // For SMS, use phone utility to check if identifier matches user's phone
        if (!PhoneUtils.isPhoneMatch(sanitizedIdentifier, user.phone, user.countryCode)) {
          logger.warn('Phone number mismatch in resend OTP', {
            userId: user.id,
            userPhone: user.phone,
            userCountryCode: user.countryCode,
            providedIdentifier: sanitizedIdentifier
          });
          throw new ApiError(400, 'Phone number does not match our records');
        }
      }

      // Check for rate limiting - 5 minute cooldown between requests, max 3 requests per hour
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      // Check if user has requested OTP within last 5 minutes
      const recentRequest = await this.otpRepository.findOne({
        where: {
          user: { id: user.id },
          type: sanitizedType === 'email' ? 'email' : 'sms',
          createdAt: MoreThanOrEqual(fiveMinutesAgo)
        },
        order: { createdAt: 'DESC' }
      });

      if (recentRequest) {
        const timeLeft = Math.ceil((recentRequest.createdAt.getTime() + 5 * 60 * 1000 - Date.now()) / 1000 / 60);
        throw new ApiError(429, `Please wait ${timeLeft} minutes before requesting another OTP`);
      }

      // Check hourly limit (max 3 requests per hour)
      const recentRequests = await this.otpRepository.count({
        where: {
          user: { id: user.id },
          type: sanitizedType === 'email' ? 'email' : 'sms',
          createdAt: MoreThanOrEqual(oneHourAgo)
        }
      });

      if (recentRequests >= 3) {
        throw new ApiError(429, 'Maximum OTP requests exceeded. Please try again after an hour.');
      }

      // Determine purpose based on verification status
      let purpose: string;
      if (sanitizedType === 'email' && !user.isEmailVerified) {
        purpose = 'email verification';
      } else if (sanitizedType === 'sms' && !user.isPhoneVerified) {
        purpose = 'phone verification';
      } else {
        purpose = 'verification';
      }

      // Generate and send new OTP
      try {
        await this.otpService.generateAndSendOtp(
          user,
          sanitizedType as 'email' | 'sms',
          purpose
        );

        logger.info('OTP resent successfully', {
          userId: user.id,
          type: sanitizedType,
          purpose,
          identifier: sanitizedIdentifier
        });

        res.status(200).json(
          ApiResponse.success(
            {
              type: sanitizedType,
              purpose,
              expiresIn: '2 minutes'
            },
            `A new verification code has been sent to your ${sanitizedType === 'email' ? 'email' : 'phone number'}.`,
            200
          )
        );
      } catch (otpError) {
        logger.error('Failed to resend OTP', {
          userId: user.id,
          type: sanitizedType,
          error: otpError
        });

        throw new ApiError(500, `Failed to send verification code via ${sanitizedType}. Please try again.`);
      }
    } catch (error: any) {
      logger.error('Resend OTP request failed:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }

      // Handle database errors
      if (error.name === 'QueryFailedError') {
        throw new ApiError(500, 'Database error occurred. Please try again.');
      }

      throw new ApiError(500, 'Failed to resend verification code. Please try again later.');
    }
  });
}
