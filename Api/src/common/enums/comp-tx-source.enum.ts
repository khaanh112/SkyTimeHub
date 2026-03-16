export enum CompTxSource {
  OT_CHECKIN_APPROVED = 'OT_CHECKIN_APPROVED', // OT approved → comp balance credited
  LEAVE_RESERVE = 'LEAVE_RESERVE', // Comp leave submitted (PENDING)
  LEAVE_APPROVAL = 'LEAVE_APPROVAL', // Comp leave approved
  LEAVE_RELEASE = 'LEAVE_RELEASE', // Comp leave cancelled/rejected while PENDING
  LEAVE_REFUND = 'LEAVE_REFUND', // Comp leave cancelled after APPROVED
  MAKEUP_APPROVAL = 'MAKEUP_APPROVAL',
  ADJUSTMENT = 'ADJUSTMENT',
}
