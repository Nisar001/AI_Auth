import { Request, Response } from 'express';
import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/db';
import { User } from '../../models/User';
import { OtpService as OtpServiceModel } from '../../models/OtpService';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { UpdateEmailInput, ConfirmUpdateEmailInput } from '../../validations/authValidations';
import { PasswordUtils } from '../../utils/passwordUtils';
import { asyncHandler } from '../../middlewares/errorHandler';
import { OtpService } from '../../services/otpService';
import logger from '../../utils/logger';

export class UpdateEmailController {
  private userRepository: Repository<User>;
  private otpRepository: Repository<OtpServiceModel>;
  private otpService: OtpService;

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
    this.otpRepository = AppDataSource.getRepository(OtpServiceModel);
    this.otpService = new OtpService();
  }

  // Request email update
  // For testing, export the raw async function as well
  rawUpdateEmail = async (req: Request, res: Response, next: Function) => {
    try {
      const { newEmail, currentPassword }: UpdateEmailInput = req.body;
      const userId = (req as any).user.id;

      // Sanitize input
      const sanitizedEmail = newEmail.toLowerCase().trim();

      if (!sanitizedEmail || !currentPassword) {
        throw new ApiError(400, 'New email and password are required');
      }

      // Find user
      const user = await this.userRepository.findOne({
        where: { id: userId }
      });

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      if (!user.password) {
        throw new ApiError(400, 'User password not set');
      }

      // Verify current password
      const isPasswordValid = await PasswordUtils.comparePassword(currentPassword, user.password);
      if (!isPasswordValid) {
        throw new ApiError(401, 'Current password is incorrect');
      }

      // Check if new email is different from current
      if (sanitizedEmail === user.email) {
        throw new ApiError(400, 'New email must be different from current email');
      }

      // Check if new email is already taken
      const existingUser = await this.userRepository.findOne({
        where: { email: sanitizedEmail }
      });

      if (existingUser) {
        throw new ApiError(409, 'Email is already registered with another account');
      }

      // Store new email temporarily in a separate field (you may need to add this field to User model)
      user.pendingEmail = sanitizedEmail;
      await this.userRepository.save(user);

      // Generate and send OTP to new email
      const otpResult = await this.otpService.generateAndSendOtp(
        { ...user, email: sanitizedEmail } as User,
        'email',
        'email update'
      );

      if (!otpResult.success) {
        throw new ApiError(500, 'Failed to send verification code to new email');
      }

      logger.info('Email update OTP sent', {
        userId: user.id,
        oldEmail: user.email,
        newEmail: sanitizedEmail
      });

      res.status(200).json(
        ApiResponse.success(
          {
            message: 'Verification code sent to new email address',
            newEmail: sanitizedEmail,
            expiresInMinutes: 2
          },
          'Email update initiated. Please check your new email for verification code.',
          200
        )
      );
    } catch (error: any) {
      logger.error('Email update request failed:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(500, 'Email update request failed. Please try again later.');
    }
  };
  updateEmail = asyncHandler(this.rawUpdateEmail);

  // Confirm email update with OTP
  rawConfirmUpdateEmail = async (req: Request, res: Response, next: Function) => {
    try {
      const { newEmail, otp }: ConfirmUpdateEmailInput = req.body;
      const userId = (req as any).user.id;

      // Sanitize input
      const sanitizedEmail = newEmail.toLowerCase().trim();
      const sanitizedOtp = otp.trim();

      if (!sanitizedEmail || !sanitizedOtp) {
        throw new ApiError(400, 'New email and OTP are required');
      }

      // Find user
      const user = await this.userRepository.findOne({
        where: { id: userId }
      });

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      // Check if pending email matches
      if (user.pendingEmail !== sanitizedEmail) {
        throw new ApiError(400, 'Invalid email update request');
      }

      // Find valid OTP for the new email
      const otpRecord = await this.otpRepository.findOne({
        where: {
          user: { id: user.id },
          type: 'email',
          otp: sanitizedOtp,
          used: false,
          purpose: 'email update'
        },
        order: { createdAt: 'DESC' }
      });

      if (!otpRecord) {
        logger.warn('Invalid OTP attempt for email update', {
          userId: user.id,
          newEmail: sanitizedEmail,
          otp: sanitizedOtp,
          ip: req.ip
        });
        throw new ApiError(400, 'Invalid or expired OTP');
      }

      // Check if OTP is expired
      const now = new Date();
      if (otpRecord.expiresAt < now) {
        otpRecord.used = true;
        await this.otpRepository.save(otpRecord);
        throw new ApiError(400, 'OTP has expired. Please request a new one.');
      }

      // Mark OTP as used
      otpRecord.used = true;
      await this.otpRepository.save(otpRecord);

      // Update user email
      user.email = sanitizedEmail;
      user.pendingEmail = undefined;
      user.isEmailVerified = true; // Since they verified the new email
      await this.userRepository.save(user);

      // Mark all other email update OTPs as used
      await this.otpRepository.update(
        {
          user: { id: user.id },
          type: 'email',
          purpose: 'email update',
          used: false
        },
        {
          used: true
        }
      );

      logger.info('Email updated successfully', {
        userId: user.id,
        newEmail: sanitizedEmail
      });

      res.status(200).json(
        ApiResponse.success(
          {
            user: {
              id: user.id,
              email: user.email,
              isEmailVerified: user.isEmailVerified
            }
          },
          'Email updated successfully',
          200
        )
      );
    } catch (error: any) {
      logger.error('Email update confirmation failed:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(500, 'Email update confirmation failed. Please try again later.');
    }
  };
  confirmUpdateEmail = asyncHandler(this.rawConfirmUpdateEmail);
}
