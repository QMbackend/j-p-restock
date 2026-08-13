/*
  Warnings:

  - A unique constraint covering the columns `[shop,shopifyLineItemId]` on the table `ProcessedLineItem` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[shop,shopifyVariantId]` on the table `RestockItem` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ProcessedLineItem_shopifyLineItemId_key";

-- DropIndex
DROP INDEX "RestockItem_shopifyVariantId_key";

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedLineItem_shop_shopifyLineItemId_key" ON "ProcessedLineItem"("shop", "shopifyLineItemId");

-- CreateIndex
CREATE INDEX "RestockEvent_shop_idx" ON "RestockEvent"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "RestockItem_shop_shopifyVariantId_key" ON "RestockItem"("shop", "shopifyVariantId");
