import { Request, Response } from 'express';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { AppDataSource } from '../../config/db';
import { User } from '../../models/User';
import { OtpService as OtpServiceModel } from '../../models/OtpService';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { PhoneUtils } from '../../utils/phoneUtils';
import { PhoneVerificationInput } from '../../validations/authValidations';
import { asyncHandler } from '../../middlewares/errorHandler';
import logger from '../../utils/logger';

export class PhoneVerificationController {
  private userRepository: Repository<User>;
  private otpRepository: Repository<OtpServiceModel>;

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
    this.otpRepository = AppDataSource.getRepository(OtpServiceModel);
  }

  verifyPhone = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { phone, otp }: PhoneVerificationInput = req.body;

      // Sanitize input and parse phone number
      const sanitizedPhone = phone.trim();
      const sanitizedOtp = otp.trim();

      if (!sanitizedPhone || !sanitizedOtp) {
        throw new ApiError(400, 'Phone number and OTP are required');
      }

      // Find user by phone number using comprehensive matching
      const searchFormats = PhoneUtils.generateSearchFormats(sanitizedPhone);
      let user: User | null = null;
      
      // Try direct phone match first
      for (const format of searchFormats) {
        user = await this.userRepository.findOne({
          where: { phone: format }
        });
        if (user) break;
      }
      
      // If not found, try country code + phone combination
      if (!user) {
        const parsed = PhoneUtils.parsePhoneNumber(sanitizedPhone);
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
          PhoneUtils.isPhoneMatch(sanitizedPhone, u.phone, u.countryCode)
        ) || null;
      }

      if (!user) {
        logger.warn('User not found for phone verification', {
          phoneProvided: sanitizedPhone,
          searchAttempts: [
            `Direct match: ${sanitizedPhone}`,
            sanitizedPhone.startsWith('+') ? `Country code split attempted` : 'No country code split',
            `Without plus: ${sanitizedPhone.replace(/^\+/, '')}`
          ]
        });
        throw new ApiError(404, 'User not found');
      }

      if (user.isPhoneVerified) {
        throw new ApiError(400, 'Phone number is already verified');
      }

      // Find valid OTP (check all unexpired OTPs for this user)
      logger.info('Searching for phone OTP', {
        userId: user.id,
        phone: sanitizedPhone,
        otpProvided: sanitizedOtp,
        lookingFor: {
          userId: user.id,
          type: 'sms',
          used: false
        }
      });

      const otpRecord = await this.otpRepository.findOne({
        where: {
          user: { id: user.id },
          type: 'sms',
          otp: sanitizedOtp,
          used: false,
          purpose: 'phone verification'
        },
        order: { createdAt: 'DESC' }
      });

      // Debug: List all OTPs for this user to help troubleshoot
      const allUserOtps = await this.otpRepository.find({
        where: {
          user: { id: user.id },
          type: 'sms',
          purpose: 'phone verification'
        },
        order: { createdAt: 'DESC' },
        take: 5
      });

      logger.info('All recent SMS OTPs for user', {
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
        logger.warn('Invalid OTP attempt for phone verification', {
          userId: user.id,
          phone: sanitizedPhone,
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

      // Check for rate limiting (max 5 phone verification attempts per hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentAttempts = await this.otpRepository.count({
        where: {
          user: { id: user.id },
          type: 'sms',
          purpose: 'phone verification',
          createdAt: MoreThanOrEqual(oneHourAgo)
        }
      });

      if (recentAttempts > 5) {
        throw new ApiError(429, 'Too many verification attempts. Please try again later.');
      }

      // Mark OTP as used
      otpRecord.used = true;
      await this.otpRepository.save(otpRecord);

      // Update user phone verification status
      user.isPhoneVerified = true;
      await this.userRepository.save(user);

      // Mark all other phone verification OTPs for this user as used
      await this.otpRepository.update(
        {
          user: { id: user.id },
          type: 'sms',
          purpose: 'phone verification',
          used: false
        },
        {
          used: true
        }
      );

      logger.info('Phone verified successfully', {
        userId: user.id,
        phone: sanitizedPhone
      });

      res.status(200).json(
        ApiResponse.success(
          {
            user: {
              id: user.id,
              phone: user.phone,
              isEmailVerified: user.isEmailVerified,
              isPhoneVerified: user.isPhoneVerified
            }
          },
          'Phone number verified successfully',
          200
        )
      );
    } catch (error: any) {
      logger.error('Phone verification failed:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }

      // Handle database errors
      if (error.name === 'QueryFailedError') {
        throw new ApiError(500, 'Database error occurred. Please try again.');
      }

      throw new ApiError(500, 'Phone verification failed. Please try again later.');
    }
  });
}
