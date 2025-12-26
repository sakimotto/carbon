import { requirePermissions } from "@carbon/auth/auth.server";
import { Database } from "@carbon/database";
// biome-ignore lint/suspicious/noShadowRestrictedNames: suppressed due to migration
import { Combobox, Hidden, Number, Submit, ValidatedForm } from "@carbon/form";
import {
  Badge,
  Button,
  Heading,
  HStack,
  IconButton,
  SidebarTrigger,
  Status,
  useDisclosure,
  VStack
} from "@carbon/react";
import { useEffect, useMemo } from "react";
import { BsExclamationSquareFill } from "react-icons/bs";
import { FaCheck, FaPause, FaPlay } from "react-icons/fa6";
import { LuArrowLeft, LuCheck, LuCirclePlus, LuX } from "react-icons/lu";
import type { LoaderFunctionArgs } from "react-router";
import { Link, useFetcher, useLoaderData } from "react-router";
import { z } from "zod/v3";
import { HighPriorityIcon } from "~/assets/icons/HighPriorityIcon";
import { LowPriorityIcon } from "~/assets/icons/LowPriorityIcon";
import { MediumPriorityIcon } from "~/assets/icons/MediumPriorityIcon";
import EmployeeAvatar from "~/components/EmployeeAvatar";
import MaintenanceOeeImpact from "~/components/MaintenanceOeeImpact";
import {
  getActiveMaintenanceEventByEmployee,
  getMaintenanceDispatch,
  getMaintenanceDispatchEvents,
  getMaintenanceDispatchItems,
  getWorkCenterReplacementParts
} from "~/services/maintenance.service";
import type { maintenanceDispatchPriority } from "~/services/models";
import { useItems } from "~/stores";
import { path } from "~/utils/path";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { client, userId } = await requirePermissions(request, {});
  const { dispatchId } = params;

  if (!dispatchId) {
    throw new Error("Dispatch ID is required");
  }

  const [dispatch, events, items, activeEvent] = await Promise.all([
    getMaintenanceDispatch(client, dispatchId),
    getMaintenanceDispatchEvents(client, dispatchId),
    getMaintenanceDispatchItems(client, dispatchId),
    getActiveMaintenanceEventByEmployee(client, userId)
  ]);

  // Fetch replacement parts for the work center if available
  let replacementParts: Awaited<
    ReturnType<typeof getWorkCenterReplacementParts>
  >["data"] = [];
  if (dispatch.data?.workCenterId) {
    const parts = await getWorkCenterReplacementParts(
      client,
      dispatch.data.workCenterId
    );
    replacementParts = parts.data ?? [];
  }

  return {
    dispatch: dispatch.data,
    events: events.data ?? [],
    items: items.data ?? [],
    activeEvent: activeEvent.data,
    replacementParts,
    userId
  };
}

function getPriorityIcon(
  priority: (typeof maintenanceDispatchPriority)[number]
) {
  switch (priority) {
    case "Critical":
      return <BsExclamationSquareFill className="text-red-500 h-5 w-5" />;
    case "High":
      return <HighPriorityIcon className="h-5 w-5" />;
    case "Medium":
      return <MediumPriorityIcon className="h-5 w-5" />;
    case "Low":
      return <LowPriorityIcon className="h-5 w-5" />;
  }
}

type MaintenanceStatusProps = {
  status?: Database["public"]["Enums"]["maintenanceDispatchStatus"];
  className?: string;
};

function MaintenanceStatus({ status, className }: MaintenanceStatusProps) {
  switch (status) {
    case "Open":
      return (
        <Status color="gray" className={className}>
          {status}
        </Status>
      );
    case "Assigned":
      return (
        <Status color="yellow" className={className}>
          {status}
        </Status>
      );
    case "In Progress":
      return (
        <Status color="blue" className={className}>
          {status}
        </Status>
      );
    case "Completed":
      return (
        <Status color="green" className={className}>
          {status}
        </Status>
      );
    case "Cancelled":
      return (
        <Status color="red" className={className}>
          {status}
        </Status>
      );
    default:
      return null;
  }
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

const eventValidator = z.object({
  action: z.enum(["Start", "End", "Complete"]),
  dispatchId: z.string(),
  workCenterId: z.string().optional(),
  eventId: z.string().optional()
});

const sparePartValidator = z.object({
  action: z.enum(["add", "delete"]),
  itemId: z.string().min(1, "Item is required"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  unitOfMeasureCode: z.string().optional()
});

export default function MaintenanceDetailRoute() {
  const { dispatch, events, items, activeEvent, replacementParts } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const itemFetcher = useFetcher();
  const addPartForm = useDisclosure();
  const [allItems] = useItems();

  // Check if user has an active event on THIS dispatch
  const myActiveEvent = useMemo(() => {
    if (!activeEvent) return null;
    if (activeEvent.maintenanceDispatchId === dispatch?.id) {
      return activeEvent;
    }
    return null;
  }, [activeEvent, dispatch?.id]);

  const isWorking = !!myActiveEvent;
  const isCompleted = dispatch?.status === "Completed";

  // Calculate total time worked
  const totalDuration = useMemo(() => {
    return events.reduce((total, event) => {
      return total + (event.duration ?? 0);
    }, 0);
  }, [events]);

  // Get item IDs already added to the dispatch
  const addedItemIds = useMemo(() => {
    return new Set(items.map((item) => item.itemId));
  }, [items]);

  // Create item options with suggestions from replacement parts
  const itemOptions = useMemo(() => {
    // Start with replacement parts as suggestions
    const suggestions =
      replacementParts
        ?.filter((part) => !addedItemIds.has(part.itemId))
        .map((part) => ({
          value: part.itemId,
          label: part.item?.name ?? "Unknown",
          helper: `Suggested - Qty: ${part.quantity} ${part.unitOfMeasureCode}`
        })) ?? [];

    // Add all other items not in suggestions
    const suggestionIds = new Set(suggestions.map((s) => s.value));
    const otherItems = allItems
      .filter(
        (item) => !suggestionIds.has(item.id) && !addedItemIds.has(item.id)
      )
      .map((item) => ({
        value: item.id,
        label: item.readableIdWithRevision,
        helper: item.name
      }));

    return [...suggestions, ...otherItems];
  }, [replacementParts, allItems, addedItemIds]);

  // Close add part form after successful submission
  useEffect(() => {
    if (itemFetcher.state === "idle" && itemFetcher.data?.id) {
      addPartForm.onClose();
    }
  }, [itemFetcher.state, itemFetcher.data, addPartForm]);

  if (!dispatch) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center">
        <span className="text-muted-foreground">Dispatch not found</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      <header className="sticky top-0 z-10 flex h-[var(--header-height)] shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 border-b bg-background">
        <div className="flex items-center gap-2 px-2 w-full justify-between">
          <HStack>
            <SidebarTrigger />
            <Link to={path.to.maintenance}>
              <Button variant="ghost" size="sm">
                <LuArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <Heading size="h4">{dispatch.maintenanceDispatchId}</Heading>
            <MaintenanceStatus status={dispatch.status} />
          </HStack>
          <HStack>
            {getPriorityIcon(
              dispatch.priority as (typeof maintenanceDispatchPriority)[number]
            )}
          </HStack>
        </div>
      </header>

      <main className="h-[calc(100dvh-var(--header-height))] w-full overflow-y-auto scrollbar-thin scrollbar-thumb-accent scrollbar-track-transparent p-4">
        <VStack spacing={4} className="max-w-2xl mx-auto">
          {/* Work Center & OEE Impact */}
          <div className="w-full p-4 bg-card rounded-lg border">
            <VStack spacing={2} className="items-start">
              <span className="text-sm text-muted-foreground">Work Center</span>
              <span className="text-lg font-semibold">
                {dispatch.workCenter?.name ?? "Unknown"}
              </span>
              <HStack className="mt-2">
                <MaintenanceOeeImpact oeeImpact={dispatch.oeeImpact} />
                <Badge variant="outline">{dispatch.severity}</Badge>
              </HStack>
            </VStack>
          </div>

          {/* Time Tracking Controls */}
          {!isCompleted && (
            <div className="w-full p-6 bg-card rounded-lg border">
              <VStack spacing={4}>
                <span className="text-sm text-muted-foreground">
                  Time Worked: {formatDuration(totalDuration)}
                </span>
                <HStack spacing={4} className="justify-center w-full">
                  <ValidatedForm
                    method="post"
                    action={path.to.maintenanceEvent}
                    validator={eventValidator}
                    fetcher={fetcher}
                    defaultValues={{
                      action: isWorking ? "End" : "Start",
                      dispatchId: dispatch.id,
                      workCenterId: dispatch.workCenterId ?? undefined,
                      eventId: myActiveEvent?.id
                    }}
                  >
                    <Hidden name="dispatchId" value={dispatch.id} />
                    <Hidden
                      name="workCenterId"
                      value={dispatch.workCenterId ?? ""}
                    />
                    <Hidden name="eventId" value={myActiveEvent?.id ?? ""} />
                    <Hidden name="action" value={isWorking ? "End" : "Start"} />
                    <button
                      type="submit"
                      disabled={fetcher.state !== "idle"}
                      className={`group size-24 flex flex-row items-center gap-2 justify-center rounded-full shadow-lg hover:cursor-pointer hover:drop-shadow-xl hover:scale-105 transition-all text-white text-3xl border-b-4 active:border-b-0 active:translate-y-1 disabled:bg-gray-500 disabled:hover:bg-gray-600 disabled:border-gray-700 ${
                        isWorking
                          ? "bg-red-500 hover:bg-red-600 border-red-700"
                          : "bg-emerald-500 hover:bg-emerald-600 border-emerald-700"
                      }`}
                    >
                      {isWorking ? (
                        <FaPause className="group-hover:scale-110" />
                      ) : (
                        <FaPlay className="group-hover:scale-110" />
                      )}
                    </button>
                  </ValidatedForm>

                  <ValidatedForm
                    method="post"
                    action={path.to.maintenanceEvent}
                    validator={eventValidator}
                    fetcher={fetcher}
                    defaultValues={{
                      action: "Complete",
                      dispatchId: dispatch.id,
                      eventId: myActiveEvent?.id
                    }}
                  >
                    <Hidden name="dispatchId" value={dispatch.id} />
                    <Hidden name="eventId" value={myActiveEvent?.id ?? ""} />
                    <Hidden name="action" value="Complete" />
                    <button
                      type="submit"
                      disabled={fetcher.state !== "idle"}
                      className="group size-24 flex flex-row items-center gap-2 justify-center bg-accent rounded-full shadow-lg hover:cursor-pointer hover:shadow-xl hover:scale-105 transition-all text-accent-foreground text-3xl disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-30"
                    >
                      <FaCheck className="group-hover:scale-110" />
                    </button>
                  </ValidatedForm>
                </HStack>
              </VStack>
            </div>
          )}

          {/* Time Entries */}
          {events.length > 0 && (
            <div className="w-full p-4 bg-card rounded-lg border">
              <VStack spacing={2} className="items-start">
                <span className="text-sm font-medium">Time Entries</span>
                <div className="w-full divide-y">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className="py-2 flex justify-between items-center"
                    >
                      <VStack spacing={2} className="items-start">
                        <EmployeeAvatar
                          employeeId={event.employeeId}
                          size="xs"
                        />

                        <span className="text-xs text-muted-foreground">
                          {new Date(event.startTime).toLocaleString()}
                          {event.endTime &&
                            ` - ${new Date(event.endTime).toLocaleTimeString()}`}
                        </span>
                      </VStack>
                      <span className="text-sm font-mono">
                        {event.duration
                          ? formatDuration(event.duration)
                          : "Active"}
                      </span>
                    </div>
                  ))}
                </div>
              </VStack>
            </div>
          )}

          {/* Spare Parts */}
          {!isCompleted && (
            <div className="w-full p-4 bg-card rounded-lg border">
              <VStack spacing={2} className="items-start w-full">
                <HStack className="justify-between w-full">
                  <span className="text-sm font-medium">Spare Parts</span>
                  {!addPartForm.isOpen && (
                    <Button
                      variant="secondary"
                      leftIcon={<LuCirclePlus />}
                      onClick={addPartForm.onOpen}
                    >
                      Add
                    </Button>
                  )}
                </HStack>

                {/* Add Part Form */}
                {addPartForm.isOpen && (
                  <ValidatedForm
                    method="post"
                    action={path.to.maintenanceDispatchItem(dispatch.id)}
                    validator={sparePartValidator}
                    fetcher={itemFetcher}
                    defaultValues={{
                      action: "add",
                      itemId: "",
                      quantity: 1,
                      unitOfMeasureCode: "EA"
                    }}
                    className="w-full"
                  >
                    <VStack spacing={3} className="w-full">
                      <Hidden name="action" value="add" />
                      <Hidden name="unitOfMeasureCode" value="EA" />
                      <Combobox
                        name="itemId"
                        label="Item"
                        options={itemOptions}
                        itemHeight={44}
                      />
                      <Number name="quantity" label="Quantity" minValue={1} />
                      <HStack className="justify-end w-full">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={addPartForm.onClose}
                        >
                          Cancel
                        </Button>
                        <Submit
                          isLoading={itemFetcher.state !== "idle"}
                          isDisabled={itemFetcher.state !== "idle"}
                        >
                          Add Part
                        </Submit>
                      </HStack>
                    </VStack>
                  </ValidatedForm>
                )}

                {/* Existing Parts */}
                {items.length > 0 && (
                  <div className="w-full divide-y">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="py-2 flex justify-between items-center"
                      >
                        <VStack spacing={0} className="items-start">
                          <span className="text-sm">{item.item?.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {item.quantity} {item.unitOfMeasureCode}
                          </span>
                        </VStack>
                        <ValidatedForm
                          method="post"
                          action={path.to.maintenanceDispatchItem(dispatch.id)}
                          validator={sparePartValidator}
                          fetcher={itemFetcher}
                        >
                          <Hidden name="action" value="delete" />
                          <Hidden name="itemId" value={item.id} />
                          <Hidden name="quantity" value="1" />
                          <IconButton
                            type="submit"
                            aria-label="Remove part"
                            size="sm"
                            variant="ghost"
                            icon={<LuX className="h-4 w-4" />}
                            isDisabled={itemFetcher.state !== "idle"}
                          />
                        </ValidatedForm>
                      </div>
                    ))}
                  </div>
                )}

                {items.length === 0 && !addPartForm.isOpen && (
                  <span className="text-xs text-muted-foreground">
                    No spare parts added yet
                  </span>
                )}
              </VStack>
            </div>
          )}

          {/* Materials (when completed) */}
          {isCompleted && items.length > 0 && (
            <div className="w-full p-4 bg-card rounded-lg border">
              <VStack spacing={2} className="items-start">
                <span className="text-sm font-medium">Spare Parts Used</span>
                <div className="w-full divide-y">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="py-2 flex justify-between items-center"
                    >
                      <span className="text-sm">{item.item?.name}</span>
                      <span className="text-sm font-mono">
                        {item.quantity} {item.unitOfMeasureCode}
                      </span>
                    </div>
                  ))}
                </div>
              </VStack>
            </div>
          )}

          {/* Completed State */}
          {isCompleted && (
            <div className="w-full p-4 bg-emerald-50 dark:bg-emerald-950 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <VStack spacing={2}>
                <LuCheck className="h-8 w-8 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  Maintenance Completed
                </span>
                <span className="text-xs text-muted-foreground">
                  Total time: {formatDuration(totalDuration)}
                </span>
              </VStack>
            </div>
          )}
        </VStack>
      </main>
    </div>
  );
}
