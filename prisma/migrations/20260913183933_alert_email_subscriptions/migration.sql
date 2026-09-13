-- CreateTable
CREATE TABLE "AlertSubscriber" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AlertEmailNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "themeId" TEXT NOT NULL,
    "weekStart" DATETIME NOT NULL,
    "recipientCount" INTEGER NOT NULL,
    "sent" BOOLEAN NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "AlertSubscriber_email_key" ON "AlertSubscriber"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AlertEmailNotification_themeId_weekStart_key" ON "AlertEmailNotification"("themeId", "weekStart");
