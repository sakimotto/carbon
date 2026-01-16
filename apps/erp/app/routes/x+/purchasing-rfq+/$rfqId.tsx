import { error, getCarbonServiceRole } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { flash } from "@carbon/auth/session.server";
import { type JSONContent, VStack } from "@carbon/react";
import type { LoaderFunctionArgs } from "react-router";
import { Outlet, redirect, useParams } from "react-router";
import { PanelProvider, ResizablePanels } from "~/components/Layout/Panels";
import type { PurchasingRFQLine } from "~/modules/purchasing";
import {
  getLinkedSupplierQuotes,
  getPurchasingRFQ,
  getPurchasingRFQLines,
  getPurchasingRFQSuppliers,
  getSupplierInteractionDocuments
} from "~/modules/purchasing";
import {
  PurchasingRFQExplorer,
  PurchasingRFQHeader,
  PurchasingRFQProperties
} from "~/modules/purchasing/ui/PurchasingRfq";
import type { Handle } from "~/utils/handle";
import { path } from "~/utils/path";

export const handle: Handle = {
  breadcrumb: "RFQs",
  to: path.to.purchasingRfqs
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { companyId } = await requirePermissions(request, {
    view: "purchasing"
  });

  const { rfqId } = params;
  if (!rfqId) throw new Error("Could not find rfqId");

  const serviceRole = await getCarbonServiceRole();

  const [rfqSummary, lines, suppliers, linkedQuotes] = await Promise.all([
    getPurchasingRFQ(serviceRole, rfqId),
    getPurchasingRFQLines(serviceRole, rfqId),
    getPurchasingRFQSuppliers(serviceRole, rfqId),
    getLinkedSupplierQuotes(serviceRole, rfqId)
  ]);

  if (rfqSummary.error) {
    throw redirect(
      path.to.purchasingRfqs,
      await flash(
        request,
        error(rfqSummary.error, "Failed to load purchasing RFQ summary")
      )
    );
  }

  if (lines.error) {
    throw redirect(
      path.to.purchasingRfqs,
      await flash(request, error(lines.error, "Failed to load RFQ lines"))
    );
  }

  // Extract supplier quotes from the linked data
  const supplierQuotes =
    linkedQuotes.data?.map((link) => link.supplierQuote).filter(Boolean) ?? [];

  return {
    rfqSummary: rfqSummary.data,
    lines:
      lines.data.map((line: PurchasingRFQLine) => ({
        ...line,
        id: line.id ?? "",
        order: line.order ?? 0,
        unitOfMeasureCode: line.unitOfMeasureCode ?? "",
        description: line.description ?? "",
        externalNotes: (line.externalNotes ?? {}) as JSONContent,
        internalNotes: (line.internalNotes ?? {}) as JSONContent,
        itemId: line.itemId ?? "",
        quantity: line.quantity ?? [1]
      })) ?? [],
    suppliers: suppliers.data ?? [],
    linkedQuotes: supplierQuotes,
    // Use rfqId as the interaction ID for document storage
    files: getSupplierInteractionDocuments(serviceRole, companyId, rfqId)
  };
}

export default function PurchasingRFQRoute() {
  const { rfqId } = useParams();
  if (!rfqId) throw new Error("Could not find rfqId");

  return (
    <PanelProvider>
      <div className="flex flex-col h-[calc(100dvh-49px)] overflow-hidden w-full">
        <PurchasingRFQHeader />
        <div className="flex h-[calc(100dvh-99px)] overflow-hidden w-full">
          <div className="flex flex-grow overflow-hidden">
            <ResizablePanels
              explorer={<PurchasingRFQExplorer />}
              content={
                <div className="h-[calc(100dvh-99px)] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-accent w-full">
                  <VStack spacing={2} className="p-2">
                    <Outlet />
                  </VStack>
                </div>
              }
              properties={<PurchasingRFQProperties />}
            />
          </div>
        </div>
      </div>
    </PanelProvider>
  );
}
