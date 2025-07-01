import twilio from 'twilio';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

export class SmsService {
  private client: twilio.Twilio;
  private fromNumber: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || '';

    if (!accountSid || !authToken || !this.fromNumber) {
      logger.warn('Twilio configuration missing - SMS service will be in mock mode', {
        accountSid: !!accountSid,
        authToken: !!authToken,
        fromNumber: !!this.fromNumber
      });
      // Don't throw error, allow mock mode for development
      return;
    }

    try {
      this.client = twilio(accountSid, authToken);
      logger.info('Twilio SMS service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Twilio client:', error);
      throw new ApiError(500, 'SMS service initialization error');
    }
  }

  async sendSms(to: string, message: string): Promise<void> {
    try {
      // If no Twilio client, use mock mode
      if (!this.client) {
        logger.info(`MOCK SMS sent to ${to}: ${message}`);
        console.log(`\n📱 MOCK SMS MESSAGE:`);
        console.log(`To: ${to}`);
        console.log(`Message: ${message}`);
        console.log(`-------------------\n`);
        return;
      }

      // Validate phone number format
      if (!to.startsWith('+')) {
        throw new Error('Phone number must include country code with + prefix');
      }

      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: to
      });

      logger.info(`SMS sent successfully to ${to}: ${result.sid}`);
    } catch (error: any) {
      logger.error('Failed to send SMS:', {
        error: error.message,
        to,
        fromNumber: this.fromNumber
      });
      
      // In development, don't fail if SMS can't be sent
      if (process.env.NODE_ENV === 'development') {
        logger.warn('SMS failed in development mode - continuing with mock');
        console.log(`\n📱 FALLBACK MOCK SMS MESSAGE:`);
        console.log(`To: ${to}`);
        console.log(`Message: ${message}`);
        console.log(`Error: ${error.message}`);
        console.log(`-------------------\n`);
        return;
      }
      
      throw new ApiError(500, 'Failed to send SMS');
    }
  }

  async sendOTPSms(phone: string, otp: string, purpose: string = 'verification'): Promise<void> {
    const message = `Your AI Auth OTP for ${purpose} is: ${otp}. This code expires in 2 minutes. Never share this code with anyone.`;
    await this.sendSms(phone, message);
  }

  async sendWelcomeSms(phone: string, name: string): Promise<void> {
    const message = `Welcome to AI Auth, ${name}! Your account has been created successfully. Please verify your phone number to complete the setup.`;
    await this.sendSms(phone, message);
  }

  async sendPasswordResetSms(phone: string, otp: string): Promise<void> {
    const message = `Your AI Auth password reset OTP is: ${otp}. This code expires in 2 minutes. If you didn't request this, please contact support immediately.`;
    await this.sendSms(phone, message);
  }

  async send2FASms(phone: string, code: string): Promise<void> {
    const message = `Your AI Auth 2FA code is: ${code}. This code expires in 5 minutes. Never share this code with anyone.`;
    await this.sendSms(phone, message);
  }
}
