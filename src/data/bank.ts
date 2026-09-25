// Bank loans. One at a time. Repaid automatically at payroll after a grace period.

export const loanAmountFor = (rebirth: number) => 1000 * 5 ** rebirth
export const LOAN_INTEREST = 0.25
/** Payrolls before repayments start. */
export const LOAN_GRACE = 6
/** Number of payroll installments to repay (after grace). */
export const LOAN_INSTALLMENTS = 10
