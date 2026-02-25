import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '@entities/users.entity';
import { UserApprover } from '@entities/user_approver.entity';
import { Department } from '@entities/departments.entity';
import { UserStatus } from '@common/enums/user-status.enum';
import { AppException } from '@common/exceptions/app.exception';
import { ErrorCode } from '@common/enums/errror-code.enum';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { generateActivationToken, generateEmployeeId } from '@modules/users/utils/user.utils';
import { CreateUserProfileDto } from './dto/create-user-profile.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';

@Injectable()
export class UserProfileService {
  private readonly logger = new Logger(UserProfileService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(UserApprover)
    private readonly userApproverRepository: Repository<UserApprover>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Create a new user with approver and department leader assignment — all in one transaction.
   */
  async createUserProfile(dto: CreateUserProfileDto): Promise<User> {
    const { approverId, isDepartmentLeader, ...userData } = dto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Validate uniqueness
      const existingEmail = await queryRunner.manager.findOne(User, {
        where: { email: userData.email },
      });
      if (existingEmail) {
        throw new AppException(
          ErrorCode.EMAIL_ALREADY_EXISTS,
          'User with this email already exists',
          HttpStatus.CONFLICT,
        );
      }

      // Auto-generate employeeId if not provided
      let employeeId = userData.employeeId?.trim() || '';
      if (!employeeId) {
        employeeId = await generateEmployeeId(this.usersRepository);
      } else {
        const existingEmployeeId = await queryRunner.manager.findOne(User, {
          where: { employeeId },
        });
        if (existingEmployeeId) {
          throw new AppException(
            ErrorCode.EMPLOYEE_ID_ALREADY_EXISTS,
            'User with this employee ID already exists',
            HttpStatus.CONFLICT,
          );
        }
      }

      // 2. Create user
      const activationToken = generateActivationToken();
      const newUser = queryRunner.manager.create(User, {
        ...userData,
        employeeId,
        status: UserStatus.PENDING,
        activationToken,
      });
      const savedUser = await queryRunner.manager.save(User, newUser);

      // 3. Set department leader if requested
      if (isDepartmentLeader && savedUser.departmentId) {
        const department = await queryRunner.manager.findOne(Department, {
          where: { id: savedUser.departmentId },
        });
        if (!department) {
          throw new AppException(
            ErrorCode.NOT_FOUND,
            `Department with ID ${savedUser.departmentId} not found`,
            HttpStatus.BAD_REQUEST,
          );
        }
        if (department.leaderId && department.leaderId !== savedUser.id) {
          throw new AppException(
            ErrorCode.INVALID_INPUT,
            'This department already has a leader',
            HttpStatus.BAD_REQUEST,
          );
        }
        department.leader = savedUser;
        await queryRunner.manager.save(Department, department);
      }

      // 4. Set approver if provided
      if (approverId) {
        if (approverId === savedUser.id) {
          throw new AppException(
            ErrorCode.INVALID_INPUT,
            'A user cannot be their own approver',
            HttpStatus.BAD_REQUEST,
          );
        }

        const approver = await queryRunner.manager.findOne(User, {
          where: { id: approverId },
        });
        if (!approver) {
          throw new AppException(
            ErrorCode.USER_NOT_FOUND,
            'Approver user not found',
            HttpStatus.BAD_REQUEST,
          );
        }

        const userApprover = queryRunner.manager.create(UserApprover, {
          userId: savedUser.id,
          approverId,
          active: true,
        });
        await queryRunner.manager.save(UserApprover, userApprover);
      }

      await queryRunner.commitTransaction();

      // 5. Queue activation email (outside transaction — non-critical)
      try {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const activationLink = `${frontendUrl}/auth/activate?token=${activationToken}`;
        await this.notificationsService.enqueueActivationEmail(
          savedUser.id,
          activationToken,
          activationLink,
        );
        this.logger.log(
          `User created: ${savedUser.email}, activation email queued`,
        );
      } catch (emailError) {
        this.logger.warn(
          `User created but failed to queue activation email: ${emailError.message}`,
        );
      }

      return savedUser;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof AppException) throw error;
      this.logger.error('Error creating user profile:', error);
      throw new AppException(
        ErrorCode.INTERNAL_SERVER_ERROR,
        `Failed to create user profile: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Update user along with approver and department leader — all in one transaction.
   */
  async updateUserProfile(userId: number, dto: UpdateUserProfileDto): Promise<User> {
    const { approverId, isDepartmentLeader, ...userData } = dto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Fetch existing user
      const existingUser = await queryRunner.manager.findOne(User, {
        where: { id: userId },
      });
      if (!existingUser) {
        throw new AppException(
          ErrorCode.USER_NOT_FOUND,
          'User not found',
          HttpStatus.NOT_FOUND,
        );
      }

      const oldDepartmentId = existingUser.departmentId;

      // 2. Update user fields
      const updatedUser = queryRunner.manager.merge(User, existingUser, userData);
      const savedUser = await queryRunner.manager.save(User, updatedUser);

      // 3. Handle department leader logic
      if (isDepartmentLeader !== undefined && savedUser.departmentId) {
        const department = await queryRunner.manager.findOne(Department, {
          where: { id: savedUser.departmentId },
        });

        if (!department) {
          throw new AppException(
            ErrorCode.NOT_FOUND,
            `Department with ID ${savedUser.departmentId} not found`,
            HttpStatus.BAD_REQUEST,
          );
        }

        if (isDepartmentLeader) {
          // Set as leader — ensure department doesn't already have a different leader
          if (department.leaderId && department.leaderId !== savedUser.id) {
            throw new AppException(
              ErrorCode.INVALID_INPUT,
              'This department already has a leader',
              HttpStatus.BAD_REQUEST,
            );
          }
          department.leaderId = savedUser.id;
          await queryRunner.manager.save(Department, department);
        } else {
          // Remove as leader if they were the current leader of this department
          if (department.leaderId === savedUser.id) {
            department.leaderId = null;
            await queryRunner.manager.save(Department, department);
          }
        }
      }

      // If user changed departments, remove them as leader of the old department
      if (
        oldDepartmentId &&
        oldDepartmentId !== savedUser.departmentId
      ) {
        const oldDepartment = await queryRunner.manager.findOne(Department, {
          where: { id: oldDepartmentId },
        });
        if (oldDepartment && oldDepartment.leaderId === savedUser.id) {
          oldDepartment.leaderId = null;
          await queryRunner.manager.save(Department, oldDepartment);
        }
      }

      // 4. Handle approver update
      if (approverId !== undefined) {
        if (approverId !== null) {
          if (approverId === savedUser.id) {
            throw new AppException(
              ErrorCode.INVALID_INPUT,
              'A user cannot be their own approver',
              HttpStatus.BAD_REQUEST,
            );
          }

          const approver = await queryRunner.manager.findOne(User, {
            where: { id: approverId },
          });
          if (!approver) {
            throw new AppException(
              ErrorCode.USER_NOT_FOUND,
              'Approver user not found',
              HttpStatus.BAD_REQUEST,
            );
          }

          // Deactivate existing approvers
          await queryRunner.manager.update(
            UserApprover,
            { userId: savedUser.id, active: true },
            { active: false },
          );

          // Reuse or create approver record
          let userApprover = await queryRunner.manager.findOne(UserApprover, {
            where: { userId: savedUser.id, approverId },
          });

          if (userApprover) {
            userApprover.active = true;
            await queryRunner.manager.save(UserApprover, userApprover);
          } else {
            userApprover = queryRunner.manager.create(UserApprover, {
              userId: savedUser.id,
              approverId,
              active: true,
            });
            await queryRunner.manager.save(UserApprover, userApprover);
          }
        }
      }

      await queryRunner.commitTransaction();
      return savedUser;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof AppException) throw error;
      this.logger.error('Error updating user profile:', error);
      throw new AppException(
        ErrorCode.INTERNAL_SERVER_ERROR,
        `Failed to update user profile: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      await queryRunner.release();
    }
  }
}
