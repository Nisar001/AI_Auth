import { Request, Response } from 'express';
import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/db';
import { User } from '../../models/User';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { JwtUtils, JwtPayload } from '../../utils/jwtUtils';
import { EmailService } from '../../services/emailService';
import { SocialLoginInput, SocialAuthCallbackInput } from '../../validations/authValidations';
import { asyncHandler } from '../../middlewares/errorHandler';
import logger from '../../utils/logger';
import crypto from 'crypto';

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
}

interface GitHubUserInfo {
  id: number;
  login: string;
  email: string;
  name: string;
  avatar_url: string;
  location: string;
  company: string;
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  refresh_token?: string;
}

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

interface GitHubEmailInfo {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string;
}

export class SocialLoginController {
  private userRepository: Repository<User>;
  private emailService: EmailService;

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
    this.emailService = new EmailService();
  }

  // Generate OAuth URL for Google
  getGoogleAuthUrl = asyncHandler(async (req: Request, res: Response) => {
    try {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const redirectUri = process.env.GOOGLE_REDIRECT_URI;
      
      if (!clientId || !redirectUri) {
        throw new ApiError(500, 'Google OAuth configuration missing');
      }

      const state = crypto.randomBytes(32).toString('hex');
      const scope = 'openid email profile';
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent(scope)}&` +
        `state=${state}&` +
        `access_type=offline&` +
        `prompt=consent`;

      // Store state in session or cache for verification (simplified here)
      
      res.status(200).json(
        ApiResponse.success(
          {
            authUrl,
            state,
            provider: 'google'
          },
          'Google OAuth URL generated successfully',
          200
        )
      );
    } catch (error: any) {
      logger.error('Failed to generate Google auth URL:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }
      
      throw new ApiError(500, 'Failed to generate authentication URL');
    }
  });

  // Generate OAuth URL for GitHub
  getGitHubAuthUrl = asyncHandler(async (req: Request, res: Response) => {
    try {
      const clientId = process.env.GITHUB_CLIENT_ID;
      const redirectUri = process.env.GITHUB_REDIRECT_URI;
      
      if (!clientId || !redirectUri) {
        throw new ApiError(500, 'GitHub OAuth configuration missing');
      }

      const state = crypto.randomBytes(32).toString('hex');
      const scope = 'user:email';
      
      const authUrl = `https://github.com/login/oauth/authorize?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scope)}&` +
        `state=${state}`;

      res.status(200).json(
        ApiResponse.success(
          {
            authUrl,
            state,
            provider: 'github'
          },
          'GitHub OAuth URL generated successfully',
          200
        )
      );
    } catch (error: any) {
      logger.error('Failed to generate GitHub auth URL:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }
      
      throw new ApiError(500, 'Failed to generate authentication URL');
    }
  });

  // Handle Google OAuth callback
  googleCallback = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { code, state }: SocialAuthCallbackInput = req.body;

      if (!code) {
        throw new ApiError(400, 'Authorization code is required');
      }

      // Exchange code for access token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          code,
          grant_type: 'authorization_code',
          redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        }),
      });

      if (!tokenResponse.ok) {
        throw new ApiError(400, 'Failed to exchange code for access token');
      }

      const tokenData = await tokenResponse.json() as GoogleTokenResponse;
      const accessToken = tokenData.access_token;

      // Get user info from Google
      const userResponse = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`);
      
      if (!userResponse.ok) {
        throw new ApiError(400, 'Failed to get user information from Google');
      }

      const googleUser = await userResponse.json() as GoogleUserInfo;

      // Process the user data
      const result = await this.processGoogleUser(googleUser, req);

      res.status(200).json(
        ApiResponse.success(
          result,
          result.isNewUser ? 'Account created and logged in successfully' : 'Logged in successfully',
          200
        )
      );
    } catch (error: any) {
      logger.error('Google OAuth callback failed:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }
      
      throw new ApiError(500, 'Google authentication failed');
    }
  });

  // Handle GitHub OAuth callback
  githubCallback = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { code, state }: SocialAuthCallbackInput = req.body;

      if (!code) {
        throw new ApiError(400, 'Authorization code is required');
      }

      // Exchange code for access token
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID!,
          client_secret: process.env.GITHUB_CLIENT_SECRET!,
          code,
        }),
      });

      if (!tokenResponse.ok) {
        throw new ApiError(400, 'Failed to exchange code for access token');
      }

      const tokenData = await tokenResponse.json() as GitHubTokenResponse;
      const accessToken = tokenData.access_token;

      // Get user info from GitHub
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${accessToken}`,
          'User-Agent': 'AI-Auth-App',
        },
      });

      if (!userResponse.ok) {
        throw new ApiError(400, 'Failed to get user information from GitHub');
      }

      const githubUser = await userResponse.json() as GitHubUserInfo;

      // Get user email if not public
      if (!githubUser.email) {
        const emailResponse = await fetch('https://api.github.com/user/emails', {
          headers: {
            'Authorization': `token ${accessToken}`,
            'User-Agent': 'AI-Auth-App',
          },
        });

        if (emailResponse.ok) {
          const emails = await emailResponse.json() as GitHubEmailInfo[];
          const primaryEmail = emails.find((email: GitHubEmailInfo) => email.primary);
          githubUser.email = primaryEmail?.email || '';
        }
      }

      // Process the user data
      const result = await this.processGitHubUser(githubUser, req);

      res.status(200).json(
        ApiResponse.success(
          result,
          result.isNewUser ? 'Account created and logged in successfully' : 'Logged in successfully',
          200
        )
      );
    } catch (error: any) {
      logger.error('GitHub OAuth callback failed:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }
      
      throw new ApiError(500, 'GitHub authentication failed');
    }
  });

  // Generic social login handler (for direct token approach)
  socialLogin = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { provider, accessToken, email, name, socialId, avatar }: SocialLoginInput = req.body;

      if (!provider || !accessToken || !email || !socialId) {
        throw new ApiError(400, 'Provider, access token, email, and social ID are required');
      }

      if (!['google', 'github', 'facebook', 'apple'].includes(provider)) {
        throw new ApiError(400, 'Unsupported social login provider');
      }

      // Verify token with the provider (implementation depends on provider)
      const isValidToken = await this.verifyAccessToken(provider, accessToken, socialId);
      
      if (!isValidToken) {
        throw new ApiError(401, 'Invalid access token');
      }

      // Check if user exists by email or social ID
      let user = await this.userRepository.findOne({
        where: [
          { email: email.toLowerCase().trim() },
          { socialId: socialId, authType: provider }
        ]
      });

      let isNewUser = false;

      if (!user) {
        // Create new user
        const [firstName, ...lastNameParts] = (name || '').split(' ');
        const lastName = lastNameParts.join(' ');

        user = this.userRepository.create({
          fname: firstName || 'User',
          lname: lastName || provider.charAt(0).toUpperCase() + provider.slice(1),
          email: email.toLowerCase().trim(),
          socialId: socialId,
          authType: provider,
          avatar: avatar,
          isEmailVerified: true, // Social accounts are considered verified
          isPhoneVerified: false,
          phone: '', // Will be required to be set later
          countryCode: '+1', // Default, can be updated
          houseNumber: '',
          street: '',
          city: '',
          state: '',
          country: '',
          pincode: '',
          dob: new Date('1990-01-01'), // Default, can be updated
          is2FAEnabled: false,
          tokenVersion: 1,
          loginAttempts: 0
        });

        user = await this.userRepository.save(user);
        isNewUser = true;

        // Send welcome email
        try {
          await this.emailService.sendWelcomeEmail(user.email, user.fname);
        } catch (emailError) {
          logger.warn('Failed to send welcome email for social login:', emailError);
        }

        logger.info('New user created via social login', {
          userId: user.id,
          email: user.email,
          provider,
          socialId
        });
      } else {
        // Update existing user's social info if needed
        let shouldUpdate = false;

        if (user.socialId !== socialId) {
          user.socialId = socialId;
          shouldUpdate = true;
        }

        if (user.authType !== provider) {
          user.authType = provider;
          shouldUpdate = true;
        }

        if (avatar && user.avatar !== avatar) {
          user.avatar = avatar;
          shouldUpdate = true;
        }

        if (shouldUpdate) {
          await this.userRepository.save(user);
        }

        // Update last login
        user.lastLoginAt = new Date();
        await this.userRepository.save(user);

        logger.info('Existing user logged in via social login', {
          userId: user.id,
          email: user.email,
          provider,
          socialId
        });
      }

      // Generate JWT tokens
      const tokenPayload: JwtPayload = {
        userId: user.id,
        email: user.email,
        phone: user.phone,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified
      };

      const jwtAccessToken = JwtUtils.generateAccessToken(tokenPayload);
      const refreshToken = JwtUtils.generateRefreshToken({
        userId: user.id,
        tokenVersion: user.tokenVersion
      });

      // Prepare response data
      const responseData = {
        user: {
          id: user.id,
          fname: user.fname,
          mname: user.mname,
          lname: user.lname,
          email: user.email,
          phone: user.phone,
          countryCode: user.countryCode,
          isEmailVerified: user.isEmailVerified,
          isPhoneVerified: user.isPhoneVerified,
          is2FAEnabled: user.is2FAEnabled,
          authType: user.authType,
          avatar: user.avatar,
          socialId: user.socialId,
          lastLogin: user.lastLoginAt
        },
        tokens: {
          accessToken: jwtAccessToken,
          refreshToken
        },
        isNewUser,
        nextSteps: isNewUser ? [
          'Complete your profile by adding phone number and address',
          'Verify your phone number for enhanced security',
          'Set up two-factor authentication (optional)'
        ] : []
      };

      res.status(200).json(
        ApiResponse.success(
          responseData,
          isNewUser ? 'Account created and logged in successfully' : 'Logged in successfully',
          200
        )
      );
    } catch (error: any) {
      logger.error('Social login failed:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(500, 'Social login failed. Please try again later.');
    }
  });

  private async processGoogleUser(googleUser: GoogleUserInfo, req: Request) {
    // Check if user exists by email or Google ID
    let user = await this.userRepository.findOne({
      where: [
        { email: googleUser.email.toLowerCase() },
        { socialId: googleUser.id, authType: 'google' }
      ]
    });

    let isNewUser = false;

    if (!user) {
      // Create new user
      user = this.userRepository.create({
        fname: googleUser.given_name || 'User',
        lname: googleUser.family_name || 'Google',
        email: googleUser.email.toLowerCase(),
        socialId: googleUser.id,
        authType: 'google',
        avatar: googleUser.picture,
        isEmailVerified: googleUser.verified_email,
        isPhoneVerified: false,
        phone: '',
        countryCode: '+1',
        houseNumber: '',
        street: '',
        city: '',
        state: '',
        country: '',
        pincode: '',
        dob: new Date('1990-01-01'),
        is2FAEnabled: false,
        tokenVersion: 1,
        loginAttempts: 0
      });

      user = await this.userRepository.save(user);
      isNewUser = true;

      logger.info('New user created via Google login', {
        userId: user.id,
        email: user.email,
        googleId: googleUser.id
      });
    } else {
      // Update last login
      user.lastLoginAt = new Date();
      await this.userRepository.save(user);

      logger.info('Existing user logged in via Google', {
        userId: user.id,
        email: user.email
      });
    }

    return this.generateAuthResponse(user, isNewUser);
  }

  private async processGitHubUser(githubUser: GitHubUserInfo, req: Request) {
    // Check if user exists by email or GitHub ID
    let user = await this.userRepository.findOne({
      where: [
        { email: githubUser.email?.toLowerCase() || '' },
        { socialId: githubUser.id.toString(), authType: 'github' }
      ]
    });

    let isNewUser = false;

    if (!user) {
      if (!githubUser.email) {
        throw new ApiError(400, 'Email is required for account creation. Please make your GitHub email public.');
      }

      // Create new user
      const [firstName, ...lastNameParts] = (githubUser.name || githubUser.login || '').split(' ');
      
      user = this.userRepository.create({
        fname: firstName || githubUser.login || 'User',
        lname: lastNameParts.join(' ') || 'GitHub',
        email: githubUser.email.toLowerCase(),
        socialId: githubUser.id.toString(),
        authType: 'github',
        avatar: githubUser.avatar_url,
        isEmailVerified: true, // GitHub emails are considered verified
        isPhoneVerified: false,
        phone: '',
        countryCode: '+1',
        houseNumber: '',
        street: '',
        city: githubUser.location || '',
        state: '',
        country: '',
        pincode: '',
        dob: new Date('1990-01-01'),
        is2FAEnabled: false,
        tokenVersion: 1,
        loginAttempts: 0
      });

      user = await this.userRepository.save(user);
      isNewUser = true;

      logger.info('New user created via GitHub login', {
        userId: user.id,
        email: user.email,
        githubId: githubUser.id
      });
    } else {
      // Update last login
      user.lastLoginAt = new Date();
      await this.userRepository.save(user);

      logger.info('Existing user logged in via GitHub', {
        userId: user.id,
        email: user.email
      });
    }

    return this.generateAuthResponse(user, isNewUser);
  }

  private generateAuthResponse(user: User, isNewUser: boolean) {
    // Generate JWT tokens
    const tokenPayload: JwtPayload = {
      userId: user.id,
      email: user.email,
      phone: user.phone,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified
    };

    const accessToken = JwtUtils.generateAccessToken(tokenPayload);
    const refreshToken = JwtUtils.generateRefreshToken({
      userId: user.id,
      tokenVersion: user.tokenVersion
    });

    return {
      user: {
        id: user.id,
        fname: user.fname,
        mname: user.mname,
        lname: user.lname,
        email: user.email,
        phone: user.phone,
        countryCode: user.countryCode,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        is2FAEnabled: user.is2FAEnabled,
        authType: user.authType,
        avatar: user.avatar,
        socialId: user.socialId,
        lastLogin: user.lastLoginAt
      },
      tokens: {
        accessToken,
        refreshToken
      },
      isNewUser,
      nextSteps: isNewUser ? [
        'Complete your profile by adding phone number and address',
        'Verify your phone number for enhanced security',
        'Set up two-factor authentication (optional)'
      ] : []
    };
  }

  private async verifyAccessToken(provider: string, accessToken: string, socialId: string): Promise<boolean> {
    try {
      switch (provider) {
        case 'google':
          const googleResponse = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`);
          if (googleResponse.ok) {
            const userData = await googleResponse.json() as GoogleUserInfo;
            return userData.id === socialId;
          }
          break;

        case 'github':
          const githubResponse = await fetch('https://api.github.com/user', {
            headers: {
              'Authorization': `token ${accessToken}`,
              'User-Agent': 'AI-Auth-App',
            },
          });
          if (githubResponse.ok) {
            const userData = await githubResponse.json() as GitHubUserInfo;
            return userData.id.toString() === socialId;
          }
          break;

        default:
          return false;
      }

      return false;
    } catch (error) {
      logger.error('Token verification failed:', error);
      return false;
    }
  }
}
