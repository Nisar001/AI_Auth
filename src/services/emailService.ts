import nodemailer from 'nodemailer';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Verify connection configuration
    this.verifyConnection();
  }

  private async verifyConnection() {
    try {
      await this.transporter.verify();
      logger.info('Email service connected successfully');
    } catch (error) {
      logger.error('Failed to connect to email service:', error);
    }
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent successfully to ${options.to}: ${info.messageId}`);
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw new ApiError(500, 'Failed to send email');
    }
  }

  async sendOTPEmail(email: string, otp: string, purpose: string = 'verification'): Promise<void> {
    const subject = `Your OTP for ${purpose}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>OTP Verification</title>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background-color: #007bff; color: white; text-align: center; padding: 30px; }
          .content { padding: 30px; text-align: center; }
          .otp-code { font-size: 32px; font-weight: bold; color: #007bff; background-color: #f8f9fa; padding: 20px; border-radius: 5px; display: inline-block; letter-spacing: 5px; margin: 20px 0; }
          .warning { color: #dc3545; font-size: 14px; margin-top: 20px; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>AI Auth</h1>
            <p>Secure Authentication Service</p>
          </div>
          <div class="content">
            <h2>OTP for ${purpose.charAt(0).toUpperCase() + purpose.slice(1)}</h2>
            <p>Please use the following OTP to complete your ${purpose}:</p>
            <div class="otp-code">${otp}</div>
            <p>This OTP is valid for 2 minutes only.</p>
            <div class="warning">
              <strong>Security Notice:</strong> Never share this OTP with anyone. Our team will never ask for your OTP.
            </div>
          </div>
          <div class="footer">
            <p>This is an automated message, please do not reply.</p>
            <p>&copy; 2025 AI Auth. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `Your OTP for ${purpose} is: ${otp}. This OTP is valid for 2 minutes only. Never share this OTP with anyone.`;

    await this.sendEmail({
      to: email,
      subject,
      html,
      text
    });
  }

  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    const subject = 'Welcome to AI Auth!';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome to AI Auth</title>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background-color: #28a745; color: white; text-align: center; padding: 30px; }
          .content { padding: 30px; }
          .button { display: inline-block; background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to AI Auth!</h1>
          </div>
          <div class="content">
            <h2>Hello ${name}!</h2>
            <p>Thank you for joining AI Auth. Your account has been successfully created.</p>
            <p>To get started, please verify your email address and phone number to ensure the security of your account.</p>
            <p>If you have any questions or need assistance, feel free to contact our support team.</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 AI Auth. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `Welcome to AI Auth, ${name}! Your account has been successfully created. Please verify your email address and phone number to ensure the security of your account.`;

    await this.sendEmail({
      to: email,
      subject,
      html,
      text
    });
  }

  async sendPasswordResetEmail(email: string, otp: string): Promise<void> {
    const subject = 'Reset Your Password';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Password Reset</title>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background-color: #dc3545; color: white; text-align: center; padding: 30px; }
          .content { padding: 30px; text-align: center; }
          .otp-code { font-size: 32px; font-weight: bold; color: #dc3545; background-color: #f8f9fa; padding: 20px; border-radius: 5px; display: inline-block; letter-spacing: 5px; margin: 20px 0; }
          .warning { color: #dc3545; font-size: 14px; margin-top: 20px; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset</h1>
          </div>
          <div class="content">
            <h2>Reset Your Password</h2>
            <p>We received a request to reset your password. Use the following OTP:</p>
            <div class="otp-code">${otp}</div>
            <p>This OTP is valid for 2 minutes only.</p>
            <div class="warning">
              <strong>Security Notice:</strong> If you didn't request this password reset, please ignore this email and contact support immediately.
            </div>
          </div>
          <div class="footer">
            <p>This is an automated message, please do not reply.</p>
            <p>&copy; 2025 AI Auth. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `Reset your password using this OTP: ${otp}. This OTP is valid for 2 minutes only. If you didn't request this password reset, please ignore this email.`;

    await this.sendEmail({
      to: email,
      subject,
      html,
      text
    });
  }
}
