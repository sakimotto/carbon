import {
  Badge,
  HStack,
  MenuIcon,
  MenuItem,
  useDisclosure
} from "@carbon/react";
import { formatDate } from "@carbon/utils";
import type { ColumnDef } from "@tanstack/react-table";
import { memo, useCallback, useMemo, useState } from "react";
import {
  LuCalendar,
  LuCheck,
  LuFileText,
  LuStar,
  LuUser,
  LuX
} from "react-icons/lu";
import { EmployeeAvatar, Hyperlink, Table } from "~/components";
import type { ApprovalRequest } from "~/modules/approvals";
import { approvalDocumentType, approvalStatusType } from "~/modules/approvals";
import { usePeople } from "~/stores";
import { path } from "~/utils/path";
import ApprovalDecisionModal from "./ApprovalDecisionModal";
import ApprovalStatus from "./ApprovalStatus";

type ApprovalsTableProps = {
  data: ApprovalRequest[];
  count: number;
};

const ApprovalsTable = memo(({ data, count }: ApprovalsTableProps) => {
  const [people] = usePeople();

  const [selectedApproval, setSelectedApproval] =
    useState<ApprovalRequest | null>(null);
  const [decisionType, setDecisionType] = useState<"approve" | "reject">(
    "approve"
  );

  const decisionModal = useDisclosure();

  const columns = useMemo<ColumnDef<ApprovalRequest>[]>(() => {
    const defaultColumns: ColumnDef<ApprovalRequest>[] = [
      {
        accessorKey: "documentReadableId",
        header: "Document",
        cell: ({ row }) => {
          const docType = row.original.documentType;
          const docId = row.original.documentId;
          const readableId = row.original.documentReadableId;
          const label = readableId ?? docId ?? "—";

          if (!docId) {
            return (
              <HStack>
                <span>{label}</span>
              </HStack>
            );
          }

          let link: string | null = null;
          if (docType === "purchaseOrder") {
            link = path.to.purchaseOrderDetails(docId);
          } else if (docType === "qualityDocument") {
            link = path.to.qualityDocument(docId);
          }

          if (!link) {
            return (
              <HStack>
                <span>{label}</span>
              </HStack>
            );
          }

          return (
            <HStack>
              <Hyperlink to={link}>{label}</Hyperlink>
            </HStack>
          );
        },
        meta: {
          icon: <LuFileText />
        }
      },
      {
        accessorKey: "documentType",
        header: "Type",
        cell: ({ row }) => {
          const type = row.original.documentType;
          return (
            <Badge variant="secondary">
              {type === "purchaseOrder" ? "Purchase Order" : "Quality Document"}
            </Badge>
          );
        },
        meta: {
          filter: {
            type: "static",
            options: approvalDocumentType.map((type) => ({
              value: type,
              label:
                type === "purchaseOrder" ? "Purchase Order" : "Quality Document"
            }))
          },
          pluralHeader: "Document Types",
          icon: <LuFileText />
        }
      },
      {
        accessorKey: "documentDescription",
        header: "Description",
        cell: (item) => item.getValue(),
        meta: {
          icon: <LuFileText />
        }
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          return <ApprovalStatus status={row.original.status} />;
        },
        meta: {
          filter: {
            type: "static",
            options: approvalStatusType.map((status) => ({
              value: status,
              label: <ApprovalStatus status={status} />
            }))
          },
          pluralHeader: "Statuses",
          icon: <LuStar />
        }
      },
      {
        id: "requestedByName",
        header: "Requested By",
        cell: ({ row }) => (
          <EmployeeAvatar employeeId={row.original.requestedBy} />
        ),
        meta: {
          filter: {
            type: "static",
            options: people.map((employee) => ({
              value: employee.id,
              label: employee.name
            }))
          },
          icon: <LuUser />
        }
      },
      {
        accessorKey: "requestedAt",
        header: "Requested Date",
        cell: (item) => formatDate(item.getValue<string>()),
        meta: {
          icon: <LuCalendar />
        }
      },
      {
        id: "approverName",
        header: "Approver",
        cell: ({ row }) => {
          if (row.original.approverId) {
            return <EmployeeAvatar employeeId={row.original.approverId} />;
          }
          return null;
        },
        meta: {
          icon: <LuUser />
        }
      },
      {
        accessorKey: "decisionAt",
        header: "Decision Date",
        cell: (item) => formatDate(item.getValue<string>()),
        meta: {
          icon: <LuCalendar />
        }
      },
      {
        id: "decisionByName",
        header: "Decided By",
        cell: ({ row }) => (
          <EmployeeAvatar employeeId={row.original.decisionBy} />
        ),
        meta: {
          icon: <LuUser />
        }
      },
      {
        accessorKey: "decisionNotes",
        header: "Notes",
        cell: (item) => item.getValue(),
        meta: {
          icon: <LuFileText />
        }
      }
    ];

    return defaultColumns;
  }, [people]);

  const renderContextMenu = useCallback(
    (row: ApprovalRequest) => (
      <>
        <MenuItem
          disabled={row.status !== "Pending"}
          onClick={() => {
            setSelectedApproval(row);
            setDecisionType("approve");
            decisionModal.onOpen();
          }}
        >
          <MenuIcon icon={<LuCheck />} />
          Approve
        </MenuItem>
        <MenuItem
          disabled={row.status !== "Pending"}
          onClick={() => {
            setSelectedApproval(row);
            setDecisionType("reject");
            decisionModal.onOpen();
          }}
        >
          <MenuIcon icon={<LuX />} />
          Reject
        </MenuItem>
      </>
    ),
    [decisionModal]
  );

  return (
    <>
      <Table<ApprovalRequest>
        count={count}
        columns={columns}
        data={data}
        defaultColumnPinning={{
          left: ["documentReadableId"]
        }}
        defaultColumnVisibility={{
          decisionNotes: false,
          decisionAt: false,
          decisionByName: false
        }}
        renderContextMenu={renderContextMenu}
        title="Approvals Requests"
        table="approvalRequest"
        withSavedView
      />

      {selectedApproval?.id && (
        <ApprovalDecisionModal
          approval={selectedApproval}
          decisionType={decisionType}
          isOpen={decisionModal.isOpen}
          onClose={() => {
            decisionModal.onClose();
            setSelectedApproval(null);
          }}
        />
      )}
    </>
  );
});
ApprovalsTable.displayName = "ApprovalsTable";

export default ApprovalsTable;
