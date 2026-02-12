import { Module } from '@nestjs/common';
import { DepartmentController } from './department.controller';
import { DepartmentService } from './department.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department } from '@/entities/departments.entity';
import { User } from '@/entities/users.entity';



@Module({
  imports: [ TypeOrmModule.forFeature([Department, User]) ],
  controllers: [DepartmentController],
  providers: [DepartmentService],
  exports: [DepartmentService],
})
export class DepartmentModule {}
