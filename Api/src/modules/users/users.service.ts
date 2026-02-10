import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { User } from '@entities/users.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserStatus } from '@common/enums/user-status.enum';
import { AppException } from '@common/exceptions/app.exception';
import { ErrorCode } from '@common/enums/errror-code.enum';
import { NotificationsService } from '@modules/notifications/notifications.service';

import * as crypto from 'crypto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private notificationsService: NotificationsService,
  ) {}

  async generateEmployeeId(): Promise<string> {
    const year = new Date().getFullYear().toString().slice(-2);
    const prefix = `EMP${year}`;

    const latestUser = await this.usersRepository
      .createQueryBuilder('user')
      .where('user.employee_id LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('user.employee_id', 'DESC')
      .getOne();

    let nextNumber = 1;
    if (latestUser && latestUser.employeeId) {
      const lastNumber = parseInt(latestUser.employeeId.slice(-4));
      nextNumber = lastNumber + 1;
    }

    return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
  }

  /**
   * Generate activation token for new users
   */
  generateActivationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  async getUsers(): Promise<User[]> {
    return await this.usersRepository.find({});
  }

  async getUser(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
    });
    if (!user) {
      throw new AppException(ErrorCode.USER_NOT_FOUND, 'User not found', HttpStatus.NOT_FOUND);
    }
    return user;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return await this.usersRepository.findOne({
      where: { email },
    });
  }

  async findByEmployeeId(employeeId: string): Promise<User | null> {
    return await this.usersRepository.findOne({
      where: { employeeId },
    });
  }

  async createUser(user: CreateUserDto): Promise<User> {
    // Validate required fields
    if (!user.email) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Email is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!user.employeeId) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Employee ID is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!user.username) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Username is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Check if email already exists
    const existingUser = await this.usersRepository.findOne({ where: { email: user.email } });
    if (existingUser) {
      throw new AppException(
        ErrorCode.EMAIL_ALREADY_EXISTS,
        'User with this email already exists',
        HttpStatus.CONFLICT,
      );
    }

    // Check if employeeId already exists
    const existingEmployee = await this.usersRepository.findOne({
      where: { employeeId: user.employeeId },
    });
    if (existingEmployee) {
      throw new AppException(
        ErrorCode.EMPLOYEE_ID_ALREADY_EXISTS,
        'User with this employee ID already exists',
        HttpStatus.CONFLICT,
      );
    }

    // Generate activation token for pending users
    const activationToken = this.generateActivationToken();

    // Set default status to PENDING
    const userData = {
      ...user,
      status: UserStatus.PENDING,
      activationToken,
    };

    try {
      const newUser = this.usersRepository.create(userData);
      const savedUser = await this.usersRepository.save(newUser);

      // Enqueue activation email with correct format
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const activationLink = `${frontendUrl}/auth/activate?token=${activationToken}`;

      await this.notificationsService.enqueueActivationEmail(
        savedUser.id,
        activationToken,
        activationLink,
      );

      this.logger.log(
        `User created: ${savedUser.email}, status: ${savedUser.status}, activation email queued`,
      );
      return savedUser;
    } catch (error) {
      this.logger.error('Error creating user:', error);
      throw new AppException(
        ErrorCode.INTERNAL_SERVER_ERROR,
        `Failed to create user: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // implement
  async updateUser(id: number, user: UpdateUserDto): Promise<User> {
    const existingUser = await this.usersRepository.findOne({ where: { id } });
    if (!existingUser) {
      throw new AppException(ErrorCode.USER_NOT_FOUND, 'User not found', HttpStatus.NOT_FOUND);
    }

    // Email cannot be changed
    if ('email' in user && (user as any).email !== undefined) {
      throw new AppException(
        ErrorCode.INVALID_INPUT,
        'Email cannot be changed',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Employee ID cannot be changed
    if ('employeeId' in user && user.employeeId !== undefined) {
      throw new AppException(
        ErrorCode.INVALID_INPUT,
        'Employee ID cannot be changed',
        HttpStatus.BAD_REQUEST,
      );
    }

    const updatedUser = this.usersRepository.merge(existingUser, user);
    return await this.usersRepository.save(updatedUser);
  }

  async deleteUser(id: number): Promise<void> {
    const existingUser = await this.usersRepository.findOne({ where: { id } });
    if (!existingUser) {
      throw new AppException(ErrorCode.USER_NOT_FOUND, 'User not found', HttpStatus.NOT_FOUND);
    }
    await this.usersRepository.delete(id);
  }

  /**
   * Activate user account with token
   */
  async activateAccount(token: string): Promise<User> {
    this.logger.log('========== ACTIVATE ACCOUNT START ==========');
    this.logger.log(`Activation token received: ${token}`);

    this.logger.log('Looking up user by activation token...');
    const user = await this.usersRepository.findOne({
      where: { activationToken: token },
    });

    if (!user) {
      this.logger.error(`❌ No user found with activation token: ${token}`);
      this.logger.log('========== ACTIVATE ACCOUNT FAILED ==========');
      throw new AppException(
        ErrorCode.INVALID_ACTIVATION_TOKEN,
        'Invalid activation token',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.log(`✓ User found`);
    this.logger.log(`   - User ID: ${user.id}`);
    this.logger.log(`   - Email: ${user.email}`);
    this.logger.log(`   - Current Status: ${user.status}`);
    this.logger.log(`   - Current Activation Token: ${user.activationToken}`);

    // Check if user status is PENDING before allowing activation
    if (user.status !== UserStatus.PENDING) {
      this.logger.error(`❌ Cannot activate account with status: ${user.status}`);
      this.logger.log('   - Only PENDING accounts can be activated via link');
      this.logger.log('========== ACTIVATE ACCOUNT FAILED ==========');
      throw new AppException(
        ErrorCode.INVALID_INPUT,
        `Cannot activate account. Current status is ${user.status}. Only pending accounts can be activated via activation link.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Update user status and clear activation token
    this.logger.log('Updating user status to ACTIVE and clearing activation token...');
    user.status = UserStatus.ACTIVE;
    user.activatedAt = new Date();
    user.activationToken = null;

    const savedUser = await this.usersRepository.save(user);

    this.logger.log(`✓ User account activated successfully`);
    this.logger.log(`   - New Status: ${savedUser.status}`);
    this.logger.log(
      `   - Activation Token: ${savedUser.activationToken === null ? 'CLEARED' : savedUser.activationToken}`,
    );
    this.logger.log(`   - Activated At: ${savedUser.activatedAt}`);
    this.logger.log('========== ACTIVATE ACCOUNT SUCCESS ==========');

    return savedUser;
  }

  async deacativateAccount(userId: number): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new AppException(ErrorCode.USER_NOT_FOUND, 'User not found', HttpStatus.NOT_FOUND);
    }
    if (user.status === UserStatus.INACTIVE) {
      throw new AppException(
        ErrorCode.INVALID_INPUT,
        `Cannot deactivate account. Current status is ${user.status}.`,
        HttpStatus.BAD_REQUEST,
      );
    }
    user.status = UserStatus.INACTIVE;
    user.activationToken = null;
    return await this.usersRepository.save(user);
  }

  async reactivateAccount(userId: number): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new AppException(ErrorCode.USER_NOT_FOUND, 'User not found', HttpStatus.NOT_FOUND);
    }
    if (user.status !== UserStatus.INACTIVE) {
      throw new AppException(
        ErrorCode.INVALID_INPUT,
        `Cannot reactivate account. Current status is ${user.status}. Only inactive accounts can be reactivated.`,
        HttpStatus.BAD_REQUEST,
      );
    }
    user.status = UserStatus.ACTIVE;
    return await this.usersRepository.save(user);
  }
  /**
   * Get activation token for user (for HR to send activation link)
   */
  async getActivationToken(userId: number): Promise<string> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new AppException(ErrorCode.USER_NOT_FOUND, 'User not found', HttpStatus.NOT_FOUND);
    }

    if (user.status === UserStatus.ACTIVE) {
      throw new AppException(
        ErrorCode.ACCOUNT_ALREADY_ACTIVE,
        'User account is already active',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!user.activationToken) {
      throw new AppException(
        ErrorCode.NO_ACTIVATION_TOKEN,
        'No activation token found for this user',
        HttpStatus.BAD_REQUEST,
      );
    }

    return user.activationToken;
  }

  async resetActivationToken(userId: number): Promise<string> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new AppException(ErrorCode.USER_NOT_FOUND, 'User not found', HttpStatus.NOT_FOUND);
    }
    if (user.status !== UserStatus.PENDING) {
      throw new AppException(
        ErrorCode.ACCOUNT_ALREADY_ACTIVE,
        'User account is already active, contact HR for assistance',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!user.activationToken) {
      throw new AppException(
        ErrorCode.NO_ACTIVATION_TOKEN,
        'No activation token found for this user',
        HttpStatus.BAD_REQUEST,
      );
    }
    const newToken = this.generateActivationToken();
    user.activationToken = newToken;
    await this.usersRepository.save(user);
    return newToken;
  }

  /**
   * Resend activation link - Generate new token and send email
   * HR only - with strict validation
   */
  async resendActivationLink(userId: number): Promise<{ message: string; activationLink: string }> {
    this.logger.log(`========== RESEND ACTIVATION LINK START ==========`);
    this.logger.log(`Attempting to resend activation link for user ID: ${userId}`);

    // 1. Check if user exists
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      this.logger.error(`❌ User not found with ID: ${userId}`);
      throw new AppException(ErrorCode.USER_NOT_FOUND, 'User not found', HttpStatus.NOT_FOUND);
    }

    this.logger.log(`✓ User found: ${user.email}`);
    this.logger.log(`   - Current Status: ${user.status}`);
    this.logger.log(`   - Current Activation Token: ${user.activationToken ? 'EXISTS' : 'NULL'}`);

    // 2. Check if user status is PENDING
    if (user.status !== UserStatus.PENDING) {
      this.logger.error(`❌ Cannot resend activation link. User status is: ${user.status}`);
      this.logger.log(`   - Only PENDING users can receive activation links`);
      this.logger.log(`   - Current user status: ${user.status}`);
      throw new AppException(
        ErrorCode.INVALID_INPUT,
        `Cannot resend activation link. User status is ${user.status}. Only pending users can receive activation links.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.log(`✓ User status is PENDING - eligible for activation link resend`);

    // 3. Generate new activation token
    const newActivationToken = this.generateActivationToken();
    this.logger.log(`✓ New activation token generated`);

    // 4. Update user with new token
    user.activationToken = newActivationToken;
    await this.usersRepository.save(user);
    this.logger.log(`✓ User updated with new activation token`);

    // 5. Generate activation link
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const activationLink = `${frontendUrl}/auth/activate?token=${newActivationToken}`;
    this.logger.log(`✓ Activation link generated: ${activationLink.substring(0, 50)}...`);

    // 6. Send activation email
    try {
      await this.notificationsService.enqueueActivationEmail(
        user.id,
        newActivationToken,
        activationLink,
      );
      this.logger.log(`✅ Activation email queued successfully for user: ${user.email}`);
    } catch (error) {
      this.logger.error(`❌ Failed to queue activation email: ${error.message}`);
      throw new AppException(
        ErrorCode.INTERNAL_SERVER_ERROR,
        'Failed to send activation email',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.logger.log(`========== RESEND ACTIVATION LINK SUCCESS ==========`);

    return {
      message: "Activation link has been sent to the user's email",
      activationLink,
    };
  }

  // =====================================================
  // IMPORT USERS FROM EXCEL
  // =====================================================

  /**
   * Parse Excel file and validate data
   */
}
