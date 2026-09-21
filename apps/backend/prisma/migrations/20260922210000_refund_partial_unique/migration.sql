-- INO-AUDIT4-D23: replace the full unique index on (paymentId, triggeredBy)
-- with a PARTIAL unique index that only applies to automatic triggers.
--
-- The previous full unique index (created in migration 20260922120000)
-- prevented multiple SUPER_ADMIN_MANUAL refunds on the same payment —
-- making partial refunds impossible to complete. A ₹1000 payment with a
-- ₹300 COMPLETED manual refund would reject a second ₹700 manual refund
-- because the (paymentId, SUPER_ADMIN_MANUAL) pair already existed.
--
-- The new partial index enforces uniqueness ONLY for automatic triggers
-- (OUTLET_REJECT, OUTLET_CANCEL, CUSTOMER_CANCEL). SUPER_ADMIN_MANUAL
-- refunds are excluded — multiple are allowed per payment, subject to
-- the remaining-refundable check in admin.service.js.
--
-- Both SQLite 3.8.0+ (2014) and all supported Postgres versions support
-- partial indexes via the WHERE clause.
--
-- Production note: if the existing data contains duplicate
-- (paymentId, triggeredBy) pairs for automatic triggers (e.g. from
-- before the application-level check was added in commit ab26f92), the
-- CREATE UNIQUE INDEX below will FAIL. Audit first:
--
--   SELECT "paymentId", "triggeredBy", COUNT(*) AS n
--   FROM "Refund"
--   WHERE "triggeredBy" != 'SUPER_ADMIN_MANUAL'
--   GROUP BY "paymentId", "triggeredBy"
--   HAVING COUNT(*) > 1;

-- DropIndex (the full unique index from migration 20260922120000)
DROP INDEX IF EXISTS "Refund_paymentId_triggeredBy_key";

-- CreateIndex (partial unique — only for automatic triggers)
CREATE UNIQUE INDEX "Refund_paymentId_triggeredBy_auto_key"
ON "Refund"("paymentId", "triggeredBy")
WHERE "triggeredBy" != 'SUPER_ADMIN_MANUAL';
