import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Request,
  Put,
  ParseIntPipe,
  ForbiddenException,
  Query,
  Logger,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { LeaveRequestsService } from './leave-requests.service';
import { LeaveBalanceService } from './leave-balance.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { ApproveLeaveRequestDto } from './dto/approve-leave-request.dto';
import { RejectLeaveRequestDto } from './dto/reject-leave-request.dto';
import { UpdateLeaveRequestDto } from './dto/update-leave-request.dto';
import { LeaveRequestDetailsDto } from './dto/leave-request-details.dto';
import { ListLeaveRequestsQueryDto } from './dto/list-leave-requests-query.dto';
import { LeaveRequestListResponseDto } from './dto/leave-request-list.dto';
import { Roles } from '../authorization';
import { BalanceSummaryQueryDto } from './dto/balance-summary-query.dto';

@ApiTags('Leave Requests')
@ApiBearerAuth()
@Controller('leave-requests')
export class LeaveRequestsController {
  private readonly logger = new Logger(LeaveRequestsController.name);

  constructor(
    private readonly leaveRequestsService: LeaveRequestsService,
    private readonly leaveBalanceService: LeaveBalanceService,
  ) {}

  @Post('suggest-end-date')
  @ApiOperation({
    summary: 'Suggest end date for auto-calculate leave types',
    description:
      'For POLICY and SOCIAL leave types with auto_calculate_end_date policy, returns a suggested end date based on start date and max days. Used by the frontend to pre-fill the form. The user can still modify the suggested values.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['leaveTypeId', 'startDate', 'startSession'],
      properties: {
        leaveTypeId: { type: 'number', example: 5 },
        startDate: { type: 'string', example: '2026-03-01' },
        startSession: { type: 'string', enum: ['AM', 'PM'], example: 'AM' },
        numberOfChildren: { type: 'number', example: 1, description: 'For parental leave' },
        childbirthMethod: { type: 'string', enum: ['natural', 'c_section'], description: 'For parental leave' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Suggested end date returned (or null if not applicable).' })
  async suggestEndDate(
    @Request() req,
    @Body() body: { leaveTypeId: number; startDate: string; startSession: string; numberOfChildren?: number; childbirthMethod?: string },
  ) {
    const result = await this.leaveBalanceService.suggestEndDate(
      body.leaveTypeId,
      body.startDate,
      body.startSession as any,
      {
        employeeId: req.user.id,
        numberOfChildren: body.numberOfChildren,
        childbirthMethod: body.childbirthMethod as any,
      },
    );
    return result ?? { suggestedEndDate: null, suggestedEndSession: null };
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new leave request',
    description:
      'Submit a new leave request. Notifications will be sent to approver, HR, and CC recipients.',
  })
  @ApiBody({ type: CreateLeaveRequestDto })
  @ApiResponse({ status: 201, description: 'Leave request created successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid input data or no approver assigned.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async create(@Request() req, @Body() createDto: CreateLeaveRequestDto) {
    console.log(
      '[LeaveRequestsController] create called for user:',
      req.user?.id,
      'with data:',
      createDto,
    );
    try {
      const result = await this.leaveRequestsService.createLeaveRequest(req.user.id, createDto);
      console.log('[LeaveRequestsController] create result:', result?.id);
      return result;
    } catch (error) {
      console.error('[LeaveRequestsController] create error:', error);
      throw error;
    }
  }

  @Get()
  @ApiOperation({
    summary: 'List leave requests (personal or management view)',
    description:
      'Returns a paginated, filtered list of leave requests. ' +
      'view=personal returns the authenticated user\'s own requests. ' +
      'view=management returns team/all requests (requires HR, Admin, Dept Leader, or Approver role).',
  })
  @ApiResponse({ status: 200, description: 'Paginated leave request list.', type: LeaveRequestListResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Not authorized for management view.' })
  async findAll(
    @Request() req,
    @Query() query: ListLeaveRequestsQueryDto,
  ): Promise<LeaveRequestListResponseDto> {
    this.logger.log(`[findAll] userId=${req.user?.id} role=${req.user?.role} query=${JSON.stringify(query)}`);
    try {
      const result = await this.leaveRequestsService.findLeaveRequests(
        { id: req.user.id, role: req.user.role },
        query,
      );
      this.logger.log(`[findAll] OK – returned ${result?.data?.length ?? 0} items (total=${result?.page?.total})`);
      return result;
    } catch (error) {
      this.logger.error(`[findAll] ERROR userId=${req.user?.id}`, error?.stack ?? error);
      throw error;
    }
  }

  @Get('leave-types')
  @ApiOperation({
    summary: 'Get available leave types grouped by category',
    description: 'Returns all active, non-system leave types with their category info. Used by create/edit forms.',
  })
  @ApiResponse({ status: 200, description: 'Leave types retrieved successfully.' })
  async getLeaveTypes() {
    return this.leaveRequestsService.getLeaveTypes();
  }

  @Get('balance-summary')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get leave balance summary for current user',
    description:
      'Returns credit, debit and remaining balance for each leave type. If month is provided, returns balance up to that month (monthly accrual cap applied).',
  })
  @ApiResponse({ status: 200, description: 'Balance summary retrieved successfully.' })
  async getBalanceSummary(@Request() req, @Query() q: BalanceSummaryQueryDto) {
    const year = q.year ?? new Date().getFullYear();
    const month = q.month ?? new Date().getMonth() + 1;

    return this.leaveBalanceService.getEmployeeBalanceSummary(req.user.id, month, year);
  }

  //sai logic
  @Get('balance-summary/:userId')
  @ApiOperation({
    summary: 'Get leave balance summary for a specific user (HR/Approver only)',
    description: 'Returns credit, debit and remaining balance for each leave type for a specific employee. Used in management view.',
  })
  @ApiParam({ name: 'userId', description: 'Target user ID', type: 'number' })
  @ApiResponse({ status: 200, description: 'Balance summary retrieved successfully.' })
  @ApiResponse({ status: 403, description: 'Not authorized to view this user balance.' })
  async getUserBalanceSummary(
    @Request() req,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    // Only HR or the user's approver can view balance
    if (req.user.role !== 'hr' && req.user.role !== 'admin') {
      // Check if current user is an approver - allow any approver/manager to view
      if (req.user.role !== 'manager') {
        throw new ForbiddenException('Not authorized to view this user balance');
      }
    }
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();
    return this.leaveBalanceService.getEmployeeBalanceSummary(userId, month, year);
  }

  // thủ công chưa cronjob
  @Post('admin/initialize-balance')
  @ApiOperation({
    summary: 'Initialize yearly paid leave balance for all active employees (HR only)',
    description: 'Creates ACCRUAL CREDIT transactions for all active employees who do not yet have one for the specified year. Default: 12 days/year.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        year: { type: 'number', example: 2026, description: 'Year to initialize' },
        annualDays: { type: 'number', example: 12, description: 'Annual paid leave days (default: 12)' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Balance initialized.' })
  @ApiResponse({ status: 403, description: 'Only HR can perform this action.' })
  async initializeBalance(
    @Request() req,
    @Body() body: { year?: number; annualDays?: number },
  ) {
    if (req.user.role !== 'hr') {
      throw new ForbiddenException('Only HR can initialize balances');
    }
    const year = body.year || new Date().getFullYear();
    const annualDays = body.annualDays || 12;
    return this.leaveBalanceService.initializeYearlyBalance(year, annualDays);
  }


  @Get(':id')
  @ApiOperation({
    summary: 'Get leave request by ID',
    description: 'Retrieve detailed information about a specific leave request.',
  })
  @ApiParam({ name: 'id', description: 'Leave request ID', type: 'number' })
  @ApiResponse({ status: 200, description: 'Leave request retrieved successfully.', type: LeaveRequestDetailsDto })
  @ApiResponse({ status: 404, description: 'Leave request not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<LeaveRequestDetailsDto> {
    this.logger.log(`[findOne] id=${id}`);
    try {
      const result = await this.leaveRequestsService.findOne(id);
      this.logger.log(`[findOne] OK – id=${id}`);
      return result;
    } catch (error) {
      this.logger.error(`[findOne] ERROR id=${id}`, error?.stack ?? error);
      throw error;
    }
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update my leave request',
    description:
      'Update a pending leave request. Only the requester can update their own pending requests. Requires version number for optimistic locking to prevent concurrent updates.',
  })
  @ApiParam({ name: 'id', description: 'Leave request ID', type: 'number' })
  @ApiBody({ type: UpdateLeaveRequestDto })
  @ApiResponse({ status: 200, description: 'Leave request updated successfully.' })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or request cannot be updated (not pending).',
  })
  @ApiResponse({
    status: 404,
    description: 'Leave request not found or you do not have permission.',
  })
  @ApiResponse({
    status: 409,
    description: 'Version conflict - the request has been modified. Please refresh and try again.',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateLeaveRequestDto,
    @Request() req,
  ) {
    console.log(
      '[LeaveRequestsController] update called for request:',
      id,
      'by user:',
      req.user?.id,
      'with data:',
      updateDto,
    );
    try {
      const result = await this.leaveRequestsService.updateLeaveRequest(id, req.user.id, updateDto);
      return result;
    } catch (error) {
      console.error('[LeaveRequestsController] update error:', error.message);
      throw error;
    }
  }

  @Patch(':id/approve')
  @ApiOperation({
    summary: 'Approve a leave request',
    description:
      'Approve a pending leave request. Only the assigned approver can approve. Requires version number for optimistic locking to ensure the request has not been modified since last viewed.',
  })
  @ApiParam({ name: 'id', description: 'Leave request ID', type: 'number' })
  @ApiBody({ type: ApproveLeaveRequestDto })
  @ApiResponse({ status: 200, description: 'Leave request approved successfully.' })
  @ApiResponse({ status: 400, description: 'Request cannot be approved (invalid status).' })
  @ApiResponse({ status: 403, description: 'Not authorized to approve this request.' })
  @ApiResponse({ status: 404, description: 'Leave request not found.' })
  @ApiResponse({
    status: 409,
    description:
      'Version conflict - the request has been modified. Please refresh and review before approving.',
  })
  async approve(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Body() dto: ApproveLeaveRequestDto,
  ) {
    return this.leaveRequestsService.approveLeaveRequest(id, req.user.id, dto.version);
  }

  @Patch(':id/reject')
  @ApiOperation({
    summary: 'Reject a leave request',
    description:
      'Reject a pending leave request. Only the assigned approver can reject. Requires version number for optimistic locking to ensure the request has not been modified since last viewed.',
  })
  @ApiParam({ name: 'id', description: 'Leave request ID', type: 'number' })
  @ApiResponse({ status: 200, description: 'Leave request rejected successfully.' })
  @ApiResponse({ status: 400, description: 'Request cannot be rejected (invalid status).' })
  @ApiResponse({ status: 403, description: 'Not authorized to reject this request.' })
  @ApiResponse({ status: 404, description: 'Leave request not found.' })
  @ApiResponse({
    status: 409,
    description:
      'Version conflict - the request has been modified. Please refresh and review before rejecting.',
  })
  async reject(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Body() dto: RejectLeaveRequestDto,
  ) {
    return this.leaveRequestsService.rejectLeaveRequest(
      id,
      req.user.id,
      dto.rejectedReason,
      dto.version,
    );
  }

  @Patch(':id/cancel')
  @ApiOperation({
    summary: 'Cancel a leave request',
    description: 'Cancel your own pending leave request. Only the requester can cancel.',
  })
  @ApiParam({ name: 'id', description: 'Leave request ID', type: 'number' })
  @ApiResponse({ status: 200, description: 'Leave request cancelled successfully.' })
  @ApiResponse({ status: 400, description: 'Request cannot be cancelled (invalid status).' })
  @ApiResponse({ status: 403, description: 'Not authorized to cancel this request.' })
  @ApiResponse({ status: 404, description: 'Leave request not found.' })
  async cancel(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.leaveRequestsService.cancelLeaveRequest(id, req.user.id);
  }

  // ── Attachments ──────────────────────────────────────────────

  @Post('attachments/upload')
  @ApiOperation({
    summary: 'Upload a PDF attachment (Social leave proof)',
    description: 'Uploads a PDF file to MinIO and returns an attachmentId. Pass this ID when creating a Social leave request. Only PDF, max 10 MB, 1 file.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid file type or size.' })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadAttachment(
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    return this.leaveRequestsService.uploadAttachment(req.user.id, file);
  }

  @Get('attachments/:attachmentId/url')
  @ApiOperation({
    summary: 'Get a presigned download URL for an attachment',
    description: 'Returns a short-lived presigned URL (1 hour) for viewing or downloading the PDF attachment.',
  })
  @ApiParam({ name: 'attachmentId', type: 'number' })
  @ApiResponse({ status: 200, description: 'Presigned URL returned.' })
  @ApiResponse({ status: 403, description: 'Access denied.' })
  @ApiResponse({ status: 404, description: 'Attachment not found.' })
  async getAttachmentUrl(
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @Request() req,
  ) {
    return this.leaveRequestsService.getAttachmentUrl(attachmentId, req.user.id, req.user.role);
  }
}

