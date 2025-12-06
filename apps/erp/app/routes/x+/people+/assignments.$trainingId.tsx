import { error } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { flash } from "@carbon/auth/session.server";
import {
  Badge,
  Button,
  HStack,
  MenuIcon,
  MenuItem,
  VStack,
} from "@carbon/react";
import {
  redirect,
  useFetcher,
  useLoaderData,
  useParams,
} from "@remix-run/react";
import type { LoaderFunctionArgs } from "@vercel/remix";
import { json } from "@vercel/remix";
import type { ColumnDef } from "@tanstack/react-table";
import { memo, useMemo } from "react";
import {
  LuTriangleAlert,
  LuCalendar,
  LuCircleCheck,
  LuClock,
  LuUser,
} from "react-icons/lu";
import { EmployeeAvatar, Table } from "~/components";
import { usePermissions } from "~/hooks";
import { getTraining, getTrainingAssignmentStatus } from "~/modules/people";
import type { TrainingAssignmentStatusItem } from "~/modules/people/types";
import type { Handle } from "~/utils/handle";
import { path } from "~/utils/path";
import { getGenericQueryFilters } from "~/utils/query";

export const handle: Handle = {
  breadcrumb: "Detail",
  to: path.to.trainingAssignments,
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { client, companyId } = await requirePermissions(request, {
    view: "people",
    role: "employee",
  });

  const { trainingId } = params;
  if (!trainingId) {
    throw redirect(
      path.to.trainingAssignments,
      await flash(request, error(null, "Training ID is required"))
    );
  }

  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);
  const search = searchParams.get("search");
  const status = searchParams.get("status") as
    | "Completed"
    | "Pending"
    | "Overdue"
    | "Not Required"
    | null;
  const { limit, offset, sorts, filters } =
    getGenericQueryFilters(searchParams);

  const [training, assignmentStatus] = await Promise.all([
    getTraining(client, trainingId),
    getTrainingAssignmentStatus(client, companyId, {
      trainingId,
      status: status ?? undefined,
      search: search ?? undefined,
      limit,
      offset,
      sorts,
      filters,
    }),
  ]);

  if (training.error) {
    throw redirect(
      path.to.trainingAssignments,
      await flash(request, error(training.error, "Error loading training"))
    );
  }

  if (assignmentStatus.error) {
    throw redirect(
      path.to.trainingAssignments,
      await flash(
        request,
        error(assignmentStatus.error, "Error loading assignment status")
      )
    );
  }

  return json({
    training: training.data,
    assignments: (assignmentStatus.data ??
      []) as TrainingAssignmentStatusItem[],
    count: assignmentStatus.count ?? 0,
  });
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "Completed":
      return (
        <Badge variant="green">
          <LuCircleCheck className="mr-1" />
          Completed
        </Badge>
      );
    case "Pending":
      return (
        <Badge variant="secondary">
          <LuClock className="mr-1" />
          Pending
        </Badge>
      );
    case "Overdue":
      return (
        <Badge variant="red">
          <LuTriangleAlert className="mr-1" />
          Overdue
        </Badge>
      );
    case "Not Required":
      return <Badge variant="outline">Not Required</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

const TrainingAssignmentDetailTable = memo(
  ({
    data,
    count,
    trainingId,
    currentPeriod,
  }: {
    data: TrainingAssignmentStatusItem[];
    count: number;
    trainingId: string;
    currentPeriod: string | null;
  }) => {
    const permissions = usePermissions();

    const columns = useMemo<ColumnDef<TrainingAssignmentStatusItem>[]>(
      () => [
        {
          accessorKey: "employeeName",
          header: "Employee",
          cell: ({ row }) => (
            <HStack spacing={2}>
              <EmployeeAvatar employeeId={row.original.employeeId} />
              <span>{row.original.employeeName}</span>
            </HStack>
          ),
          meta: {
            icon: <LuUser />,
          },
        },
        {
          accessorKey: "employeeStartDate",
          header: "Start Date",
          cell: ({ row }) =>
            row.original.employeeStartDate
              ? new Date(row.original.employeeStartDate).toLocaleDateString()
              : "-",
          meta: {
            icon: <LuCalendar />,
          },
        },
        {
          accessorKey: "status",
          header: "Status",
          cell: ({ row }) => <StatusBadge status={row.original.status} />,
          meta: {
            filter: {
              type: "static",
              options: [
                { value: "Completed", label: "Completed" },
                { value: "Pending", label: "Pending" },
                { value: "Overdue", label: "Overdue" },
                { value: "Not Required", label: "Not Required" },
              ],
            },
          },
        },
        {
          accessorKey: "completedAt",
          header: "Completed At",
          cell: ({ row }) =>
            row.original.completedAt
              ? new Date(row.original.completedAt).toLocaleDateString()
              : "-",
          meta: {
            icon: <LuClock />,
          },
        },
        {
          id: "actions",
          header: "",
          cell: ({ row }) => {
            if (
              row.original.status === "Completed" ||
              row.original.status === "Not Required"
            ) {
              return null;
            }
            return (
              <MarkCompleteButton
                trainingAssignmentId={row.original.trainingAssignmentId}
                employeeId={row.original.employeeId}
                period={currentPeriod}
                disabled={!permissions.can("update", "people")}
              />
            );
          },
        },
      ],
      [permissions, currentPeriod]
    );

    const renderContextMenu = useMemo(() => {
      return (row: TrainingAssignmentStatusItem) => {
        if (row.status === "Completed" || row.status === "Not Required") {
          return null;
        }
        return (
          <MarkCompleteMenuItem
            trainingAssignmentId={row.trainingAssignmentId}
            employeeId={row.employeeId}
            period={currentPeriod}
            disabled={!permissions.can("update", "people")}
          />
        );
      };
    }, [permissions, currentPeriod]);

    return (
      <Table<TrainingAssignmentStatusItem>
        data={data}
        columns={columns}
        count={count}
        title="Employee Status"
        table="trainingAssignmentStatus"
        renderContextMenu={renderContextMenu}
      />
    );
  }
);

TrainingAssignmentDetailTable.displayName = "TrainingAssignmentDetailTable";

function MarkCompleteButton({
  trainingAssignmentId,
  employeeId,
  period,
  disabled,
}: {
  trainingAssignmentId: number;
  employeeId: string;
  period: string | null;
  disabled: boolean;
}) {
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state !== "idle";

  return (
    <fetcher.Form method="post" action={path.to.markTrainingComplete}>
      <input
        type="hidden"
        name="trainingAssignmentId"
        value={trainingAssignmentId}
      />
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="period" value={period ?? ""} />
      <Button
        type="submit"
        variant="secondary"
        size="sm"
        disabled={disabled || isSubmitting}
        isLoading={isSubmitting}
        leftIcon={<LuCircleCheck />}
      >
        Mark Complete
      </Button>
    </fetcher.Form>
  );
}

function MarkCompleteMenuItem({
  trainingAssignmentId,
  employeeId,
  period,
  disabled,
}: {
  trainingAssignmentId: number;
  employeeId: string;
  period: string | null;
  disabled: boolean;
}) {
  const fetcher = useFetcher();

  return (
    <MenuItem
      disabled={disabled}
      onClick={() => {
        fetcher.submit(
          {
            trainingAssignmentId: trainingAssignmentId.toString(),
            employeeId,
            period: period ?? "",
          },
          { method: "post", action: path.to.markTrainingComplete }
        );
      }}
    >
      <MenuIcon icon={<LuCircleCheck />} />
      Mark Complete
    </MenuItem>
  );
}

export default function TrainingAssignmentDetailRoute() {
  const { training, assignments, count } = useLoaderData<typeof loader>();
  const params = useParams();

  const currentPeriod =
    assignments.length > 0 ? assignments[0].currentPeriod : null;

  return (
    <VStack spacing={4} className="h-full p-4">
      <HStack className="w-full justify-between">
        <HStack spacing={2}>
          <h1 className="text-xl font-semibold">{training?.name}</h1>
          {currentPeriod && <Badge variant="secondary">{currentPeriod}</Badge>}
        </HStack>
      </HStack>
      <TrainingAssignmentDetailTable
        data={assignments}
        count={count}
        trainingId={params.trainingId!}
        currentPeriod={currentPeriod}
      />
    </VStack>
  );
}
