import { Controller, Get, Post, Patch, Body, Param, Request, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { LeaveRequestsService } from './leave-requests.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveRequestStatusDto } from './dto/update-leave-request-status.dto';

@ApiTags('Leave Requests')
@ApiBearerAuth()
@Controller('leave-requests')
export class LeaveRequestsController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  @Post()
  @ApiOperation({ 
    summary: 'Create a new leave request',
    description: 'Submit a new leave request. Notifications will be sent to approver, HR, and CC recipients.'
  })
  @ApiBody({ type: CreateLeaveRequestDto })
  @ApiResponse({ status: 201, description: 'Leave request created successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid input data or no approver assigned.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async create(@Request() req, @Body() createDto: CreateLeaveRequestDto) {
    console.log('[LeaveRequestsController] create called for user:', req.user?.id, 'with data:', createDto);
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
    description: 'Retrieve all leave requests created by the authenticated user.'
  })
  @ApiResponse({ status: 200, description: 'List of leave requests retrieved successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async findAll(@Request() req) {
    console.log('[LeaveRequestsController] findAll called for user:', req.user?.id);
    try {
      const result = await this.leaveRequestsService.findUserLeaveRequests(req.user.id);
      console.log('[LeaveRequestsController] findAll result count:', result?.length);
      return result;
    } catch (error) {
      console.error('[LeaveRequestsController] findAll error:', error);
      throw error;
    }
  }

  @Get('pending-approvals')
  @ApiOperation({ 
    summary: 'Get pending approvals for current user',
    description: 'Retrieve all pending leave requests that require approval from the authenticated user.'
  })
  @ApiResponse({ status: 200, description: 'List of pending approvals retrieved successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async findPendingApprovals(@Request() req) {
    console.log('[LeaveRequestsController] findPendingApprovals called for user:', req.user?.id);
    try {
      const result = await this.leaveRequestsService.findPendingApprovalsForUser(req.user.id);
      console.log('[LeaveRequestsController] findPendingApprovals result count:', result?.length);
      return result;
    } catch (error) {
      console.error('[LeaveRequestsController] findPendingApprovals error:', error);
      throw error;
    }
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get leave request by ID',
    description: 'Retrieve detailed information about a specific leave request.'
  })
  @ApiParam({ name: 'id', description: 'Leave request ID', type: 'number' })
  @ApiResponse({ status: 200, description: 'Leave request retrieved successfully.' })
  @ApiResponse({ status: 404, description: 'Leave request not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async findOne(@Param('id') id: number) {
    return this.leaveRequestsService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({
    summary: ' update my leave request so that I can adjust the time-off duration to match my changed schedule.'})
  @ApiParam({ name: 'id', description: 'Leave request ID', type: 'number' })
  @ApiBody({ type: UpdateLeaveRequestStatusDto })
  @ApiResponse({ status: 200, description: 'Leave request updated successfully.' })
  async update(
    @Param('id') id: number,
    @Body() updateDto: UpdateLeaveRequestStatusDto,
    @Request() req,
  ) {
    return "update method not implemented yet";
  }

  
  @Patch(':id/approve')
  @ApiOperation({ 
    summary: 'Approve a leave request',
    description: 'Approve a pending leave request. Only the assigned approver can approve.'
  })
  @ApiParam({ name: 'id', description: 'Leave request ID', type: 'number' })
  @ApiResponse({ status: 200, description: 'Leave request approved successfully.' })
  @ApiResponse({ status: 400, description: 'Request cannot be approved (invalid status).' })
  @ApiResponse({ status: 403, description: 'Not authorized to approve this request.' })
  @ApiResponse({ status: 404, description: 'Leave request not found.' })
  async approve(@Param('id') id: number, @Request() req) {
    return this.leaveRequestsService.approveLeaveRequest(id, req.user.id);
  }

  @Patch(':id/reject')
  @ApiOperation({ 
    summary: 'Reject a leave request',
    description: 'Reject a pending leave request. Only the assigned approver can reject.'
  })
  @ApiParam({ name: 'id', description: 'Leave request ID', type: 'number' })
  @ApiResponse({ status: 200, description: 'Leave request rejected successfully.' })
  @ApiResponse({ status: 400, description: 'Request cannot be rejected (invalid status).' })
  @ApiResponse({ status: 403, description: 'Not authorized to reject this request.' })
  @ApiResponse({ status: 404, description: 'Leave request not found.' })
  async reject(@Param('id') id: number, @Request() req) {
    return this.leaveRequestsService.rejectLeaveRequest(id, req.user.id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ 
    summary: 'Cancel a leave request',
    description: 'Cancel your own pending leave request. Only the requester can cancel.'
  })
  @ApiParam({ name: 'id', description: 'Leave request ID', type: 'number' })
  @ApiResponse({ status: 200, description: 'Leave request cancelled successfully.' })
  @ApiResponse({ status: 400, description: 'Request cannot be cancelled (invalid status).' })
  @ApiResponse({ status: 403, description: 'Not authorized to cancel this request.' })
  @ApiResponse({ status: 404, description: 'Leave request not found.' })
  async cancel(@Param('id') id: number, @Request() req) {
    return this.leaveRequestsService.cancelLeaveRequest(id, req.user.id);
  }
}
