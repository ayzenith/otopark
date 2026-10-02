-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "ParkingStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'VOIDED');

-- CreateEnum
CREATE TYPE "BillingMode" AS ENUM ('TARIFF', 'SUBSCRIPTION', 'FREE', 'MANUAL_OVERRIDE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SubscriptionPaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "PaymentSource" AS ENUM ('PARKING', 'SUBSCRIPTION', 'WASH', 'OTHER_INCOME', 'REFUND');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('CONFIRMED', 'VOIDED');

-- CreateEnum
CREATE TYPE "WashStatus" AS ENUM ('QUEUED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WashPaymentStatus" AS ENUM ('UNPAID', 'PAID', 'VOIDED');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "DrawerStatus" AS ENUM ('OPEN', 'CLOSED', 'RECONCILED');

-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'BANK_TRANSFER', 'ADVANCE', 'CORRECTION');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('PURCHASE', 'CONSUMPTION', 'ADJUSTMENT', 'WASTE');

-- CreateEnum
CREATE TYPE "InventoryUnit" AS ENUM ('LITRE', 'ADET', 'KG');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "jobTitle" TEXT,
    "role" "Role" NOT NULL DEFAULT 'STAFF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "deactivatedAt" TIMESTAMP(3),
    "deactivatedById" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hireDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "monthlySalary" DECIMAL(12,2),
    "insuranceCost" DECIMAL(12,2),
    "mealAllowance" DECIMAL(12,2),
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "EmployeeProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "ip" TEXT,
    "success" BOOLEAN NOT NULL,
    "reason" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "altPhone" TEXT,
    "email" TEXT,
    "isCompany" BOOLEAN NOT NULL DEFAULT false,
    "companyName" TEXT,
    "taxId" TEXT,
    "notes" TEXT,
    "kvkkConsentAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleClass" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "VehicleClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "plateNormalized" TEXT NOT NULL,
    "plateDisplay" TEXT NOT NULL,
    "vehicleClassId" TEXT NOT NULL,
    "customerId" TEXT,
    "brandModel" TEXT,
    "color" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TariffPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "TariffPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TariffVersion" (
    "id" TEXT NOT NULL,
    "tariffPlanId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "TariffVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TariffRule" (
    "id" TEXT NOT NULL,
    "tariffVersionId" TEXT NOT NULL,
    "vehicleClassId" TEXT,
    "freeMinutes" INTEGER NOT NULL DEFAULT 0,
    "freeMinutesDeductible" BOOLEAN NOT NULL DEFAULT false,
    "gracePeriodMinutes" INTEGER NOT NULL DEFAULT 0,
    "firstPeriodMinutes" INTEGER NOT NULL DEFAULT 0,
    "firstPeriodPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "hourlyPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "hourlyRoundingMinutes" INTEGER NOT NULL DEFAULT 60,
    "dailyPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "dailyCapPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "nightFlatPrice" DECIMAL(12,2),
    "nightStartMinute" INTEGER,
    "nightEndMinute" INTEGER,
    "weekendMultiplier" DECIMAL(6,3),
    "minCharge" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TariffRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TariffChangeLog" (
    "id" TEXT NOT NULL,
    "tariffPlanId" TEXT NOT NULL,
    "fromVersionId" TEXT,
    "toVersionId" TEXT NOT NULL,
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "TariffChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParkingSession" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "plateNormalized" TEXT NOT NULL,
    "plateDisplay" TEXT NOT NULL,
    "vehicleClassId" TEXT NOT NULL,
    "entryAt" TIMESTAMP(3) NOT NULL,
    "entryUserId" TEXT NOT NULL,
    "entryShiftId" TEXT NOT NULL,
    "entryNote" TEXT,
    "exitAt" TIMESTAMP(3),
    "exitUserId" TEXT,
    "exitShiftId" TEXT,
    "status" "ParkingStatus" NOT NULL DEFAULT 'ACTIVE',
    "billingMode" "BillingMode" NOT NULL DEFAULT 'TARIFF',
    "subscriptionId" TEXT,
    "tariffVersionId" TEXT,
    "tariffRuleId" TEXT,
    "tariffSnapshot" JSONB,
    "durationMinutes" INTEGER,
    "calculatedAmount" DECIMAL(12,2),
    "discountAmount" DECIMAL(12,2),
    "discountReason" TEXT,
    "discountById" TEXT,
    "payableAmount" DECIMAL(12,2),
    "collectedAmount" DECIMAL(12,2),
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParkingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParkingCapacitySetting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "totalCapacity" INTEGER NOT NULL DEFAULT 0,
    "reservedForSubscribers" INTEGER NOT NULL DEFAULT 0,
    "warnThresholdPercent" INTEGER NOT NULL DEFAULT 90,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "ParkingCapacitySetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultDurationDays" INTEGER NOT NULL,
    "suggestedPrice" DECIMAL(12,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "SubscriptionType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "subscriptionTypeId" TEXT,
    "planLabel" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "agreedPrice" DECIMAL(12,2) NOT NULL,
    "priceNote" TEXT,
    "billingPeriod" "BillingPeriod" NOT NULL DEFAULT 'MONTHLY',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "paymentStatus" "SubscriptionPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "includedVehicleCount" INTEGER NOT NULL DEFAULT 1,
    "coveredHoursNote" TEXT,
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelReason" TEXT,
    "managerNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionVehicle" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "addedById" TEXT,

    CONSTRAINT "SubscriptionVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPeriod" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "periodNo" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "SubscriptionPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "subscriptionPeriodId" TEXT,
    "paymentId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WashServiceCatalog" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "estimatedMinutes" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPublicOnWebsite" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "WashServiceCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WashServicePriceVersion" (
    "id" TEXT NOT NULL,
    "washServiceId" TEXT NOT NULL,
    "vehicleClassId" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "WashServicePriceVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WashJob" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "plateNormalized" TEXT NOT NULL,
    "plateDisplay" TEXT NOT NULL,
    "customerId" TEXT,
    "vehicleClassId" TEXT NOT NULL,
    "status" "WashStatus" NOT NULL DEFAULT 'QUEUED',
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "assignedUserId" TEXT,
    "createdById" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2),
    "payableAmount" DECIMAL(12,2) NOT NULL,
    "collectedAmount" DECIMAL(12,2),
    "paymentStatus" "WashPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "notes" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WashJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WashJobItem" (
    "id" TEXT NOT NULL,
    "washJobId" TEXT NOT NULL,
    "washServiceId" TEXT NOT NULL,
    "washServicePriceVersionId" TEXT,
    "serviceNameSnapshot" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "lineTotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "WashJobItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" "InventoryUnit" NOT NULL DEFAULT 'ADET',
    "currentStock" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "minStock" DECIMAL(12,3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitCost" DECIMAL(12,2),
    "expenseId" TEXT,
    "washJobId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "cardNote" TEXT,
    "direction" "PaymentDirection" NOT NULL DEFAULT 'IN',
    "sourceType" "PaymentSource" NOT NULL,
    "parkingSessionId" TEXT,
    "washJobId" TEXT,
    "otherIncomeId" TEXT,
    "shiftId" TEXT NOT NULL,
    "cashDrawerSessionId" TEXT,
    "collectedById" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'CONFIRMED',
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "reversalOfId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "openingNote" TEXT,
    "closingNote" TEXT,
    "status" "ShiftStatus" NOT NULL DEFAULT 'OPEN',
    "closedById" TEXT,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashDrawerSession" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedById" TEXT NOT NULL,
    "openingFloat" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "expectedCash" DECIMAL(12,2),
    "countedCash" DECIMAL(12,2),
    "differenceReason" TEXT,
    "expectedCard" DECIMAL(12,2),
    "declaredCard" DECIMAL(12,2),
    "status" "DrawerStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,

    CONSTRAINT "CashDrawerSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashMovement" (
    "id" TEXT NOT NULL,
    "cashDrawerSessionId" TEXT NOT NULL,
    "type" "CashMovementType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "expenseId" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'CONFIRMED',
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expenseCategoryId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "description" TEXT NOT NULL,
    "supplierName" TEXT,
    "documentNo" TEXT,
    "relatedUserId" TEXT,
    "cashDrawerSessionId" TEXT,
    "attachmentUrl" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'CONFIRMED',
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtherIncome" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "incomeDate" TIMESTAMP(3) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "description" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "OtherIncome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitePage" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bodyMarkdown" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "SitePage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitePublicPrice" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "priceText" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "sourceNote" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "SitePublicPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteGalleryImage" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SiteGalleryImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessSetting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "businessName" TEXT NOT NULL DEFAULT 'Londra Camping Otopark',
    "addressText" TEXT NOT NULL DEFAULT '',
    "mapsUrl" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "phone" TEXT NOT NULL DEFAULT '',
    "whatsappPhone" TEXT,
    "workingHoursText" TEXT NOT NULL DEFAULT '',
    "instagramUrl" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    "businessDayStartHour" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "BusinessSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "actorLabel" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "note" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "UserPermission_userId_idx" ON "UserPermission"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermission_userId_permission_key" ON "UserPermission"("userId", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expires_idx" ON "Session"("expires");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeProfile_userId_key" ON "EmployeeProfile"("userId");

-- CreateIndex
CREATE INDEX "LoginAttempt_username_at_idx" ON "LoginAttempt"("username", "at");

-- CreateIndex
CREATE INDEX "LoginAttempt_ip_at_idx" ON "LoginAttempt"("ip", "at");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Customer_fullName_idx" ON "Customer"("fullName");

-- CreateIndex
CREATE INDEX "Customer_isActive_idx" ON "Customer"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleClass_code_key" ON "VehicleClass"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_plateNormalized_key" ON "Vehicle"("plateNormalized");

-- CreateIndex
CREATE INDEX "Vehicle_customerId_idx" ON "Vehicle"("customerId");

-- CreateIndex
CREATE INDEX "Vehicle_plateNormalized_idx" ON "Vehicle"("plateNormalized");

-- CreateIndex
CREATE INDEX "TariffPlan_isActive_priority_idx" ON "TariffPlan"("isActive", "priority");

-- CreateIndex
CREATE INDEX "TariffVersion_effectiveFrom_effectiveTo_idx" ON "TariffVersion"("effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "TariffVersion_tariffPlanId_versionNo_key" ON "TariffVersion"("tariffPlanId", "versionNo");

-- CreateIndex
CREATE UNIQUE INDEX "TariffRule_tariffVersionId_vehicleClassId_key" ON "TariffRule"("tariffVersionId", "vehicleClassId");

-- CreateIndex
CREATE INDEX "TariffChangeLog_tariffPlanId_changedAt_idx" ON "TariffChangeLog"("tariffPlanId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ParkingSession_code_key" ON "ParkingSession"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ParkingSession_idempotencyKey_key" ON "ParkingSession"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ParkingSession_status_entryAt_idx" ON "ParkingSession"("status", "entryAt");

-- CreateIndex
CREATE INDEX "ParkingSession_plateNormalized_entryAt_idx" ON "ParkingSession"("plateNormalized", "entryAt");

-- CreateIndex
CREATE INDEX "ParkingSession_exitAt_idx" ON "ParkingSession"("exitAt");

-- CreateIndex
CREATE INDEX "ParkingSession_entryShiftId_idx" ON "ParkingSession"("entryShiftId");

-- CreateIndex
CREATE INDEX "ParkingSession_exitShiftId_idx" ON "ParkingSession"("exitShiftId");

-- CreateIndex
CREATE INDEX "ParkingSession_vehicleId_idx" ON "ParkingSession"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_code_key" ON "Subscription"("code");

-- CreateIndex
CREATE INDEX "Subscription_status_endDate_idx" ON "Subscription"("status", "endDate");

-- CreateIndex
CREATE INDEX "Subscription_customerId_idx" ON "Subscription"("customerId");

-- CreateIndex
CREATE INDEX "Subscription_paymentStatus_idx" ON "Subscription"("paymentStatus");

-- CreateIndex
CREATE INDEX "SubscriptionVehicle_subscriptionId_idx" ON "SubscriptionVehicle"("subscriptionId");

-- CreateIndex
CREATE INDEX "SubscriptionVehicle_vehicleId_removedAt_idx" ON "SubscriptionVehicle"("vehicleId", "removedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPeriod_subscriptionId_periodNo_key" ON "SubscriptionPeriod"("subscriptionId", "periodNo");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_paymentId_key" ON "SubscriptionPayment"("paymentId");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_subscriptionId_idx" ON "SubscriptionPayment"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "WashServiceCatalog_code_key" ON "WashServiceCatalog"("code");

-- CreateIndex
CREATE INDEX "WashServicePriceVersion_washServiceId_effectiveFrom_idx" ON "WashServicePriceVersion"("washServiceId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "WashJob_code_key" ON "WashJob"("code");

-- CreateIndex
CREATE UNIQUE INDEX "WashJob_idempotencyKey_key" ON "WashJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WashJob_status_queuedAt_idx" ON "WashJob"("status", "queuedAt");

-- CreateIndex
CREATE INDEX "WashJob_plateNormalized_idx" ON "WashJob"("plateNormalized");

-- CreateIndex
CREATE INDEX "WashJob_paymentStatus_idx" ON "WashJob"("paymentStatus");

-- CreateIndex
CREATE INDEX "WashJobItem_washJobId_idx" ON "WashJobItem"("washJobId");

-- CreateIndex
CREATE INDEX "InventoryMovement_inventoryItemId_createdAt_idx" ON "InventoryMovement"("inventoryItemId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_code_key" ON "Payment"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reversalOfId_key" ON "Payment"("reversalOfId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_paidAt_method_idx" ON "Payment"("paidAt", "method");

-- CreateIndex
CREATE INDEX "Payment_sourceType_paidAt_idx" ON "Payment"("sourceType", "paidAt");

-- CreateIndex
CREATE INDEX "Payment_shiftId_idx" ON "Payment"("shiftId");

-- CreateIndex
CREATE INDEX "Payment_cashDrawerSessionId_idx" ON "Payment"("cashDrawerSessionId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Shift_userId_startedAt_idx" ON "Shift"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "Shift_status_idx" ON "Shift"("status");

-- CreateIndex
CREATE INDEX "CashDrawerSession_status_openedAt_idx" ON "CashDrawerSession"("status", "openedAt");

-- CreateIndex
CREATE INDEX "CashMovement_cashDrawerSessionId_idx" ON "CashMovement"("cashDrawerSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_code_key" ON "ExpenseCategory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_code_key" ON "Expense"("code");

-- CreateIndex
CREATE INDEX "Expense_expenseDate_expenseCategoryId_idx" ON "Expense"("expenseDate", "expenseCategoryId");

-- CreateIndex
CREATE INDEX "Expense_status_idx" ON "Expense"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OtherIncome_code_key" ON "OtherIncome"("code");

-- CreateIndex
CREATE INDEX "OtherIncome_incomeDate_idx" ON "OtherIncome"("incomeDate");

-- CreateIndex
CREATE UNIQUE INDEX "SitePage_key_key" ON "SitePage"("key");

-- CreateIndex
CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_at_idx" ON "AuditLog"("userId", "at");

-- CreateIndex
CREATE INDEX "AuditLog_action_at_idx" ON "AuditLog"("action", "at");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_vehicleClassId_fkey" FOREIGN KEY ("vehicleClassId") REFERENCES "VehicleClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffVersion" ADD CONSTRAINT "TariffVersion_tariffPlanId_fkey" FOREIGN KEY ("tariffPlanId") REFERENCES "TariffPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffRule" ADD CONSTRAINT "TariffRule_tariffVersionId_fkey" FOREIGN KEY ("tariffVersionId") REFERENCES "TariffVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffRule" ADD CONSTRAINT "TariffRule_vehicleClassId_fkey" FOREIGN KEY ("vehicleClassId") REFERENCES "VehicleClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffChangeLog" ADD CONSTRAINT "TariffChangeLog_tariffPlanId_fkey" FOREIGN KEY ("tariffPlanId") REFERENCES "TariffPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffChangeLog" ADD CONSTRAINT "TariffChangeLog_fromVersionId_fkey" FOREIGN KEY ("fromVersionId") REFERENCES "TariffVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffChangeLog" ADD CONSTRAINT "TariffChangeLog_toVersionId_fkey" FOREIGN KEY ("toVersionId") REFERENCES "TariffVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingSession" ADD CONSTRAINT "ParkingSession_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingSession" ADD CONSTRAINT "ParkingSession_entryUserId_fkey" FOREIGN KEY ("entryUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingSession" ADD CONSTRAINT "ParkingSession_exitUserId_fkey" FOREIGN KEY ("exitUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingSession" ADD CONSTRAINT "ParkingSession_entryShiftId_fkey" FOREIGN KEY ("entryShiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingSession" ADD CONSTRAINT "ParkingSession_exitShiftId_fkey" FOREIGN KEY ("exitShiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingSession" ADD CONSTRAINT "ParkingSession_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingSession" ADD CONSTRAINT "ParkingSession_tariffVersionId_fkey" FOREIGN KEY ("tariffVersionId") REFERENCES "TariffVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingSession" ADD CONSTRAINT "ParkingSession_tariffRuleId_fkey" FOREIGN KEY ("tariffRuleId") REFERENCES "TariffRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_subscriptionTypeId_fkey" FOREIGN KEY ("subscriptionTypeId") REFERENCES "SubscriptionType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionVehicle" ADD CONSTRAINT "SubscriptionVehicle_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionVehicle" ADD CONSTRAINT "SubscriptionVehicle_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPeriod" ADD CONSTRAINT "SubscriptionPeriod_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_subscriptionPeriodId_fkey" FOREIGN KEY ("subscriptionPeriodId") REFERENCES "SubscriptionPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WashServicePriceVersion" ADD CONSTRAINT "WashServicePriceVersion_washServiceId_fkey" FOREIGN KEY ("washServiceId") REFERENCES "WashServiceCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WashServicePriceVersion" ADD CONSTRAINT "WashServicePriceVersion_vehicleClassId_fkey" FOREIGN KEY ("vehicleClassId") REFERENCES "VehicleClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WashJob" ADD CONSTRAINT "WashJob_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WashJob" ADD CONSTRAINT "WashJob_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WashJob" ADD CONSTRAINT "WashJob_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WashJob" ADD CONSTRAINT "WashJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WashJob" ADD CONSTRAINT "WashJob_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WashJobItem" ADD CONSTRAINT "WashJobItem_washJobId_fkey" FOREIGN KEY ("washJobId") REFERENCES "WashJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WashJobItem" ADD CONSTRAINT "WashJobItem_washServiceId_fkey" FOREIGN KEY ("washServiceId") REFERENCES "WashServiceCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WashJobItem" ADD CONSTRAINT "WashJobItem_washServicePriceVersionId_fkey" FOREIGN KEY ("washServicePriceVersionId") REFERENCES "WashServicePriceVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_washJobId_fkey" FOREIGN KEY ("washJobId") REFERENCES "WashJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_parkingSessionId_fkey" FOREIGN KEY ("parkingSessionId") REFERENCES "ParkingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_washJobId_fkey" FOREIGN KEY ("washJobId") REFERENCES "WashJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_otherIncomeId_fkey" FOREIGN KEY ("otherIncomeId") REFERENCES "OtherIncome"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_cashDrawerSessionId_fkey" FOREIGN KEY ("cashDrawerSessionId") REFERENCES "CashDrawerSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_collectedById_fkey" FOREIGN KEY ("collectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashDrawerSession" ADD CONSTRAINT "CashDrawerSession_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_cashDrawerSessionId_fkey" FOREIGN KEY ("cashDrawerSessionId") REFERENCES "CashDrawerSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_expenseCategoryId_fkey" FOREIGN KEY ("expenseCategoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_relatedUserId_fkey" FOREIGN KEY ("relatedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_cashDrawerSessionId_fkey" FOREIGN KEY ("cashDrawerSessionId") REFERENCES "CashDrawerSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ===========================================================================
-- KISMI TEKIL INDEKSLER VE BUTUNLUK KORUMALARI
-- Prisma semasi ile ifade edilemeyen, veritabani seviyesinde zorunlu kurallar.
-- Gerekceler: docs/02-veritabani-semasi.md
-- ===========================================================================

-- 1) AYNI PLAKADAN IKINCI AKTIF GIRIS IMKANSIZ
--    Uygulama kontrolu yaris kosulunda yetersizdir: iki personel ayni anda
--    ayni plakayi girerse ikincisi bu indeks sayesinde hata alir.
CREATE UNIQUE INDEX "parking_active_plate_uniq"
  ON "ParkingSession" ("plateNormalized")
  WHERE "status" = 'ACTIVE';

-- 2) BIR ARAC AYNI ANDA TEK ABONMANDA
--    Abonman iptal/bitince SubscriptionVehicle.removedAt damgalanir; boylece
--    arac yeni bir abonmana baglanabilir.
CREATE UNIQUE INDEX "subscription_vehicle_active_uniq"
  ON "SubscriptionVehicle" ("vehicleId")
  WHERE "removedAt" IS NULL;

-- 3) TEK SATIRLIK AYAR TABLOLARI
ALTER TABLE "BusinessSetting"
  ADD CONSTRAINT "business_setting_singleton" CHECK ("id" = 'singleton');
ALTER TABLE "ParkingCapacitySetting"
  ADD CONSTRAINT "parking_capacity_singleton" CHECK ("id" = 'singleton');

-- 4) TUTARLAR NEGATIF OLAMAZ
ALTER TABLE "Payment"
  ADD CONSTRAINT "payment_amount_non_negative" CHECK ("amount" >= 0);
ALTER TABLE "Expense"
  ADD CONSTRAINT "expense_amount_non_negative" CHECK ("amount" >= 0);
ALTER TABLE "Subscription"
  ADD CONSTRAINT "subscription_price_non_negative" CHECK ("agreedPrice" >= 0);
ALTER TABLE "SubscriptionPeriod"
  ADD CONSTRAINT "subscription_period_price_non_negative" CHECK ("price" >= 0);

-- 5) ABONMAN TARIH ARALIGI TUTARLI OLMALI
ALTER TABLE "Subscription"
  ADD CONSTRAINT "subscription_date_range" CHECK ("endDate" >= "startDate");
ALTER TABLE "SubscriptionPeriod"
  ADD CONSTRAINT "subscription_period_date_range" CHECK ("endDate" >= "startDate");

-- 6) PARK CIKISI GIRISTEN ONCE OLAMAZ
ALTER TABLE "ParkingSession"
  ADD CONSTRAINT "parking_exit_after_entry"
  CHECK ("exitAt" IS NULL OR "exitAt" >= "entryAt");

-- 7) TAMAMLANMIS PARK KAYDI CIKIS BILGISI TASIMAK ZORUNDA
ALTER TABLE "ParkingSession"
  ADD CONSTRAINT "parking_completed_requires_exit"
  CHECK (
    "status" <> 'COMPLETED'
    OR ("exitAt" IS NOT NULL AND "exitUserId" IS NOT NULL AND "payableAmount" IS NOT NULL)
  );

-- ===========================================================================
-- DENETIM KAYITLARI: YALNIZCA EKLEME (APPEND-ONLY)
-- Denetim kaydi degistirilemez ve silinemez; aksi halde denetim anlamsizdir.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "audit_log_append_only"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Denetim kayitlari degistirilemez veya silinemez (append-only).';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_log_no_update"
  BEFORE UPDATE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION "audit_log_append_only"();

CREATE TRIGGER "audit_log_no_delete"
  BEFORE DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION "audit_log_append_only"();

-- ===========================================================================
-- FINANSAL KAYITLAR SILINEMEZ
-- Hatali kayit VOIDED durumuna alinir ve gerekirse ters kayit uretilir.
-- Silme girisimi veritabani seviyesinde reddedilir.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "financial_record_no_delete"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Finansal kayitlar silinemez. Iptal icin status = VOIDED kullanin (tablo: %).', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "payment_no_delete"
  BEFORE DELETE ON "Payment"
  FOR EACH ROW EXECUTE FUNCTION "financial_record_no_delete"();

CREATE TRIGGER "expense_no_delete"
  BEFORE DELETE ON "Expense"
  FOR EACH ROW EXECUTE FUNCTION "financial_record_no_delete"();

CREATE TRIGGER "cash_movement_no_delete"
  BEFORE DELETE ON "CashMovement"
  FOR EACH ROW EXECUTE FUNCTION "financial_record_no_delete"();

CREATE TRIGGER "other_income_no_delete"
  BEFORE DELETE ON "OtherIncome"
  FOR EACH ROW EXECUTE FUNCTION "financial_record_no_delete"();

CREATE TRIGGER "subscription_period_no_delete"
  BEFORE DELETE ON "SubscriptionPeriod"
  FOR EACH ROW EXECUTE FUNCTION "financial_record_no_delete"();

-- Tamamlanmis park kaydi ve yikama isi de finansal kayit sayilir.
CREATE TRIGGER "parking_session_no_delete"
  BEFORE DELETE ON "ParkingSession"
  FOR EACH ROW EXECUTE FUNCTION "financial_record_no_delete"();

CREATE TRIGGER "wash_job_no_delete"
  BEFORE DELETE ON "WashJob"
  FOR EACH ROW EXECUTE FUNCTION "financial_record_no_delete"();
