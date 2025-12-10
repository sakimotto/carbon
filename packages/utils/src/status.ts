import type { Database } from "@carbon/database";

type SalesOrderLine = Pick<
  Database["public"]["Tables"]["salesOrderLine"]["Row"],
  "salesOrderLineType" | "invoicedComplete" | "sentComplete"
>;

export const getSalesOrderStatus = (
  lines: Array<{
    salesOrderLineType: SalesOrderLine["salesOrderLineType"] | null;
    invoicedComplete: SalesOrderLine["invoicedComplete"] | null;
    sentComplete: SalesOrderLine["sentComplete"] | null;
  }>
) => {
  const allInvoiced = lines.every(
    (line) => line.salesOrderLineType === "Comment" || line.invoicedComplete
  );

  const allShipped = lines.every(
    (line) => line.salesOrderLineType === "Comment" || line.sentComplete
  );

  let status: Database["public"]["Tables"]["salesOrder"]["Row"]["status"] =
    "To Ship and Invoice";

  if (allInvoiced && allShipped) {
    status = "Completed";
  } else if (allShipped) {
    status = "To Invoice";
  } else if (allInvoiced) {
    status = "To Ship";
  }

  return { status, allInvoiced, allShipped };
};

type PurchaseOrderLine = Pick<
  Database["public"]["Tables"]["purchaseOrderLine"]["Row"],
  "purchaseOrderLineType" | "receivedComplete" | "invoicedComplete"
>;

export const getPurchaseOrderStatus = (
  lines: Array<{
    purchaseOrderLineType: PurchaseOrderLine["purchaseOrderLineType"] | null;
    invoicedComplete: PurchaseOrderLine["invoicedComplete"] | null;
    receivedComplete: PurchaseOrderLine["receivedComplete"] | null;
  }>
) => {
  const allInvoices = lines.every(
    (line) => line.purchaseOrderLineType === "Comment" || line.invoicedComplete
  );

  const allLinesReceived = lines.every(
    (line) => line.purchaseOrderLineType === "Comment" || line.receivedComplete
  );

  let status: Database["public"]["Tables"]["purchaseOrder"]["Row"]["status"] =
    "To Receive and Invoice";
  if (allInvoices && allLinesReceived) {
    status = "Completed";
  } else if (allInvoices) {
    status = "To Receive";
  } else if (allLinesReceived) {
    status = "To Invoice";
  }

  return { status, allInvoices, allLinesReceived };
};
