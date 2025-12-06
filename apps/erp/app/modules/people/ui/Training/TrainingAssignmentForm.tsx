import { Select, ValidatedForm } from "@carbon/form";
import {
  Badge,
  Button,
  HStack,
  ModalDrawer,
  ModalDrawerBody,
  ModalDrawerContent,
  ModalDrawerFooter,
  ModalDrawerHeader,
  ModalDrawerProvider,
  ModalDrawerTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  VStack,
} from "@carbon/react";
import { useFetcher } from "@remix-run/react";
import { memo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  LuTriangleAlert,
  LuCalendar,
  LuCircleCheck,
  LuClock,
  LuUser,
} from "react-icons/lu";
import type { z } from "zod/v3";
import { EmployeeAvatar, Table } from "~/components";
import { Hidden, Submit, Users } from "~/components/Form";
import { usePermissions } from "~/hooks";
import { trainingAssignmentValidator } from "~/modules/people";
import type {
  TrainingAssignmentStatusItem,
  TrainingListItem,
} from "~/modules/people/types";
import { path } from "~/utils/path";

type TrainingAssignmentFormProps = {
  initialValues: z.infer<typeof trainingAssignmentValidator>;
  trainings: TrainingListItem[];
  assignmentStatus?: TrainingAssignmentStatusItem[];
  currentPeriod?: string | null;
  open?: boolean;
  onClose: () => void;
};

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

const StatusTable = memo(
  ({
    data,
    currentPeriod,
  }: {
    data: TrainingAssignmentStatusItem[];
    currentPeriod: string | null;
  }) => {
    const permissions = usePermissions();
    const fetcher = useFetcher();

    const columns: ColumnDef<TrainingAssignmentStatusItem>[] = [
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
          const isSubmitting = fetcher.state !== "idle";
          return (
            <fetcher.Form method="post" action={path.to.markTrainingComplete}>
              <input
                type="hidden"
                name="trainingAssignmentId"
                value={row.original.trainingAssignmentId}
              />
              <input
                type="hidden"
                name="employeeId"
                value={row.original.employeeId}
              />
              <input type="hidden" name="period" value={currentPeriod ?? ""} />
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                leftIcon={<LuCircleCheck />}
                disabled={!permissions.can("update", "people") || isSubmitting}
                isLoading={isSubmitting}
              >
                Mark Complete
              </Button>
            </fetcher.Form>
          );
        },
      },
    ];

    return (
      <Table<TrainingAssignmentStatusItem>
        data={data}
        columns={columns}
        count={data.length}
        withPagination={false}
      />
    );
  }
);

StatusTable.displayName = "StatusTable";

const TrainingAssignmentForm = ({
  initialValues,
  trainings,
  assignmentStatus = [],
  currentPeriod = null,
  open = true,
  onClose,
}: TrainingAssignmentFormProps) => {
  const permissions = usePermissions();
  const fetcher = useFetcher();

  const isEditing = initialValues.id !== undefined;
  const isDisabled = isEditing
    ? !permissions.can("update", "people")
    : !permissions.can("create", "people");

  const [activeTab, setActiveTab] = useState<string>("details");

  return (
    <ModalDrawerProvider type="drawer">
      <ModalDrawer
        open={open}
        onOpenChange={(open) => {
          if (!open) onClose?.();
        }}
      >
        <ModalDrawerContent>
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex flex-col h-full"
          >
            <ValidatedForm
              method="post"
              validator={trainingAssignmentValidator}
              defaultValues={initialValues}
              fetcher={fetcher}
              action={
                isEditing
                  ? path.to.trainingAssignment(initialValues.id!)
                  : path.to.newTrainingAssignment
              }
              className="flex flex-col h-full"
            >
              <ModalDrawerHeader className="flex flex-col gap-4">
                <HStack className="w-full justify-between pr-8">
                  <VStack>
                    <ModalDrawerTitle>
                      {isEditing ? "Edit Assignment" : "New Assignment"}
                    </ModalDrawerTitle>
                  </VStack>

                  {isEditing && (
                    <div>
                      <TabsList>
                        <TabsTrigger value="details">Details</TabsTrigger>
                        <TabsTrigger value="status">Status</TabsTrigger>
                      </TabsList>
                    </div>
                  )}
                </HStack>
              </ModalDrawerHeader>
              <ModalDrawerBody className="w-full">
                <Hidden name="id" />

                {isEditing ? (
                  <>
                    <TabsContent value="details" className="w-full">
                      <AssignmentFormContent
                        trainings={trainings}
                        isEditing={isEditing}
                      />
                    </TabsContent>
                    <TabsContent
                      value="status"
                      className="w-full flex flex-col gap-4"
                    >
                      {assignmentStatus.length > 0 ? (
                        <StatusTable
                          data={assignmentStatus}
                          currentPeriod={currentPeriod}
                        />
                      ) : (
                        <div className="py-8 text-center text-muted-foreground">
                          No employees assigned yet. Add groups to see status.
                        </div>
                      )}
                    </TabsContent>
                  </>
                ) : (
                  <AssignmentFormContent
                    trainings={trainings}
                    isEditing={isEditing}
                  />
                )}
              </ModalDrawerBody>
              <ModalDrawerFooter>
                <HStack>
                  <Submit
                    isLoading={fetcher.state !== "idle"}
                    isDisabled={fetcher.state !== "idle" || isDisabled}
                  >
                    Save
                  </Submit>
                  <Button size="md" variant="solid" onClick={onClose}>
                    Cancel
                  </Button>
                </HStack>
              </ModalDrawerFooter>
            </ValidatedForm>
          </Tabs>
        </ModalDrawerContent>
      </ModalDrawer>
    </ModalDrawerProvider>
  );
};

function AssignmentFormContent({
  trainings,
  isEditing,
}: {
  trainings: TrainingListItem[];
  isEditing: boolean;
}) {
  return (
    <VStack spacing={4}>
      <Select
        name="trainingId"
        label="Training"
        isReadOnly={isEditing}
        options={trainings.map((training) => ({
          label: training.name ?? "",
          value: training.id ?? "",
        }))}
      />
      <Users
        name="groupIds"
        label="Assign to Groups"
        type="employee"
        helperText="Select the groups that should complete this training"
      />
    </VStack>
  );
}

export default TrainingAssignmentForm;
