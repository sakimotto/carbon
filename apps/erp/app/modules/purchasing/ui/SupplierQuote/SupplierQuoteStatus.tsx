import { Status } from "@carbon/react";
import type { supplierQuoteStatusType } from "../../purchasing.models";

type SupplierQuoteStatusProps = {
  status?: (typeof supplierQuoteStatusType)[number] | null;
};

const SupplierQuoteStatus = ({ status }: SupplierQuoteStatusProps) => {
  switch (status) {
    case "Active":
      return <Status color="green">{status}</Status>;
    case "Draft":
      return <Status color="gray">{status}</Status>;
    case "Declined":
      return <Status color="orange">{status}</Status>;
    case "Expired":
    case "Cancelled":
      return <Status color="red">{status}</Status>;
    default:
      return null;
  }
};

export default SupplierQuoteStatus;
