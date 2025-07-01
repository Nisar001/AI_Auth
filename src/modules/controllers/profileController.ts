import { Request, Response } from 'express';
import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/db';
import { User } from '../../models/User';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { UpdateProfileInput } from '../../validations/authValidations';
import { AuthenticatedRequest } from '../../middlewares/auth';
import { asyncHandler } from '../../middlewares/errorHandler';
import logger from '../../utils/logger';

export class ProfileController {
  private userRepository: Repository<User>;

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
  }

  getProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new ApiError(401, 'Authentication required');
      }

      // Find user by ID
      const user = await this.userRepository.findOne({
        where: { id: userId }
      });

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      // Prepare profile data (excluding sensitive information)
      const profileData = {
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
        dob: user.dob,
        address: {
          houseNumber: user.houseNumber,
          street: user.street,
          city: user.city,
          state: user.state,
          country: user.country,
          pincode: user.pincode
        },
        avatar: user.avatar,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };

      logger.info('Profile retrieved successfully', {
        userId: user.id,
        email: user.email
      });

      res.status(200).json(
        ApiResponse.success(
          { user: profileData },
          'Profile retrieved successfully',
          200
        )
      );
    } catch (error: any) {
      logger.error('Get profile failed:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }

      // Handle database errors
      if (error.name === 'QueryFailedError') {
        throw new ApiError(500, 'Database error occurred. Please try again.');
      }

      throw new ApiError(500, 'Failed to retrieve profile. Please try again later.');
    }
  });

  updateProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new ApiError(401, 'Authentication required');
      }

      const updateData: UpdateProfileInput = req.body;

      // Find user by ID
      const user = await this.userRepository.findOne({
        where: { id: userId }
      });

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      // Validate and update allowed fields
      if (updateData.fname !== undefined) {
        const sanitizedFname = updateData.fname.trim();
        if (!sanitizedFname) {
          throw new ApiError(400, 'First name cannot be empty');
        }
        user.fname = sanitizedFname;
      }

      if (updateData.mname !== undefined) {
        user.mname = updateData.mname ? updateData.mname.trim() : undefined;
      }

      if (updateData.lname !== undefined) {
        const sanitizedLname = updateData.lname.trim();
        if (!sanitizedLname) {
          throw new ApiError(400, 'Last name cannot be empty');
        }
        user.lname = sanitizedLname;
      }

      if (updateData.dob !== undefined) {
        const dobDate = new Date(updateData.dob);
        if (isNaN(dobDate.getTime())) {
          throw new ApiError(400, 'Invalid date of birth format');
        }

        // Validate age
        const today = new Date();
        const age = today.getFullYear() - dobDate.getFullYear();
        const monthDiff = today.getMonth() - dobDate.getMonth();
        const dayDiff = today.getDate() - dobDate.getDate();
        const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;

        if (actualAge < 13) {
          throw new ApiError(400, 'You must be at least 13 years old');
        }
        if (actualAge > 120) {
          throw new ApiError(400, 'Please enter a valid date of birth');
        }

        user.dob = dobDate;
      }

      // Update address fields if provided
      if (updateData.address) {
        if (updateData.address.houseNumber !== undefined) {
          const sanitizedHouseNumber = updateData.address.houseNumber.trim();
          if (!sanitizedHouseNumber) {
            throw new ApiError(400, 'House number cannot be empty');
          }
          user.houseNumber = sanitizedHouseNumber;
        }

        if (updateData.address.street !== undefined) {
          const sanitizedStreet = updateData.address.street.trim();
          if (!sanitizedStreet) {
            throw new ApiError(400, 'Street cannot be empty');
          }
          user.street = sanitizedStreet;
        }

        if (updateData.address.city !== undefined) {
          const sanitizedCity = updateData.address.city.trim();
          if (!sanitizedCity) {
            throw new ApiError(400, 'City cannot be empty');
          }
          user.city = sanitizedCity;
        }

        if (updateData.address.state !== undefined) {
          const sanitizedState = updateData.address.state.trim();
          if (!sanitizedState) {
            throw new ApiError(400, 'State cannot be empty');
          }
          user.state = sanitizedState;
        }

        if (updateData.address.country !== undefined) {
          const sanitizedCountry = updateData.address.country.trim();
          if (!sanitizedCountry) {
            throw new ApiError(400, 'Country cannot be empty');
          }
          user.country = sanitizedCountry;
        }

        if (updateData.address.pincode !== undefined) {
          const sanitizedPincode = updateData.address.pincode.trim();
          if (!sanitizedPincode) {
            throw new ApiError(400, 'Pincode cannot be empty');
          }
          user.pincode = sanitizedPincode;
        }
      }

      // Save updated user
      const updatedUser = await this.userRepository.save(user);

      // Prepare response data
      const profileData = {
        id: updatedUser.id,
        fname: updatedUser.fname,
        mname: updatedUser.mname,
        lname: updatedUser.lname,
        email: updatedUser.email,
        phone: updatedUser.phone,
        countryCode: updatedUser.countryCode,
        isEmailVerified: updatedUser.isEmailVerified,
        isPhoneVerified: updatedUser.isPhoneVerified,
        is2FAEnabled: updatedUser.is2FAEnabled,
        authType: updatedUser.authType,
        dob: updatedUser.dob,
        address: {
          houseNumber: updatedUser.houseNumber,
          street: updatedUser.street,
          city: updatedUser.city,
          state: updatedUser.state,
          country: updatedUser.country,
          pincode: updatedUser.pincode
        },
        avatar: updatedUser.avatar,
        lastLoginAt: updatedUser.lastLoginAt,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt
      };

      logger.info('Profile updated successfully', {
        userId: updatedUser.id,
        email: updatedUser.email,
        updatedFields: Object.keys(updateData)
      });

      res.status(200).json(
        ApiResponse.success(
          { user: profileData },
          'Profile updated successfully',
          200
        )
      );
    } catch (error: any) {
      logger.error('Update profile failed:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }

      // Handle database errors
      if (error.name === 'QueryFailedError') {
        throw new ApiError(500, 'Database error occurred. Please try again.');
      }

      throw new ApiError(500, 'Failed to update profile. Please try again later.');
    }
  });
}
