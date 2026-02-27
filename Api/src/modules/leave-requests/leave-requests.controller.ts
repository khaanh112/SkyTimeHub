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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { LeaveRequestsService } from './leave-requests.service';
import { LeaveBalanceService } from './leave-balance.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { ApproveLeaveRequestDto } from './dto/approve-leave-request.dto';
import { RejectLeaveRequestDto } from './dto/reject-leave-request.dto';
import { UpdateLeaveRequestDto } from './dto/update-leave-request.dto';

@ApiTags('Leave Requests')
@ApiBearerAuth()
@Controller('leave-requests')
export class LeaveRequestsController {
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
    summary: 'Get all leave requests for current user',
    description: 'Retrieve all leave requests created by the authenticated user.',
  })
  @ApiResponse({ status: 200, description: 'List of leave requests retrieved successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async findAll(@Request() req) {
    console.log('[LeaveRequestsController] findAll called for user:', req.user?.id);
    try {
      const result = await this.leaveRequestsService.findUserLeaveRequests(req.user.id);
      console.log('[LeaveRequestsController] findAll result count:', result?.length);

      // Transform each request to include ccUserIds from notificationRecipients
      const transformedResult = result.map((request) => {
        const ccUserIds =
          request.notificationRecipients?.filter((r) => r.type === 'CC').map((r) => r.userId) || [];
        return {
          ...request,
          ccUserIds,
        };
      });

      return transformedResult;
    } catch (error) {
      console.error('[LeaveRequestsController] findAll error:', error);
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
  @ApiOperation({
    summary: 'Get leave balance summary for current user',
    description: 'Returns credit, debit and remaining balance for each leave type in the current year.',
  })
  @ApiResponse({ status: 200, description: 'Balance summary retrieved successfully.' })
  async getBalanceSummary(@Request() req) {
    const month = new Date().getMonth() + 1; // 1-12
    const year = new Date().getFullYear();
    return this.leaveBalanceService.getEmployeeBalanceSummary(req.user.id, month, year);
  }

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

  @Get('management')
  @ApiOperation({
    summary: 'Get leave requests for management view',
    description:
      'For HR: returns all leave requests (all statuses). For Approvers: returns all requests where they are the approver (all statuses).',
  })
  @ApiResponse({ status: 200, description: 'List of leave requests retrieved successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async findForManagement(@Request() req) {
    console.log(
      '[LeaveRequestsController] findForManagement called for user:',
      req.user?.id,
      'role:',
      req.user?.role,
    );
    try {
      const result = await this.leaveRequestsService.findRequestsForManagement(req.user);
      console.log('[LeaveRequestsController] findForManagement result count:', result?.length);
      return result;
    } catch (error) {
      console.error('[LeaveRequestsController] findForManagement error:', error);
      throw error;
    }
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get leave request by ID',
    description: 'Retrieve detailed information about a specific leave request.',
  })
  @ApiParam({ name: 'id', description: 'Leave request ID', type: 'number' })
  @ApiResponse({ status: 200, description: 'Leave request retrieved successfully.' })
  @ApiResponse({ status: 404, description: 'Leave request not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const leaveRequest = await this.leaveRequestsService.findOne(id);

    // Transform notificationRecipients to ccUserIds for frontend
    const ccUserIds =
      leaveRequest.notificationRecipients?.filter((r) => r.type === 'CC').map((r) => r.userId) ||
      [];

    // Also include ccRecipients with full user info for detail view
    const ccRecipients =
      leaveRequest.notificationRecipients?.filter((r) => r.type === 'CC').map((r) => r.user) || [];

    return {
      ...leaveRequest,
      ccUserIds,
      ccRecipients,
    };
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
}
