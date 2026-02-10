import { Controller, Get, Put, Param, Body } from '@nestjs/common';
import { UserApproverService } from '../services/user-approver.service';
import { UserApproverDto } from '../dto/user-approver.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserRole } from '@/common';
import { Roles } from '@/modules/authorization/decorators/roles.decorator';

@ApiBearerAuth()
@Controller('settings/approver-config')
export class UserApproverController {
  constructor(private readonly userApproverService: UserApproverService) {}

  @ApiOperation({ summary: 'Get approvers for a user' })
  @ApiResponse({ status: 200, description: 'List of approvers retrieved successfully.' })
  @Get(':id/approvers')
  async getApproversForUser(@Param('id') id: number) {
    return this.userApproverService.getApproversForUser(id);
  }

  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Set approver for a user' })
  @ApiResponse({ status: 200, description: 'Approver set successfully.' })
  @Put(':id/approver')
  async setApproverForUser(@Param('id') id: number, @Body() dto: UserApproverDto) {
    return this.userApproverService.setApproverForUser(id, dto);
  }
}
