import type { Database } from "@carbon/database";
import type { z } from "zod";
import type {
  approvalRequestValidator,
  approvalRuleValidator
} from "./approvals.models";
import type {
  getApprovalRequestsByDocument,
  getApprovalRuleByAmount
} from "./approvals.service";

export type ApprovalRequest =
  Database["public"]["Views"]["approvalRequests"]["Row"];

export type ApprovalHistory = NonNullable<
  Awaited<ReturnType<typeof getApprovalRequestsByDocument>>["data"]
>;

export type ApprovalRule = NonNullable<
  Awaited<ReturnType<typeof getApprovalRuleByAmount>>["data"]
>;

export type ApprovalStatus = Database["public"]["Enums"]["approvalStatus"];

export type ApprovalDocumentType =
  Database["public"]["Enums"]["approvalDocumentType"];

export type ApprovalRequestForViewCheck = {
  requestedBy: string;
  amount: number | null;
  documentType: ApprovalDocumentType;
  companyId: string;
};

export type ApprovalRequestForApproveCheck = {
  amount: number | null;
  documentType: ApprovalDocumentType;
  companyId: string;
};

export type ApprovalRequestForCancelCheck = {
  requestedBy: string;
  status: string;
};

export type CreateApprovalRequestInput = Omit<
  z.infer<typeof approvalRequestValidator>,
  "id"
> & {
  companyId: string;
  requestedBy: string;
  createdBy: string;
};

export type UpsertApprovalRuleInput =
  | (Omit<z.infer<typeof approvalRuleValidator>, "id"> & {
      companyId: string;
      createdBy: string;
    })
  | (Omit<z.infer<typeof approvalRuleValidator>, "id"> & {
      id: string;
      updatedBy: string;
    });

export type ApprovalFilters = {
  documentType?: ApprovalDocumentType | null;
  status?: ApprovalStatus | null;
  dateFrom?: string | null;
  dateTo?: string | null;
};
