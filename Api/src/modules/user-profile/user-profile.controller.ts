import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from '@entities/users.entity';
import { UserRole } from '@/common/enums/roles.enum';
import { Roles } from '@modules/authorization/decorators/roles.decorator';
import { CurrentUser } from '@modules/authentication/decorators/current-user.decorator';
import { UserProfileService } from './user-profile.service';
import { CreateUserProfileDto } from './dto/create-user-profile.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UserViewProfileDto } from './dto/user-view-profile.dto';

@ApiTags('User Profile')
@Controller('user-profile')
export class UserProfileController {
  constructor(private readonly userProfileService: UserProfileService) {}

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Returns the full profile of the currently authenticated user, including department name and approver name.',
  })
  @ApiResponse({ status: 200, description: 'User profile retrieved successfully.', type: UserViewProfileDto })
  async getMyProfile(@CurrentUser('id') userId: number): Promise<UserViewProfileDto> {
    return this.userProfileService.getUserProfile(userId);
  }

  @Roles(UserRole.HR)
  @Post()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create user with approver & department leader (atomic)',
    description:
      'Creates a user, optionally sets their approver and department leader — all within a single database transaction.',
  })
  @ApiResponse({ status: 201, description: 'User profile created successfully.' })
  async createUserProfile(@Body() dto: CreateUserProfileDto): Promise<User> {
    return this.userProfileService.createUserProfile(dto);
  }

  @Roles(UserRole.HR)
  @Put(':id')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update user with approver & department leader (atomic)',
    description:
      'Updates a user, optionally updates their approver and department leader — all within a single database transaction.',
  })
  @ApiResponse({ status: 200, description: 'User profile updated successfully.' })
  async updateUserProfile(
    @Param('id') id: number,
    @Body() dto: UpdateUserProfileDto,
  ): Promise<User> {
    return this.userProfileService.updateUserProfile(id, dto);
  }
}
