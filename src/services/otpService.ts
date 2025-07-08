import { Repository, MoreThanOrEqual } from 'typeorm';
import { AppDataSource } from '../config/db';
import { OtpService as OtpModel } from '../models/OtpService';
import { User } from '../models/User';
import { OtpGenerator } from '../utils/otpGenerator';
import { EmailService } from './emailService';
import { SmsService } from './smsService';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

export class OtpService {
  private otpRepository: Repository<OtpModel>;
  private userRepository: Repository<User>;
  private emailService: EmailService;
  private smsService: SmsService;

  constructor() {
    this.otpRepository = AppDataSource.getRepository(OtpModel);
    this.userRepository = AppDataSource.getRepository(User);
    this.emailService = new EmailService();
    this.smsService = new SmsService();
  }

  async generateAndSendOtp(
    user: User,
    type: 'email' | 'sms' | 'auth_app',
    purpose: string = 'verification'
  ): Promise<{ success: boolean; otpId?: string; qrCode?: string; secret?: string }> {
    try {
      // Clean up expired OTPs
      await this.cleanupExpiredOtps(user.id);

      let otp: string;
      let secret: string | undefined;
      let qrCode: string | undefined;

      if (type === 'auth_app') {
        // Generate TOTP secret for authenticator apps
        const secretObj = speakeasy.generateSecret({
          name: `AI Auth (${user.email})`,
          issuer: 'AI Auth'
        });
        secret = secretObj.base32;
        otp = speakeasy.totp({
          secret: secret,
          encoding: 'base32'
        });

        // Generate QR code for easy setup
        qrCode = await QRCode.toDataURL(secretObj.otpauth_url!);
      } else {
        otp = OtpGenerator.generateSecureOtp(6);
      }

      const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES || '2'); // Changed to 2 minutes
      const expiresAt = OtpGenerator.getOtpExpiry(expiryMinutes);

      // Save OTP to database
      const otpRecord = this.otpRepository.create({
        user,
        otp,
        secret,
        type,
        expiresAt,
        used: false,
        purpose
      });

      const savedOtp = await this.otpRepository.save(otpRecord);

      // Send OTP based on type
      if (type === 'email') {
        await this.emailService.sendOTPEmail(user.email, otp, purpose);
      } else if (type === 'sms') {
        // Ensure phone number has proper format with country code
        let fullPhone = user.phone;
        if (user.countryCode && !user.phone.startsWith(user.countryCode)) {
          fullPhone = `${user.countryCode}${user.phone}`;
        }
        // Ensure phone starts with +
        if (!fullPhone.startsWith('+')) {
          fullPhone = `+${fullPhone.replace(/^\+/, '')}`;
        }
        
        logger.info('Sending SMS OTP', { 
          userId: user.id, 
          phone: fullPhone,
          purpose 
        });
        
        await this.smsService.sendOTPSms(fullPhone, otp, purpose);
      }

      logger.info(`OTP generated and sent successfully for user ${user.id} via ${type}`);

      return {
        success: true,
        otpId: savedOtp.id,
        qrCode,
        secret: type === 'auth_app' ? secret : undefined
      };
    } catch (error: any) {
      logger.error('Failed to generate and send OTP:', error);
      throw new ApiError(500, 'Failed to generate OTP');
    }
  }

  async verifyOtp(
    userId: string,
    otpCode: string,
    type: 'email' | 'sms' | 'auth_app'
  ): Promise<{ isValid: boolean; otpRecord?: OtpModel }> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId }
      });

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      // For TOTP (authenticator apps), verify against the secret
      if (type === 'auth_app') {
        const otpRecord = await this.otpRepository.findOne({
          where: {
            user: { id: userId },
            type: 'auth_app',
            used: false
          },
          order: { createdAt: 'DESC' }
        });

        if (!otpRecord || !otpRecord.secret) {
          return { isValid: false };
        }

        const isValidTotp = speakeasy.totp.verify({
          secret: otpRecord.secret,
          encoding: 'base32',
          token: otpCode,
          window: 2 // Allow for 2 time steps (60 seconds)
        });

        if (isValidTotp) {
          // Mark OTP as used
          otpRecord.used = true;
          await this.otpRepository.save(otpRecord);
          return { isValid: true, otpRecord };
        }

        return { isValid: false };
      }

      // For regular OTP (email/sms)
      const otpRecord = await this.otpRepository.findOne({
        where: {
          user: { id: userId },
          otp: otpCode,
          type,
          used: false
        },
        order: { createdAt: 'DESC' }
      });

      if (!otpRecord) {
        return { isValid: false };
      }

      // Check if OTP is expired
      if (OtpGenerator.isOtpExpired(otpRecord.expiresAt)) {
        return { isValid: false };
      }

      // Mark OTP as used
      otpRecord.used = true;
      await this.otpRepository.save(otpRecord);

      return { isValid: true, otpRecord };
    } catch (error: any) {
      logger.error('Failed to verify OTP:', error);
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, 'Failed to verify OTP');
    }
  }

  async resendOtp(
    userId: string,
    type: 'email' | 'sms',
    purpose: string = 'verification'
  ): Promise<{ success: boolean; otpId?: string }> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId }
      });

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      // Check if user recently requested an OTP (prevent spam)
      const recentOtp = await this.otpRepository.findOne({
        where: {
          user: { id: userId },
          type,
          used: false
        },
        order: { createdAt: 'DESC' }
      });

      if (recentOtp) {
        const timeDiff = Date.now() - recentOtp.createdAt.getTime();
        const cooldownPeriod = 60 * 1000; // 1 minute cooldown

        if (timeDiff < cooldownPeriod) {
          throw new ApiError(429, 'Please wait before requesting another OTP');
        }
      }

      // Invalidate old OTPs
      await this.otpRepository.update(
        {
          user: { id: userId },
          type,
          used: false
        },
        { used: true }
      );

      // Generate and send new OTP
      const result = await this.generateAndSendOtp(user, type, purpose);
      
      logger.info(`OTP resent successfully for user ${userId} via ${type}`);
      
      return result;
    } catch (error: any) {
      logger.error('Failed to resend OTP:', error);
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, 'Failed to resend OTP');
    }
  }

  private async cleanupExpiredOtps(userId: string): Promise<void> {
    try {
      await this.otpRepository
        .createQueryBuilder()
        .delete()
        .from(OtpModel)
        .where('userId = :userId AND expiresAt < :now', {
          userId,
          now: new Date()
        })
        .execute();
    } catch (error) {
      logger.error('Failed to cleanup expired OTPs:', error);
    }
  }

  async generateSecretFor2FA(userId: string): Promise<{ secret: string; qrCode: string }> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId }
      });

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      const secret = speakeasy.generateSecret({
        name: `AI Auth (${user.email})`,
        issuer: 'AI Auth'
      });

      const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

      // Save the secret temporarily (will be confirmed when user verifies)
      const otpRecord = this.otpRepository.create({
        user,
        otp: '000000', // Placeholder
        secret: secret.base32,
        type: 'auth_app',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        used: false
      });

      await this.otpRepository.save(otpRecord);

      return {
        secret: secret.base32,
        qrCode
      };
    } catch (error: any) {
      logger.error('Failed to generate 2FA secret:', error);
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, 'Failed to generate 2FA secret');
    }
  }

  async countRecentOtps(
    userId: string,
    type: 'email' | 'sms' | 'auth_app',
    purpose: string,
    since: Date
  ): Promise<number> {
    try {
      return await this.otpRepository.count({
        where: {
          user: { id: userId },
          type,
          purpose,
          createdAt: MoreThanOrEqual(since)
        }
      });
    } catch (error: any) {
      logger.error('Failed to count recent OTPs:', error);
      return 0;
    }
  }
}
