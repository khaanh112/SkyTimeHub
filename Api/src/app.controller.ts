import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '@modules/authentication/decorators/public.decorator';

@Controller('/')
export class AppController {

  @Get()
  @Public()
  @ApiOperation ({ summary: 'Get application status' })
  @ApiResponse({ status: 200, description: 'Application is running.' })
  getStatus(): string {
    return 'Application is running';
  }
}
