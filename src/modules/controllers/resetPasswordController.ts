import { Request, Response } from 'express';
import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/db';
import { User } from '../../models/User';
import { OtpService as OtpServiceModel } from '../../models/OtpService';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { PasswordUtils } from '../../utils/passwordUtils';
import { ResetPasswordInput } from '../../validations/authValidations';
import { asyncHandler } from '../../middlewares/errorHandler';
import logger from '../../utils/logger';

export class ResetPasswordController {
  private userRepository: Repository<User>;
  private otpRepository: Repository<OtpServiceModel>;

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
    this.otpRepository = AppDataSource.getRepository(OtpServiceModel);
  }

  resetPassword = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { identifier, otp, newPassword }: ResetPasswordInput = req.body;

      // Sanitize input
      const sanitizedIdentifier = identifier.toLowerCase().trim();
      const sanitizedOtp = otp.trim();

      if (!sanitizedIdentifier || !sanitizedOtp || !newPassword) {
        throw new ApiError(400, 'All fields are required');
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

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      // Check if account is locked
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        throw new ApiError(423, 'Account is temporarily locked. Please try again later.');
      }

      // Find valid password reset OTP
      const otpRecord = await this.otpRepository.findOne({
        where: {
          user: { id: user.id },
          purpose: 'password_reset',
          otp: sanitizedOtp,
          used: false
        },
        order: { createdAt: 'DESC' }
      });

      if (!otpRecord) {
        logger.warn('Invalid password reset OTP attempt', {
          userId: user.id,
          identifier: sanitizedIdentifier,
          otp: sanitizedOtp,
          ip: req.ip
        });
        throw new ApiError(400, 'Invalid or expired reset code');
      }

      // Check if OTP is expired
      const now = new Date();
      if (otpRecord.expiresAt < now) {
        // Mark expired OTP as used
        otpRecord.used = true;
        await this.otpRepository.save(otpRecord);
        
        throw new ApiError(400, 'Reset code has expired. Please request a new one.');
      }

      // Validate new password strength
      const passwordValidation = PasswordUtils.validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        throw new ApiError(400, 'Password does not meet security requirements', passwordValidation.errors);
      }

      // Check if new password is different from current password
      if (user.password) {
        const isSamePassword = await PasswordUtils.comparePassword(newPassword, user.password);
        if (isSamePassword) {
          throw new ApiError(400, 'New password must be different from your current password');
        }
      }

      // Check if password contains personal information
      const personalInfo = [
        user.fname.toLowerCase(),
        user.lname.toLowerCase(),
        user.email.split('@')[0].toLowerCase()
      ];
      
      const passwordLower = newPassword.toLowerCase();
      for (const info of personalInfo) {
        if (info.length > 2 && passwordLower.includes(info)) {
          throw new ApiError(400, 'Password cannot contain personal information like your name or email');
        }
      }

      // Hash new password
      const hashedPassword = await PasswordUtils.hashPassword(newPassword);

      // Update user password and reset security fields
      user.password = hashedPassword;
      user.tokenVersion = (user.tokenVersion || 1) + 1; // Invalidate all refresh tokens
      user.loginAttempts = 0;
      user.lockedUntil = undefined;

      await this.userRepository.save(user);

      // Mark OTP as used
      otpRecord.used = true;
      await this.otpRepository.save(otpRecord);

      // Mark all other password reset OTPs for this user as used
      await this.otpRepository.update(
        {
          user: { id: user.id },
          purpose: 'password_reset',
          used: false
        },
        {
          used: true
        }
      );

      logger.info('Password reset successfully', {
        userId: user.id,
        identifier: sanitizedIdentifier
      });

      res.status(200).json(
        ApiResponse.success(
          {
            message: 'Password reset successfully'
          },
          'Your password has been reset successfully. Please log in with your new password.',
          200
        )
      );
    } catch (error: any) {
      logger.error('Password reset failed:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }

      // Handle database errors
      if (error.name === 'QueryFailedError') {
        throw new ApiError(500, 'Database error occurred. Please try again.');
      }

      throw new ApiError(500, 'Password reset failed. Please try again later.');
    }
  });
}
