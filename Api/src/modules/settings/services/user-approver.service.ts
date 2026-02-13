import { UserApprover } from '@/entities/user_approver.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '@/entities/users.entity';
import { UserApproverDto } from '../dto/user-approver.dto';
import { AppException } from '@/common';
import { ErrorCode } from '@/common/enums/errror-code.enum';
import { Logger } from '@nestjs/common';

@Injectable()
export class UserApproverService {
  private readonly logger = new Logger(UserApproverService.name);

  constructor(
    @InjectRepository(UserApprover)
    private readonly userApproverRepository: Repository<UserApprover>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async getApproversForUser(userId: number): Promise<User[]> {
    this.logger.log(`Fetching approvers for user ID: ${userId}`);

    const userApprovers = await this.userApproverRepository.find({
      where: { userId, active: true },
      relations: ['approver'],
    });
    return userApprovers.map((ua) => ua.approver);
  }

  async setApproverForUser(userId: number, dto: UserApproverDto): Promise<UserApprover> {
    this.logger.log(`Setting approver for user ID: ${userId} to approver ID: ${dto.approverId}`);
    this.logger.debug(`Input DTO: ${JSON.stringify(dto)}`);

    if (dto.approverId === userId) {
      throw new AppException(ErrorCode.INVALID_INPUT, 'A user cannot be their own approver.', 400);
    }

    // (optional) ensure user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new AppException(ErrorCode.USER_NOT_FOUND, 'User not found.', 404);
    }

    const approver = await this.userRepository.findOne({
      where: { id: dto.approverId },
    });
    if (!approver) {
      throw new AppException(ErrorCode.USER_NOT_FOUND, 'Approver user not found.', 404);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Deactivate all currently active approvers for this user
      await queryRunner.manager.update(UserApprover, { userId, active: true }, { active: false });

      // Check if a record with this approverId already exists (active or inactive)
      let userApprover = await queryRunner.manager.findOne(UserApprover, {
        where: { userId, approverId: dto.approverId },
      });

      if (userApprover) {
        // Reuse existing record - just reactivate it
        this.logger.debug(`Reusing existing user_approver record ID: ${userApprover.id}`);
        userApprover.active = true;
        userApprover.createdBy = dto.createdBy;
        await queryRunner.manager.save(UserApprover, userApprover);
      } else {
        // Create new record only if it doesn't exist
        this.logger.debug('Creating new user_approver record');
        userApprover = queryRunner.manager.create(UserApprover, {
          userId,
          approverId: dto.approverId,
          createdBy: dto.createdBy,
          active: true,
        });
        await queryRunner.manager.save(UserApprover, userApprover);
      }

      await queryRunner.commitTransaction();
      return userApprover;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to set approver for user ID: ${userId}`,
        error?.stack ?? String(error),
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
