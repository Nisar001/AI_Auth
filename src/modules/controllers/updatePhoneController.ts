import { Request, Response } from 'express';
import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/db';
import { User } from '../../models/User';
import { OtpService as OtpServiceModel } from '../../models/OtpService';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { UpdatePhoneInput, ConfirmUpdatePhoneInput } from '../../validations/authValidations';
import { PasswordUtils } from '../../utils/passwordUtils';
import { asyncHandler } from '../../middlewares/errorHandler';
import { OtpService } from '../../services/otpService';
import logger from '../../utils/logger';

export class UpdatePhoneController {
  // Expose raw async methods for direct testing (bypassing asyncHandler/Express)
  async rawUpdatePhone(req: any, res: any, next: any) {
    return this.updatePhone(req, res, next);
  }

  async rawConfirmUpdatePhone(req: any, res: any, next: any) {
    return this.confirmUpdatePhone(req, res, next);
  }
  private userRepository: Repository<User>;
  private otpRepository: Repository<OtpServiceModel>;
  private otpService: OtpService;

  constructor(
    userRepository?: Repository<User>,
    otpRepository?: Repository<OtpServiceModel>,
    otpService?: OtpService
  ) {
    this.userRepository = userRepository || AppDataSource.getRepository(User);
    this.otpRepository = otpRepository || AppDataSource.getRepository(OtpServiceModel);
    this.otpService = otpService || new OtpService();
  }

  // Request phone update
  updatePhone = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { newPhone, countryCode, currentPassword }: UpdatePhoneInput = req.body;
      const userId = (req as any).user.id;

      // Sanitize input
      const sanitizedPhone = newPhone.trim();
      const sanitizedCountryCode = countryCode.trim();
      console.log('[DEBUG] sanitizedPhone:', sanitizedPhone, 'sanitizedCountryCode:', sanitizedCountryCode);

      if (!sanitizedPhone || !sanitizedCountryCode || !currentPassword) {
        console.log('[DEBUG] Missing input');
        throw new ApiError(400, 'New phone, country code, and password are required');
      }

      // Find user
      const user = await this.userRepository.findOne({
        where: { id: userId }
      });
      console.log('[DEBUG] user:', user);

      if (!user) {
        console.log('[DEBUG] User not found');
        throw new ApiError(404, 'User not found');
      }

      if (!user.password) {
        console.log('[DEBUG] User password not set');
        throw new ApiError(400, 'User password not set');
      }

      // Verify current password
      const isPasswordValid = await PasswordUtils.comparePassword(currentPassword, user.password);
      console.log('[DEBUG] isPasswordValid:', isPasswordValid);
      if (!isPasswordValid) {
        console.log('[DEBUG] Current password is incorrect');
        throw new ApiError(401, 'Current password is incorrect');
      }

      // Check if new phone is different from current
      if (sanitizedPhone === user.phone && sanitizedCountryCode === user.countryCode) {
        console.log('[DEBUG] New phone is same as current');
        throw new ApiError(400, 'New phone number must be different from current phone number');
      }

      // Check if new phone is already taken
      const existingUser = await this.userRepository.findOne({
        where: { 
          phone: sanitizedPhone,
          countryCode: sanitizedCountryCode
        }
      });
      console.log('[DEBUG] existingUser:', existingUser);

      if (existingUser) {
        console.log('[DEBUG] Phone number already registered');
        throw new ApiError(409, 'Phone number is already registered with another account');
      }

      // Store new phone temporarily
      user.pendingPhone = sanitizedPhone;
      user.tempPhone = sanitizedCountryCode; // Store country code temporarily
      console.log('[DEBUG] Saving user:', user);
      await this.userRepository.save(user);

      // Generate and send OTP to new phone
      const tempUser = { 
        ...user, 
        phone: sanitizedPhone, 
        countryCode: sanitizedCountryCode 
      } as User;
      console.log('[DEBUG] tempUser for OTP:', tempUser);
      const otpResult = await this.otpService.generateAndSendOtp(
        tempUser,
        'sms',
        'phone update'
      );
      console.log('[DEBUG] otpResult:', otpResult);

      if (!otpResult.success) {
        console.log('[DEBUG] Failed to send OTP');
        throw new ApiError(500, 'Failed to send verification code to new phone number');
      }

      logger.info('Phone update OTP sent', {
        userId: user.id,
        oldPhone: `${user.countryCode}${user.phone}`,
        newPhone: `${sanitizedCountryCode}${sanitizedPhone}`
      });

      res.status(200).json(
        ApiResponse.success(
          {
            message: 'Verification code sent to new phone number',
            newPhone: `${sanitizedCountryCode}${sanitizedPhone}`,
            expiresInMinutes: 2
          },
          'Phone update initiated. Please check your new phone for verification code.',
          200
        )
      );
    } catch (error: any) {
      logger.error('Phone update request failed:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, 'Phone update request failed. Please try again later.');
    }
  });

  // Confirm phone update with OTP
  confirmUpdatePhone = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { newPhone, otp }: ConfirmUpdatePhoneInput = req.body;
      const userId = (req as any).user.id;

      // Sanitize input
      const sanitizedPhone = newPhone.trim();
      const sanitizedOtp = otp.trim();

      if (!sanitizedPhone || !sanitizedOtp) {
        throw new ApiError(400, 'New phone and OTP are required');
      }

      // Find user
      const user = await this.userRepository.findOne({
        where: { id: userId }
      });

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      // Check if pending phone matches
      if (user.pendingPhone !== sanitizedPhone) {
        throw new ApiError(400, 'Invalid phone update request');
      }

      // Find valid OTP for the new phone
      const otpRecord = await this.otpRepository.findOne({
        where: {
          user: { id: user.id },
          type: 'sms',
          otp: sanitizedOtp,
          used: false,
          purpose: 'phone update'
        },
        order: { createdAt: 'DESC' }
      });

      if (!otpRecord) {
        logger.warn('Invalid OTP attempt for phone update', {
          userId: user.id,
          newPhone: sanitizedPhone,
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

      // Update user phone
      user.phone = sanitizedPhone;
      user.countryCode = user.tempPhone || user.countryCode; // Use stored country code
      user.pendingPhone = undefined;
      user.tempPhone = undefined;
      user.isPhoneVerified = true; // Since they verified the new phone
      console.log('DEBUG: Calling userRepository.save with', user);
      await this.userRepository.save(user);

      // Mark all other phone update OTPs as used
      await this.otpRepository.update(
        {
          user: { id: user.id },
          type: 'sms',
          purpose: 'phone update',
          used: false
        },
        {
          used: true
        }
      );

      logger.info('Phone updated successfully', {
        userId: user.id,
        newPhone: `${user.countryCode}${user.phone}`
      });

      res.status(200).json(
        ApiResponse.success(
          {
            user: {
              id: user.id,
              phone: user.phone,
              countryCode: user.countryCode,
              isPhoneVerified: user.isPhoneVerified
            }
          },
          'Phone number updated successfully',
          200
        )
      );
    } catch (error: any) {
      logger.error('Phone update confirmation failed:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(500, 'Phone update confirmation failed. Please try again later.');
    }
  });
}
