/*
  Warnings:

  - Added the required column `soldAt` to the `ProcessedLineItem` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProcessedLineItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shopifyLineItemId" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "shopifyVariantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "soldAt" DATETIME NOT NULL,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_ProcessedLineItem" ("id", "processedAt", "quantity", "shopifyLineItemId", "shopifyOrderId", "shopifyVariantId") SELECT "id", "processedAt", "quantity", "shopifyLineItemId", "shopifyOrderId", "shopifyVariantId" FROM "ProcessedLineItem";
DROP TABLE "ProcessedLineItem";
ALTER TABLE "new_ProcessedLineItem" RENAME TO "ProcessedLineItem";
CREATE UNIQUE INDEX "ProcessedLineItem_shopifyLineItemId_key" ON "ProcessedLineItem"("shopifyLineItemId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
