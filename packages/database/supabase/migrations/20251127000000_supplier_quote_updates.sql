-- Add new status values to supplierQuoteStatus enum
ALTER TYPE "supplierQuoteStatus" ADD VALUE IF NOT EXISTS 'Sent';
ALTER TYPE "supplierQuoteStatus" ADD VALUE IF NOT EXISTS 'Ordered';
ALTER TYPE "supplierQuoteStatus" ADD VALUE IF NOT EXISTS 'Partial';
ALTER TYPE "supplierQuoteStatus" ADD VALUE IF NOT EXISTS 'Declined';
ALTER TYPE "supplierQuoteStatus" ADD VALUE IF NOT EXISTS 'Cancelled';
ALTER TYPE "supplierQuoteStatus" ADD VALUE IF NOT EXISTS 'Submitted';


-- Add externalLinkId column to supplierQuote table
ALTER TABLE "supplierQuote" ADD COLUMN IF NOT EXISTS "externalLinkId" uuid REFERENCES "externalLink"("id") ON DELETE SET NULL;


DROP VIEW IF EXISTS "supplierQuotes";
CREATE OR REPLACE VIEW "supplierQuotes"
WITH
  (SECURITY_INVOKER = true) AS
SELECT
  q.*,
  ql."thumbnailPath",
  ql."itemType"
FROM
  "supplierQuote" q
  LEFT JOIN (
    SELECT
      "supplierQuoteId",
      MIN(
        CASE
          WHEN i."thumbnailPath" IS NULL
          AND mu."thumbnailPath" IS NOT NULL THEN mu."thumbnailPath"
          ELSE i."thumbnailPath"
        END
      ) AS "thumbnailPath",
      MIN(i."type") AS "itemType"
    FROM
      "supplierQuoteLine"
      INNER JOIN "item" i ON i."id" = "supplierQuoteLine"."itemId"
      LEFT JOIN "modelUpload" mu ON mu.id = i."modelUploadId"
    GROUP BY
      "supplierQuoteId"
  ) ql ON ql."supplierQuoteId" = q.id;


-- View
DROP POLICY IF EXISTS "Employees with purchasing_view can view purchasing-related external links" ON "externalLink";
CREATE POLICY "Employees with purchasing_view can view purchasing-related external links" ON "externalLink"
  FOR SELECT
  USING (
    "documentType" = 'SupplierQuote' AND
    has_role('employee', "companyId") AND
    has_company_permission('purchasing_view', "companyId")
  );

-- Insert
DROP POLICY IF EXISTS "Employees with purchasing_create can insert purchasing-related external links" ON "externalLink";
CREATE POLICY "Employees with purchasing_create can insert purchasing-related external links" ON "externalLink"
  FOR INSERT
  WITH CHECK (
    "documentType" = 'SupplierQuote' AND
    has_role('employee', "companyId") AND
    has_company_permission('purchasing_create', "companyId")
  );

-- Update
DROP POLICY IF EXISTS "Employees with purchasing_update can update purchasing-related external links" ON "externalLink";
CREATE POLICY "Employees with purchasing_update can update purchasing-related external links" ON "externalLink"
  FOR UPDATE
  USING (
    "documentType" = 'SupplierQuote' AND
    has_role('employee', "companyId") AND
    has_company_permission('purchasing_update', "companyId")
  );

-- Delete
DROP POLICY IF EXISTS "Employees with purchasing_delete can delete purchasing-related external links" ON "externalLink";
CREATE POLICY "Employees with purchasing_delete can delete purchasing-related external links" ON "externalLink"
  FOR DELETE
  USING (
    "documentType" = 'SupplierQuote' AND
    has_role('employee', "companyId") AND
    has_company_permission('purchasing_delete', "companyId")
  );
