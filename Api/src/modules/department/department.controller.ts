import {Delete, Put, Param, Get, Post, Body, Controller} from '@nestjs/common';
import {DepartmentService} from './department.service';
import {CreateDepartmentDto} from './dto/create-department.dto';
import {UpdateDepartmentDto} from './dto/update-department.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../authorization/decorators/roles.decorator';
import { UserRole } from '@/common/enums/roles.enum';


@ApiBearerAuth()
@Controller('department')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Roles(UserRole.ADMIN)
  @Post()
  createDepartment(@Body() createDepartmentDto: CreateDepartmentDto) {
    return this.departmentService.createDepartment(createDepartmentDto);
  }

  @Get()
  getAllDepartments() {
    return this.departmentService.getAllDepartments();
  }

  @Get(':id')
  getDepartmentById(@Param('id') id: string) {
    return this.departmentService.getDepartmentById(id);
  }

  @Get(':id/has-leader')
  checkDepartmentHasLeader(@Param('id') id: string) {
    return this.departmentService.checkDepartmentHasLeader(id);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  deleteDepartment(@Param('id') id: string) {
    return this.departmentService.deleteDepartment(id);
  }

  @Put(':id')
  updateDepartment(@Param('id') id: string, @Body() updateDepartmentDto: UpdateDepartmentDto) {
    return this.departmentService.updateDepartmentLeader(id, updateDepartmentDto);
  }

}