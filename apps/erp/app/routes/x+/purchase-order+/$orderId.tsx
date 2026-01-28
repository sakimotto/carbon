import { error, getCarbonServiceRole } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { flash } from "@carbon/auth/session.server";
import { VStack } from "@carbon/react";
import type { LoaderFunctionArgs } from "react-router";
import { Outlet, redirect, useParams } from "react-router";
import { PanelProvider, ResizablePanels } from "~/components/Layout/Panels";
import {
  canApproveRequest,
  canCancelRequest,
  getLatestApprovalRequestForDocument
} from "~/modules/approvals";
import {
  getPurchaseOrder,
  getPurchaseOrderDelivery,
  getPurchaseOrderLines,
  getSupplier,
  getSupplierInteraction,
  getSupplierInteractionDocuments
} from "~/modules/purchasing";
import {
  PurchaseOrderExplorer,
  PurchaseOrderHeader,
  PurchaseOrderProperties
} from "~/modules/purchasing/ui/PurchaseOrder";

import type { Handle } from "~/utils/handle";
import { path } from "~/utils/path";

export const handle: Handle = {
  breadcrumb: "Orders",
  to: path.to.purchaseOrders,
  module: "purchasing"
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { client, companyId, userId } = await requirePermissions(request, {
    view: "purchasing",
    bypassRls: true
  });

  const { orderId } = params;
  if (!orderId) throw new Error("Could not find orderId");

  const [purchaseOrder, lines, purchaseOrderDelivery] = await Promise.all([
    getPurchaseOrder(client, orderId),
    getPurchaseOrderLines(client, orderId),
    getPurchaseOrderDelivery(client, orderId)
  ]);

  if (purchaseOrder.data?.companyId !== companyId) {
    throw redirect(
      path.to.purchaseOrders,
      await flash(
        request,
        error("You are not authorized to view this purchase order")
      )
    );
  }

  if (purchaseOrder.error) {
    throw redirect(
      path.to.items,
      await flash(
        request,
        error(purchaseOrder.error, "Failed to load purchaseOrder")
      )
    );
  }

  if (companyId !== purchaseOrder.data?.companyId) {
    throw redirect(path.to.purchaseOrders);
  }

  const serviceRole = getCarbonServiceRole();
  const [supplier, interaction, approvalRequest] = await Promise.all([
    purchaseOrder.data?.supplierId
      ? getSupplier(client, purchaseOrder.data.supplierId)
      : null,
    getSupplierInteraction(client, purchaseOrder.data.supplierInteractionId),
    // Only fetch approval request if status is "Needs Approval"
    purchaseOrder.data?.status === "Needs Approval"
      ? getLatestApprovalRequestForDocument(
          serviceRole,
          "purchaseOrder",
          orderId
        )
      : Promise.resolve({ data: null, error: null })
  ]);

  // Check if user can approve the request
  let canApprove = false;
  let canReopen = true; // Default to true (no approval request = can reopen)
  let canDelete = true; // Default to true (no approval request = can delete)

  if (
    approvalRequest.data &&
    purchaseOrder.data?.status === "Needs Approval" &&
    approvalRequest.data.status === "Pending" &&
    approvalRequest.data.requestedBy
  ) {
    const requestedBy = approvalRequest.data.requestedBy;
    const status = approvalRequest.data.status;

    canApprove = await canApproveRequest(
      serviceRole,
      {
        amount: approvalRequest.data.amount,
        documentType: approvalRequest.data.documentType,
        companyId: approvalRequest.data.companyId
      },
      userId
    );

    // Check if user can reopen: must be requester OR approver
    const isRequester = canCancelRequest(
      {
        requestedBy,
        status
      },
      userId
    );
    const isApprover = canApprove;
    canReopen = isRequester || isApprover;

    // Check if user can delete: only requester can delete POs in "Needs Approval"
    // Approvers should reject instead, normal users have no permission
    canDelete = isRequester;
  }

  return {
    purchaseOrder: purchaseOrder.data,
    purchaseOrderDelivery: purchaseOrderDelivery.data,
    lines: lines.data ?? [],
    files: getSupplierInteractionDocuments(
      client,
      companyId,
      purchaseOrder.data.supplierInteractionId!
    ),
    interaction: interaction?.data,
    supplier: supplier?.data ?? null,
    approvalRequest: approvalRequest.data,
    canApprove,
    canReopen,
    canDelete
  };
}

export default function PurchaseOrderRoute() {
  const params = useParams();
  const { orderId } = params;
  if (!orderId) throw new Error("Could not find orderId");

  return (
    <PanelProvider>
      <div className="flex flex-col h-[calc(100dvh-49px)] overflow-hidden w-full">
        <PurchaseOrderHeader />
        <div className="flex h-[calc(100dvh-99px)] overflow-hidden w-full">
          <div className="flex flex-grow overflow-hidden">
            <ResizablePanels
              explorer={<PurchaseOrderExplorer />}
              content={
                <div className="h-[calc(100dvh-99px)] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-accent w-full">
                  <VStack spacing={2} className="p-2">
                    <Outlet />
                  </VStack>
                </div>
              }
              properties={<PurchaseOrderProperties />}
            />
          </div>
        </div>
      </div>
    </PanelProvider>
  );
}
