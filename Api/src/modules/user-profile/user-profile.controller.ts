import {
  Controller,
  Post,
  Put,
  Param,
  Body,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from '@entities/users.entity';
import { UserRole } from '@common/enums/roles.enum';
import { Roles } from '@modules/authorization/decorators/roles.decorator';
import { UserProfileService } from './user-profile.service';
import { CreateUserProfileDto } from './dto/create-user-profile.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';

@ApiTags('User Profile')
@Controller('user-profile')
export class UserProfileController {
  constructor(private readonly userProfileService: UserProfileService) {}

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
