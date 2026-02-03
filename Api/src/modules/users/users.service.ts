import { Injectable, HttpStatus } from '@nestjs/common';
import { User } from '@entities/users.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserStatus } from '@common/enums/user-status.enum';
import { AppException } from '@common/exceptions/app.exception';
import { ErrorCode } from '@common/enums/errror-code.enum';

import * as crypto from 'crypto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
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
      throw new AppException(
        ErrorCode.USER_NOT_FOUND,
        'User not found',
        HttpStatus.NOT_FOUND,
      );
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
    // Check if email already exists
    const existingUser = await this.usersRepository.findOne({ where: { email: user.email } });
    if (existingUser) {
      throw new AppException(
        ErrorCode.EMAIL_ALREADY_EXISTS,
        'User with this email already exists',
        HttpStatus.CONFLICT,
      );
    }

    // Check if employeeId already exists (if provided)
    if (user.employeeId) {
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
    }

    // Generate employee ID if not provided
    if (!user.employeeId) {
      user.employeeId = await this.generateEmployeeId();
    }

    // Generate activation token for inactive users
    const activationToken = this.generateActivationToken();

    const newUser = this.usersRepository.create({
      ...user,
      activationToken,
    });

    return await this.usersRepository.save(newUser);
  }

  async updateUser(id: number, user: UpdateUserDto): Promise<User> {
    const existingUser = await this.usersRepository.findOne({ where: { id } });
    if (!existingUser) {
      throw new AppException(
        ErrorCode.USER_NOT_FOUND,
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }

    // Check if email is being updated and already exists
    if (user.email && user.email !== existingUser.email) {
      const emailExists = await this.usersRepository.findOne({ where: { email: user.email } });
      if (emailExists) {
        throw new AppException(
          ErrorCode.EMAIL_ALREADY_EXISTS,
          'User with this email already exists',
          HttpStatus.CONFLICT,
        );
      }
    }

    // Check if employeeId is being updated and already exists
    if (user.employeeId && user.employeeId !== existingUser.employeeId) {
      const employeeIdExists = await this.usersRepository.findOne({
        where: { employeeId: user.employeeId },
      });
      if (employeeIdExists) {
        throw new AppException(
          ErrorCode.EMPLOYEE_ID_ALREADY_EXISTS,
          'User with this employee ID already exists',
          HttpStatus.CONFLICT,
        );
      }
    }

    const updatedUser = this.usersRepository.merge(existingUser, user);
    return await this.usersRepository.save(updatedUser);
  }

  async updateRefreshToken(userId: number, refreshTokenHash: string | null): Promise<void> {
    if (!userId) {
      throw new AppException(
        ErrorCode.USER_ID_REQUIRED,
        'User ID is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new AppException(
        ErrorCode.USER_NOT_FOUND,
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.usersRepository.update({ id: userId }, { refreshTokenHash });
  }

  async deleteUser(id: number): Promise<void> {
    const existingUser = await this.usersRepository.findOne({ where: { id } });
    if (!existingUser) {
      throw new AppException(
        ErrorCode.USER_NOT_FOUND,
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }
    await this.usersRepository.delete(id);
  }

  /**
   * Activate user account with token
   */
  async activateAccount(token: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { activationToken: token },
    });

    if (!user) {
      throw new AppException(
        ErrorCode.INVALID_ACTIVATION_TOKEN,
        'Invalid activation token',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Update user status and clear activation token
    user.status = UserStatus.ACTIVE;
    user.activatedAt = new Date();
    user.activationToken = null;

    return await this.usersRepository.save(user);
  }

  /**
   * Resend activation email (regenerate token)
   */
  async resendActivation(userId: number): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new AppException(
        ErrorCode.USER_NOT_FOUND,
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (user.status === UserStatus.ACTIVE) {
      throw new AppException(
        ErrorCode.ACCOUNT_ALREADY_ACTIVE,
        'User account is already active',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Generate new activation token
    user.activationToken = this.generateActivationToken();

    return await this.usersRepository.save(user);
  }

  /**
   * Get activation token for user (for HR to send activation link)
   */
  async getActivationToken(userId: number): Promise<string> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new AppException(
        ErrorCode.USER_NOT_FOUND,
        'User not found',
        HttpStatus.NOT_FOUND,
      );
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

  // =====================================================
  // IMPORT USERS FROM EXCEL
  // =====================================================

  /**
   * Parse Excel file and validate data
   */
}
