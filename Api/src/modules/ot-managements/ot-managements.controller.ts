import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Request,
  Query,
  Res,
  ParseIntPipe,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { OtManagementsService } from './ot-managements.service';
import { OtBalanceService } from './ot-balance.service';
import { CreateOtPlanDto } from './dto/create-ot-plan.dto';
import { UpdateOtPlanDto } from './dto/update-ot-plan.dto';
import { ListOtPlansQueryDto } from './dto/list-ot-plans-query.dto';
import { ApproveOtPlanDto } from './dto/approve-ot-plan.dto';
import { RejectOtPlanDto } from './dto/reject-ot-plan.dto';
import { CheckinDto } from './dto/checkin.dto';
import { CheckoutDto } from './dto/checkout.dto';
import { ApproveCheckinDto } from './dto/approve-checkin.dto';
import { RejectCheckinDto } from './dto/reject-checkin.dto';
import { AuthenticatedRequest } from '@/common/interfaces/authenticated-request.interface';

@ApiTags('OT Plans')
@ApiBearerAuth()
@Controller('ot-plans')
export class OtManagementsController {
  private readonly logger = new Logger(OtManagementsController.name);

  constructor(
    private readonly otService: OtManagementsService,
    private readonly otBalanceService: OtBalanceService,
  ) {}

  // ── Static routes MUST come before :id routes ──

  @Post('checkin')
  @ApiOperation({ summary: 'Employee checks in for OT' })
  @ApiResponse({ status: 201, description: 'Checked in successfully.' })
  async checkin(@Body() dto: CheckinDto, @Request() req: AuthenticatedRequest) {
    return this.otService.checkin(req.user.id, dto);
  }

  @Patch('checkout')
  @ApiOperation({ summary: 'Employee checks out from OT' })
  @ApiResponse({ status: 200, description: 'Checked out successfully.' })
  async checkout(@Body() dto: CheckoutDto, @Request() req: AuthenticatedRequest) {
    return this.otService.checkout(req.user.id, dto);
  }

  @Patch('checkin/approve')
  @ApiOperation({ summary: 'Leader approves employee check-in' })
  @ApiResponse({ status: 200, description: 'Check-in approved.' })
  async approveCheckin(@Body() dto: ApproveCheckinDto, @Request() req: AuthenticatedRequest) {
    return this.otService.approveCheckin(req.user.id, dto.checkinId, dto.version);
  }

  @Patch('checkin/reject')
  @ApiOperation({ summary: 'Leader rejects employee check-in' })
  @ApiResponse({ status: 200, description: 'Check-in rejected.' })
  async rejectCheckin(@Body() dto: RejectCheckinDto, @Request() req: AuthenticatedRequest) {
    return this.otService.rejectCheckin(
      req.user.id,
      dto.checkinId,
      dto.rejectedReason,
      dto.version,
    );
  }

  @Get('employee-ot-summary/:employeeId')
  @ApiOperation({ summary: 'Get employee OT hours summary (today/month/year)' })
  @ApiParam({ name: 'employeeId', type: 'number' })
  @ApiResponse({ status: 200, description: 'Employee OT summary returned.' })
  async getEmployeeOtSummary(@Param('employeeId', ParseIntPipe) employeeId: number) {
    return this.otBalanceService.getEmployeeSummary(employeeId);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export OT plan report as CSV' })
  @ApiResponse({ status: 200, description: 'CSV file download.' })
  async exportReport(@Query() query: ListOtPlansQueryDto, @Res() res: Response) {
    const csvBuffer = await this.otService.exportReport(query);
    const filename = `ot-report-${new Date().toISOString().slice(0, 10)}.csv`;
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(csvBuffer.length),
    });
    res.send(csvBuffer);
  }

  @Get('my-assignments')
  @ApiOperation({ summary: 'List assigned OT items for the current employee (personal view)' })
  @ApiResponse({ status: 200, description: 'Paginated list of assigned OT items.' })
  async getMyAssignments(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('otBenefits') otBenefits?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ) {
    return this.otService.getMyAssignments(req.user.id, {
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 10,
      otBenefits,
      from,
      to,
      status,
    });
  }

  @Get('my-assignments/:id')
  @ApiOperation({ summary: 'Get a single assigned OT item detail' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiResponse({ status: 200, description: 'Assigned OT item detail.' })
  @ApiResponse({ status: 404, description: 'Assignment not found.' })
  async getMyAssignment(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.otService.getMyAssignment(req.user.id, id);
  }

  @Get('employees/:id')
  @ApiOperation({ summary: 'Get OT plan employee assignment detail (admin/leader view)' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiResponse({ status: 200, description: 'Assignment detail with employee info.' })
  @ApiResponse({ status: 404, description: 'Assignment not found.' })
  async getOtPlanEmployeeDetail(@Param('id', ParseIntPipe) id: number) {
    return this.otService.getOtPlanEmployeeDetail(id);
  }

  // ── CRUD routes ──

  @Post()
  @ApiOperation({ summary: 'Create a new OT plan' })
  @ApiBody({ type: CreateOtPlanDto })
  @ApiResponse({ status: 201, description: 'OT plan created successfully.' })
  async create(@Request() req: AuthenticatedRequest, @Body() dto: CreateOtPlanDto) {
    this.logger.log(`[create] userId=${req.user?.id}`);
    return this.otService.createOtPlan(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List OT plans (personal or management view)' })
  @ApiResponse({ status: 200, description: 'Paginated OT plan list.' })
  async findAll(@Request() req: AuthenticatedRequest, @Query() query: ListOtPlansQueryDto) {
    this.logger.log(
      `[findAll] userId=${req.user?.id} role=${req.user?.role} query=${JSON.stringify(query)}`,
    );
    return this.otService.findOtPlans({ id: req.user.id, role: req.user.role }, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get OT plan detail by ID' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiResponse({ status: 200, description: 'OT plan detail.' })
  @ApiResponse({ status: 404, description: 'OT plan not found.' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req: AuthenticatedRequest) {
    return this.otService.findOne(id, req.user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a pending OT plan' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiBody({ type: UpdateOtPlanDto })
  @ApiResponse({ status: 200, description: 'OT plan updated.' })
  @ApiResponse({ status: 409, description: 'Version conflict.' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOtPlanDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.otService.updateOtPlan(id, req.user.id, dto);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a pending OT plan' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiBody({ type: ApproveOtPlanDto })
  @ApiResponse({ status: 200, description: 'OT plan approved.' })
  async approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveOtPlanDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.otService.approveOtPlan(id, req.user.id, dto.version);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject a pending OT plan' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiBody({ type: RejectOtPlanDto })
  @ApiResponse({ status: 200, description: 'OT plan rejected.' })
  async reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectOtPlanDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.otService.rejectOtPlan(id, req.user.id, dto.rejectedReason, dto.version);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel an OT plan' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiResponse({ status: 200, description: 'OT plan cancelled.' })
  async cancel(@Param('id', ParseIntPipe) id: number, @Request() req: AuthenticatedRequest) {
    return this.otService.cancelOtPlan(id, req.user.id);
  }
}
