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
import { generateEmployeeId, generateActivationToken } from '@/modules/users/utils/user.utils';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private notificationsService: NotificationsService,
  ) {}

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

    // Auto-generate employeeId if not provided
    let employeeId = user.employeeId?.trim() || '';
    if (!employeeId) {
      employeeId = await generateEmployeeId(this.usersRepository);
    } else {
      // Check if employeeId already exists (only when user provides one)
      const existingEmployee = await this.usersRepository.findOne({
        where: { employeeId },
      });
      if (existingEmployee) {
        throw new AppException(
          ErrorCode.EMPLOYEE_ID_ALREADY_EXISTS,
          'User with this employee ID already exists',
          HttpStatus.CONFLICT,
        );
      }
    }

    // Generate activation token for pending users
    const activationToken = generateActivationToken();

    // Set default status to PENDING
    const userData = {
      ...user,
      employeeId,
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
      throw new AppException(
        ErrorCode.INVALID_ACTIVATION_TOKEN,
        'Invalid activation token',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Check if user status is PENDING before allowing activation
    if (user.status !== UserStatus.PENDING) {
      this.logger.error(`❌ Cannot activate account with status: ${user.status}`);
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
    this.logger.log(`   - Activated At: ${savedUser.activatedAt}`);
    return savedUser;
  }

  async deactivateAccount(userId: number): Promise<User> {
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
   * Resend activation email by email address (self-service)
   * Rate limited: 5 minutes between requests
   */
  async resendActivationEmailByEmail(email: string): Promise<{ message: string }> {
    this.logger.log(`Resend activation email requested for: ${email}`);

    // 1. Find user by email
    const user = await this.usersRepository.findOne({ where: { email } });
    if (!user) {
      // Return generic message to avoid email enumeration
      return { message: 'If the email exists and account is pending, an activation email will be sent.' };
    }

    // 2. Check PENDING status
    if (user.status !== UserStatus.PENDING) {
      return { message: 'If the email exists and account is pending, an activation email will be sent.' };
    }

    // 3. Rate limit: check last activation email sent within 5 minutes
    const lastSentAt = await this.notificationsService.getLastActivationEmailTime(user.id);
    if (lastSentAt) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (lastSentAt > fiveMinutesAgo) {
        const waitSeconds = Math.ceil((lastSentAt.getTime() + 5 * 60 * 1000 - Date.now()) / 1000);
        throw new AppException(
          ErrorCode.RESEND_RATE_LIMITED,
          `Vui lòng đợi ${waitSeconds} giây trước khi gửi lại email kích hoạt.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // 4. Generate new activation token
    const newActivationToken = generateActivationToken();
    user.activationToken = newActivationToken;
    await this.usersRepository.save(user);

    // 5. Send activation email
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const activationLink = `${frontendUrl}/auth/activate?token=${newActivationToken}`;

    await this.notificationsService.enqueueActivationEmail(
      user.id,
      newActivationToken,
      activationLink,
    );

    this.logger.log(`Activation email resent for user: ${user.email}`);
    return { message: 'Email kích hoạt đã được gửi. Vui lòng kiểm tra hộp thư.' };
  }

  // =====================================================
  // IMPORT USERS FROM EXCEL
  // =====================================================

  /**
   * Parse Excel file and validate data
   */
}
