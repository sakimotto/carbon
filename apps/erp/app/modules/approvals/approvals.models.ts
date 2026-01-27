import { z } from "zod";
import { zfd } from "zod-form-data";

export const approvalStatusType = [
  "Pending",
  "Approved",
  "Rejected",
  "Cancelled"
] as const;

export const approvalDocumentType = [
  "purchaseOrder",
  "qualityDocument"
] as const;

export const approvalRequestValidator = z.object({
  id: zfd.text(z.string().optional()),
  documentType: z.enum(approvalDocumentType, {
    errorMap: () => ({ message: "Document type is required" })
  }),
  documentId: zfd.text(
    z.string().min(1, { message: "Document ID is required" })
  ),
  approverGroupIds: zfd.repeatableOfType(z.string()).optional(),
  approverId: zfd.text(z.string().optional())
});

export const approvalDecisionValidator = z.object({
  id: zfd.text(z.string().optional()),
  decision: z.enum(["Approved", "Rejected"], {
    errorMap: () => ({ message: "Decision is required" })
  }),
  decisionNotes: zfd.text(z.string().optional())
});

export const approvalRuleValidator = z.object({
  id: zfd.text(z.string().optional()),
  name: z
    .string()
    .min(1, { message: "Rule name is required" })
    .max(100, { message: "Rule name must be 100 characters or less" }),
  documentType: z.enum(approvalDocumentType, {
    errorMap: () => ({ message: "Document type is required" })
  }),
  enabled: zfd.checkbox(),
  approverGroupIds: zfd.repeatableOfType(z.string()).optional(),
  defaultApproverId: zfd.text(z.string().optional()),
  lowerBoundAmount: zfd.numeric(z.number().min(0).default(0)),
  upperBoundAmount: zfd.numeric(z.number().min(0).nullable()).optional(),
  escalationDays: zfd.numeric(z.number().min(0).optional())
});

export const approvalFiltersValidator = z.object({
  documentType: z.enum(approvalDocumentType, {
    errorMap: () => ({ message: "Document type is required" })
  }),
  status: zfd.text(z.string().optional()),
  dateFrom: zfd.text(z.string().optional()),
  dateTo: zfd.text(z.string().optional())
});
