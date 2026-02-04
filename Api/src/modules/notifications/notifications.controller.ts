import { Controller, Post } from '@nestjs/common';

@Controller('notifications')
export class NotificationsController {
  @Post('/invitations')
  sendInvitationNotification() {
    // Logic to send invitation notification
  }

  @Post('/ot-requests')
  sendOtRequestNotification() {
    // Logic to send OT request notification
  }

  @Post('/leave-requests')
  sendLeaveRequestNotification() {
    // Logic to send leave request notification
  }

  @Post('/ot_request_approvals')
  sendOtRequestApprovalNotification() {
    // Logic to send OT request approval notification
  }

  @Post('/leave_request_approvals')
  sendLeaveRequestApprovalNotification() {
    // Logic to send leave request approval notification
  }

  @Post('leave_request_rejections')
  sendLeaveRequestRejectionNotification() {
    // Logic to send leave request rejection notification
  }

  @Post('ot_request_rejections')
  sendOtRequestRejectionNotification() {
    // Logic to send OT request rejection notification
  }
}
