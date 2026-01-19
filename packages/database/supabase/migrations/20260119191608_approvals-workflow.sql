-- Approvals System Migration
-- This migration creates tables for a unified approval workflow system

-- Create approval status enum
CREATE TYPE "approvalStatus" AS ENUM ('Pending', 'Approved', 'Rejected', 'Cancelled');

-- Create approval document type enum
CREATE TYPE "approvalDocumentType" AS ENUM ('purchaseOrder', 'qualityDocument');

-- Core approval request table
CREATE TABLE "approvalRequest" (
  "id" TEXT NOT NULL DEFAULT id('apr'),
  "documentType" "approvalDocumentType" NOT NULL,
  "documentId" TEXT NOT NULL,
  "status" "approvalStatus" NOT NULL DEFAULT 'Pending',
  "requestedBy" TEXT NOT NULL,
  "requestedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "approverGroupId" TEXT,
  "approverId" TEXT,
  "decisionBy" TEXT,
  "decisionAt" TIMESTAMP WITH TIME ZONE,
  "decisionNotes" TEXT,
  "companyId" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMP WITH TIME ZONE,

  CONSTRAINT "approvalRequest_pkey" PRIMARY KEY ("id", "companyId"),
  CONSTRAINT "approvalRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "approvalRequest_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "user"("id"),
  CONSTRAINT "approvalRequest_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "user"("id"),
  CONSTRAINT "approvalRequest_decisionBy_fkey" FOREIGN KEY ("decisionBy") REFERENCES "user"("id"),
  CONSTRAINT "approvalRequest_approverGroupId_fkey" FOREIGN KEY ("approverGroupId") REFERENCES "group"("id") ON DELETE SET NULL,
  CONSTRAINT "approvalRequest_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "user"("id"),
  CONSTRAINT "approvalRequest_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "user"("id")
);

-- Indexes for approval requests
CREATE INDEX "approvalRequest_companyId_idx" ON "approvalRequest"("companyId");
CREATE INDEX "approvalRequest_documentType_idx" ON "approvalRequest"("documentType");
CREATE INDEX "approvalRequest_documentId_idx" ON "approvalRequest"("documentId");
CREATE INDEX "approvalRequest_status_idx" ON "approvalRequest"("status");
CREATE INDEX "approvalRequest_requestedBy_idx" ON "approvalRequest"("requestedBy");
CREATE INDEX "approvalRequest_approverId_idx" ON "approvalRequest"("approverId");
CREATE INDEX "approvalRequest_approverGroupId_idx" ON "approvalRequest"("approverGroupId");

-- Approval configuration per document type
CREATE TABLE "approvalConfiguration" (
  "id" TEXT NOT NULL DEFAULT id('apc'),
  "documentType" "approvalDocumentType" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "approverGroupId" TEXT,
  "defaultApproverId" TEXT,
  "thresholdAmount" NUMERIC,
  "escalationDays" INTEGER,
  "companyId" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMP WITH TIME ZONE,

  CONSTRAINT "approvalConfiguration_pkey" PRIMARY KEY ("id", "companyId"),
  CONSTRAINT "approvalConfiguration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "approvalConfiguration_approverGroupId_fkey" FOREIGN KEY ("approverGroupId") REFERENCES "group"("id") ON DELETE SET NULL,
  CONSTRAINT "approvalConfiguration_defaultApproverId_fkey" FOREIGN KEY ("defaultApproverId") REFERENCES "user"("id") ON DELETE SET NULL,
  CONSTRAINT "approvalConfiguration_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "user"("id"),
  CONSTRAINT "approvalConfiguration_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "user"("id"),
  -- Ensure only one configuration per document type per company
  CONSTRAINT "approvalConfiguration_companyId_documentType_key" UNIQUE ("companyId", "documentType")
);

-- Indexes for approval configuration
CREATE INDEX "approvalConfiguration_companyId_idx" ON "approvalConfiguration"("companyId");
CREATE INDEX "approvalConfiguration_documentType_idx" ON "approvalConfiguration"("documentType");

-- View for approval requests with related data
CREATE OR REPLACE VIEW "approvalRequests" WITH (SECURITY_INVOKER=true) AS
SELECT
  ar."id",
  ar."documentType",
  ar."documentId",
  ar."status",
  ar."requestedBy",
  ar."requestedAt",
  ar."approverGroupId",
  ar."approverId",
  ar."decisionBy",
  ar."decisionAt",
  ar."decisionNotes",
  ar."companyId",
  ar."createdAt",
  -- Get document readable ID based on type
  CASE
    WHEN ar."documentType" = 'purchaseOrder' THEN po."purchaseOrderId"
    WHEN ar."documentType" = 'qualityDocument' THEN qd."name"
    ELSE NULL
  END AS "documentReadableId",
  -- Get document name/description
  CASE
    WHEN ar."documentType" = 'purchaseOrder' THEN s."name"
    WHEN ar."documentType" = 'qualityDocument' THEN qd."description"
    ELSE NULL
  END AS "documentDescription",
  -- Requester info
  ru."fullName" AS "requestedByName",
  ru."avatarUrl" AS "requestedByAvatarUrl",
  -- Approver info
  au."fullName" AS "approverName",
  au."avatarUrl" AS "approverAvatarUrl",
  -- Decision maker info
  du."fullName" AS "decisionByName",
  du."avatarUrl" AS "decisionByAvatarUrl",
  -- Group info
  g."name" AS "approverGroupName"
FROM "approvalRequest" ar
LEFT JOIN "purchaseOrder" po ON ar."documentType" = 'purchaseOrder' AND ar."documentId" = po."id"
LEFT JOIN "supplier" s ON po."supplierId" = s."id"
LEFT JOIN "qualityDocument" qd ON ar."documentType" = 'qualityDocument' AND ar."documentId" = qd."id"
LEFT JOIN "user" ru ON ar."requestedBy" = ru."id"
LEFT JOIN "user" au ON ar."approverId" = au."id"
LEFT JOIN "user" du ON ar."decisionBy" = du."id"
LEFT JOIN "group" g ON ar."approverGroupId" = g."id";

-- Enable RLS on approvalRequest
ALTER TABLE "approvalRequest" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SELECT" ON "public"."approvalRequest"
FOR SELECT USING (
  "companyId" = ANY (
    (
      SELECT get_companies_with_employee_permission('approvals_view')
    )::text[]
  )
);

CREATE POLICY "INSERT" ON "public"."approvalRequest"
FOR INSERT WITH CHECK (
  "companyId" = ANY (
    (
      SELECT get_companies_with_employee_permission('approvals_create')
    )::text[]
  )
);

CREATE POLICY "UPDATE" ON "public"."approvalRequest"
FOR UPDATE USING (
  "companyId" = ANY (
    (
      SELECT get_companies_with_employee_permission('approvals_update')
    )::text[]
  )
);

CREATE POLICY "DELETE" ON "public"."approvalRequest"
FOR DELETE USING (
  "companyId" = ANY (
    (
      SELECT get_companies_with_employee_permission('approvals_delete')
    )::text[]
  )
);

-- Enable RLS on approvalConfiguration
ALTER TABLE "approvalConfiguration" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SELECT" ON "public"."approvalConfiguration"
FOR SELECT USING (
  "companyId" = ANY (
    (
      SELECT get_companies_with_employee_permission('approvals_view')
    )::text[]
  )
);

CREATE POLICY "INSERT" ON "public"."approvalConfiguration"
FOR INSERT WITH CHECK (
  "companyId" = ANY (
    (
      SELECT get_companies_with_employee_permission('approvals_configure')
    )::text[]
  )
);

CREATE POLICY "UPDATE" ON "public"."approvalConfiguration"
FOR UPDATE USING (
  "companyId" = ANY (
    (
      SELECT get_companies_with_employee_permission('approvals_configure')
    )::text[]
  )
);

CREATE POLICY "DELETE" ON "public"."approvalConfiguration"
FOR DELETE USING (
  "companyId" = ANY (
    (
      SELECT get_companies_with_employee_permission('approvals_configure')
    )::text[]
  )
);

-- Add Approvals to the module enum
ALTER TYPE module ADD VALUE 'Approvals';

COMMIT;

-- Recreate the modules view
DROP VIEW IF EXISTS "modules";
CREATE VIEW "modules" AS
    SELECT unnest(enum_range(NULL::module)) AS name;

-- Insert Approvals module permissions for Admin and Management employee types
INSERT INTO "employeeTypePermission" ("employeeTypeId", "module", "create", "delete", "update", "view")
SELECT 
    et.id AS "employeeTypeId", 
    'Approvals'::module AS "module",
    ARRAY[et."companyId"] AS "create",
    ARRAY[et."companyId"] AS "delete",
    ARRAY[et."companyId"] AS "update",
    ARRAY[et."companyId"] AS "view"
FROM "employeeType" et
WHERE et.name IN ('Admin', 'Management')
ON CONFLICT ("employeeTypeId", "module") DO NOTHING;

-- Update userPermission table to add Approvals module permissions
-- Users with purchasing or quality permissions get approvals permissions
UPDATE "userPermission"
SET "permissions" = "permissions" || jsonb_build_object(
  'approvals_view', COALESCE("permissions"->'purchasing_view', '[]'::jsonb),
  'approvals_create', COALESCE("permissions"->'purchasing_create', '[]'::jsonb),
  'approvals_update', COALESCE("permissions"->'purchasing_update', '[]'::jsonb),
  'approvals_delete', COALESCE("permissions"->'purchasing_delete', '[]'::jsonb)
);
