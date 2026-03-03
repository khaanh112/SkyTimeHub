export enum BalanceTxSource {
  /** CREDIT: +1/month accrual */
  MONTHLY_ACCRUAL = 'MONTHLY_ACCRUAL',
  /** DEBIT: reserve balance when request is submitted */
  RESERVE = 'RESERVE',
  /** DEBIT: finalise when request is approved (replaces RESERVE rows) */
  APPROVAL = 'APPROVAL',
  /** CREDIT: release reserve when request is rejected / cancelled before approval */
  RELEASE = 'RELEASE',
  /** CREDIT: refund when request is cancelled after approval */
  REFUND = 'REFUND',
}