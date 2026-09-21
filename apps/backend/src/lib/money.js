/**
 * Centralized money helpers — INO-AUDIT4-D14 fix.
 *
 * The previous implementation had `toPaise` / `fromPaise` duplicated in
 * orders.service.js + cart.service.js, and `Math.round(Number(x) * 100)`
 * inline in payments.service.js + admin.service.js. Money logic was
 * spread across modules.
 *
 * This module is the single source of truth for money primitives:
 *   - toPaise(decimal)  → integer paise (multiply by 100, round)
 *   - fromPaise(paise)  → 2-decimal string for DB storage
 *   - isFullyRefunded(paymentAmount, refunds) → bool (sum COMPLETED == amount)
 *
 * All money arithmetic should go through these helpers. The DB stores
 * Decimal (arbitrary precision); all internal arithmetic uses integer
 * paise (no floating-point drift); the write boundary converts back to
 * a 2-decimal string.
 *
 * Spec ref: §4 money fields are Decimal(scale 10, precision 2).
 */

/**
 * Convert a Prisma Decimal value (or any number/string) to integer paise.
 * Math.round handles the JS floating-point quirk where 99.50 * 100 might
 * give 9950.0000001 — we round to the nearest integer.
 *
 * @param {string|number|Decimal} decimal
 * @returns {number} integer paise
 */
function toPaise(decimal) {
  return Math.round(Number(decimal) * 100);
}

/**
 * Convert integer paise back to a string with 2 decimal places for DB
 * storage. String output avoids any further floating-point representation
 * issues — Prisma accepts strings for Decimal fields.
 *
 * @param {number} paise
 * @returns {string} e.g. "99.50"
 */
function fromPaise(paise) {
  return (paise / 100).toFixed(2);
}

/**
 * Check whether a payment has been fully refunded by summing COMPLETED
 * refunds against the payment amount. PENDING refunds are NOT counted
 * (they're in-flight money that hasn't been confirmed by the gateway yet).
 *
 * @param {number|string|Decimal} paymentAmount
 * @param {Array<{status: string, amount: number|string|Decimal}>} refunds
 * @returns {boolean} true if sum(COMPLETED refunds) >= paymentAmount
 */
function isFullyRefunded(paymentAmount, refunds) {
  const completedSum = (refunds || [])
    .filter(r => r.status === 'COMPLETED')
    .reduce((sum, r) => sum + Number(r.amount), 0);
  const paymentAmt = Number(paymentAmount);
  // 0.01 epsilon for floating-point safety (Decimal → Number can
  // introduce tiny errors well below any real refund amount).
  return completedSum >= paymentAmt - 0.01;
}

/**
 * Compute the remaining refundable amount: payment amount minus the sum
 * of COMPLETED + PENDING refunds. PENDING refunds are subtracted too
 * because they represent in-flight refund attempts that may still
 * complete — the business shouldn't allow another refund that would
 * double-count that money.
 *
 * @param {number|string|Decimal} paymentAmount
 * @param {Array<{status: string, amount: number|string|Decimal}>} refunds
 * @returns {number} remaining refundable amount (in rupees, may be 0)
 */
function remainingRefundable(paymentAmount, refunds) {
  const inFlight = (refunds || [])
    .filter(r => r.status === 'COMPLETED' || r.status === 'PENDING')
    .reduce((sum, r) => sum + Number(r.amount), 0);
  return Number(paymentAmount) - inFlight;
}

module.exports = {
  toPaise,
  fromPaise,
  isFullyRefunded,
  remainingRefundable,
};
