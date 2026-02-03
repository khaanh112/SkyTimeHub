import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from '../entity/users.entity';
import { ExcelService } from '../import/excel.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService, ExcelService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
