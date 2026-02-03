import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from '@entities/users.entity';
import { ExcelService } from '@modules/import/excel.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService, ExcelService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
