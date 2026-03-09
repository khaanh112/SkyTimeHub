import { Controller, Get, Put, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '@/modules/authorization/decorators/roles.decorator';
import { UserRole } from '@/common';
import { PolicySettingsService } from '../services/policy-settings.service';
import { OtPolicyDto, OtPolicyResponseDto } from '../dto/ot-policy.dto';
import { LeavePolicyDto, LeavePolicyResponseDto } from '../dto/leave-policy.dto';

@ApiBearerAuth()
@ApiTags('Settings')
@Controller('settings')
export class PolicySettingsController {
  constructor(private readonly policySettingsService: PolicySettingsService) {}

  // ── OT Policy ──────────────────────────────────────────────

  @ApiOperation({ summary: 'Get OT policy settings' })
  @ApiResponse({ status: 200, type: OtPolicyResponseDto })
  @Get('ot-policy')
  async getOtPolicy(): Promise<OtPolicyResponseDto> {
    return this.policySettingsService.getOtPolicy();
  }

  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Save OT policy settings (admin only)' })
  @ApiResponse({ status: 200, type: OtPolicyResponseDto })
  @Put('ot-policy')
  async saveOtPolicy(@Body() dto: OtPolicyDto): Promise<OtPolicyResponseDto> {
    return this.policySettingsService.saveOtPolicy(dto);
  }

  // ── Leave Policy ───────────────────────────────────────────

  @ApiOperation({ summary: 'Get leave policy settings' })
  @ApiResponse({ status: 200, type: LeavePolicyResponseDto })
  @Get('leave-policy')
  async getLeavePolicy(): Promise<LeavePolicyResponseDto> {
    return this.policySettingsService.getLeavePolicy();
  }

  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Save leave policy settings (admin only)' })
  @ApiResponse({ status: 200, type: LeavePolicyResponseDto })
  @Put('leave-policy')
  async saveLeavePolicy(@Body() dto: LeavePolicyDto): Promise<LeavePolicyResponseDto> {
    return this.policySettingsService.saveLeavePolicy(dto);
  }
}
