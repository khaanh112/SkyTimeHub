import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Department } from '@/entities/departments.entity';
import { User } from '@/entities/users.entity';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { AppException, ErrorCode } from '@/common';

@Injectable()
export class DepartmentService {
  constructor(
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly dataSource: DataSource,
  ) {}

  async createDepartment(createDepartmentDto: CreateDepartmentDto) {
    const { name, leaderId } = createDepartmentDto;

    const existingDepartment = await this.departmentRepository.findOne({ where: { name } });
    if (existingDepartment) {
      throw new AppException(
        ErrorCode.INVALID_INPUT,
        'Department with this name already exists',
        400,
      );
    }
    const department = this.departmentRepository.create({ name });

    if (leaderId) {
      const leader = await this.userRepository.findOne({ where: { id: leaderId } });
      if (!leader) {
        throw new AppException(
          ErrorCode.INVALID_INPUT,
          `Leader with ID ${leaderId} not found`,
          400,
        );
      }
      department.leader = leader;
    }

    return this.departmentRepository.save(department);
  }

  async getAllDepartments() {
    return this.departmentRepository.find({ relations: ['leader'] });
  }

  async getDepartmentById(id: string) {
    const department = await this.departmentRepository.findOne({
      where: { id: parseInt(id) },
      relations: ['leader'],
    });
    if (!department) {
      throw new AppException(ErrorCode.NOT_FOUND, `Department with ID ${id} not found`, 404);
    }
    return department;
  }

  async deleteDepartment(id: string) {
    const department = await this.departmentRepository.findOne({ where: { id: parseInt(id) } });
    if (!department) {
      throw new AppException(ErrorCode.NOT_FOUND, `Department with ID ${id} not found`, 404);
    }
    await this.departmentRepository.remove(department);
    return { message: 'Department deleted successfully' };
  }

  async updateDepartmentLeader(id: string, updateDepartmentDto: UpdateDepartmentDto) {
    const { leaderId } = updateDepartmentDto;

    return await this.dataSource.transaction(async (manager) => {
      const department = await manager.findOne(Department, { where: { id: parseInt(id) } });
      if (!department) {
        throw new AppException(ErrorCode.NOT_FOUND, `Department with ID ${id} not found`, 404);
      }

      if (leaderId) {
        const leader = await manager.findOne(User, { where: { id: leaderId } });
        if (!leader) {
          throw new AppException(
            ErrorCode.INVALID_INPUT,
            `Leader with ID ${leaderId} not found`,
            400,
          );
        }

        // Remove user from being leader of any other department
        const oldDepartment = await manager.findOne(Department, {
          where: { leaderId },
        });

        if (oldDepartment && oldDepartment.id !== parseInt(id)) {
          oldDepartment.leader = null;
          await manager.save(Department, oldDepartment);
        }

        department.leader = leader;
      } else {
        // If leaderId is explicitly null, remove the leader
        department.leader = null;
      }

      return manager.save(Department, department);
    });
  }

  async checkDepartmentHasLeader(id: string) {
    const department = await this.departmentRepository.findOne({
      where: { id: parseInt(id) },
      relations: ['leader'],
    });
    if (!department) {
      throw new AppException(ErrorCode.NOT_FOUND, `Department with ID ${id} not found`, 404);
    }
    return {
      hasLeader: !!department.leaderId,
      leaderId: department.leaderId,
      leaderName: department.leader?.username || null,
    };
  }
}
