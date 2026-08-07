-- CreateTable
CREATE TABLE "ProcessedLineItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shopifyLineItemId" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "shopifyVariantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedLineItem_shopifyLineItemId_key" ON "ProcessedLineItem"("shopifyLineItemId");
