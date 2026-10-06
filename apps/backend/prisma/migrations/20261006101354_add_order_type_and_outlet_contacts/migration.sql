-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "orderType" TEXT NOT NULL DEFAULT 'TAKEAWAY';

-- AlterTable
ALTER TABLE "Outlet" ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactNumber" TEXT;
