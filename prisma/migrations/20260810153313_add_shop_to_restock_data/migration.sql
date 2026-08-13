-- AlterTable
ALTER TABLE "ProcessedLineItem" ADD COLUMN     "shop" TEXT;

-- AlterTable
ALTER TABLE "RestockEvent" ADD COLUMN     "shop" TEXT;

-- AlterTable
ALTER TABLE "RestockItem" ADD COLUMN     "shop" TEXT;
