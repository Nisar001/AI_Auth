import { Request, Response } from 'express';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { AppDataSource } from '../../config/db';
import { User } from '../../models/User';
import { OtpService as OtpServiceModel } from '../../models/OtpService';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { EmailVerificationInput } from '../../validations/authValidations';
import { asyncHandler } from '../../middlewares/errorHandler';
import logger from '../../utils/logger';

export class EmailVerificationController {
  private userRepository: Repository<User>;
  private otpRepository: Repository<OtpServiceModel>;

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
    this.otpRepository = AppDataSource.getRepository(OtpServiceModel);
  }

  verifyEmail = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { email, otp }: EmailVerificationInput = req.body;

      // Sanitize input
      const sanitizedEmail = email.toLowerCase().trim();
      const sanitizedOtp = otp.trim();

      if (!sanitizedEmail || !sanitizedOtp) {
        throw new ApiError(400, 'Email and OTP are required');
      }

      // Find user by email
      const user = await this.userRepository.findOne({
        where: { email: sanitizedEmail }
      });

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      if (user.isEmailVerified) {
        throw new ApiError(400, 'Email is already verified');
      }

      // Find valid OTP (check all unexpired OTPs for this user)
      logger.info('Searching for OTP', {
        userId: user.id,
        email: sanitizedEmail,
        otpProvided: sanitizedOtp,
        lookingFor: {
          userId: user.id,
          type: 'email',
          used: false
        }
      });

      const otpRecord = await this.otpRepository.findOne({
        where: {
          user: { id: user.id },
          type: 'email',
          otp: sanitizedOtp,
          used: false,
          purpose: 'email verification'
        },
        order: { createdAt: 'DESC' }
      });

      // Debug: List all OTPs for this user to help troubleshoot
      const allUserOtps = await this.otpRepository.find({
        where: {
          user: { id: user.id },
          type: 'email',
          purpose: 'email verification'
        },
        order: { createdAt: 'DESC' },
        take: 5
      });

      logger.info('All recent OTPs for user', {
        userId: user.id,
        otps: allUserOtps.map(otp => ({
          id: otp.id,
          otp: otp.otp,
          used: otp.used,
          expiresAt: otp.expiresAt,
          createdAt: otp.createdAt,
          isExpired: otp.expiresAt < new Date()
        }))
      });

      if (!otpRecord) {
        logger.warn('Invalid OTP attempt for email verification', {
          userId: user.id,
          email: sanitizedEmail,
          otp: sanitizedOtp,
          ip: req.ip
        });
        throw new ApiError(400, 'Invalid or expired OTP');
      }

      // Check if OTP is expired
      const now = new Date();
      if (otpRecord.expiresAt < now) {
        // Mark expired OTP as used
        otpRecord.used = true;
        await this.otpRepository.save(otpRecord);
        
        throw new ApiError(400, 'OTP has expired. Please request a new one.');
      }

      // Check for rate limiting (max 5 attempts per hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentAttempts = await this.otpRepository.count({
        where: {
          user: { id: user.id },
          type: 'email',
          purpose: 'email verification',
          createdAt: MoreThanOrEqual(oneHourAgo)
        }
      });

      if (recentAttempts > 5) {
        throw new ApiError(429, 'Too many verification attempts. Please try again later.');
      }

      // Mark OTP as used
      otpRecord.used = true;
      await this.otpRepository.save(otpRecord);

      // Update user email verification status
      user.isEmailVerified = true;
      await this.userRepository.save(user);

      // Mark all other email verification OTPs for this user as used
      await this.otpRepository.update(
        {
          user: { id: user.id },
          type: 'email',
          purpose: 'email verification',
          used: false
        },
        {
          used: true
        }
      );

      logger.info('Email verified successfully', {
        userId: user.id,
        email: sanitizedEmail
      });

      res.status(200).json(
        ApiResponse.success(
          {
            user: {
              id: user.id,
              email: user.email,
              isEmailVerified: user.isEmailVerified,
              isPhoneVerified: user.isPhoneVerified
            }
          },
          'Email verified successfully',
          200
        )
      );
    } catch (error: any) {
      logger.error('Email verification failed:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }

      // Handle database errors
      if (error.name === 'QueryFailedError') {
        throw new ApiError(500, 'Database error occurred. Please try again.');
      }

      throw new ApiError(500, 'Email verification failed. Please try again later.');
    }
  });
}
