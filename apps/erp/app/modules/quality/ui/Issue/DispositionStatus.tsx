import { Status } from "@carbon/react";

export function DispositionStatus({ disposition }: { disposition: string }) {
  switch (disposition) {
    case "Conditional Acceptance":
      return <Status color="blue">Conditional Acceptance</Status>;
    case "Deviation Accepted":
      return <Status color="green">Deviation Accepted</Status>;
    case "Hold":
      return <Status color="yellow">Hold</Status>;
    case "No Action Required":
      return <Status color="blue">No Action Required</Status>;
    case "Pending":
      return <Status color="orange">Pending</Status>;
    case "Quarantine":
      return <Status color="red">Quarantine</Status>;
    case "Repair":
      return <Status color="yellow">Repair</Status>;
    case "Return to Supplier":
      return <Status color="red">Return to Supplier</Status>;
    case "Rework":
      return <Status color="yellow">Rework</Status>;
    case "Scrap":
      return <Status color="red">Scrap</Status>;
    case "Use As Is":
      return <Status color="green">Use As Is</Status>;
    default:
      return <Status color="gray">{disposition}</Status>;
  }
}
