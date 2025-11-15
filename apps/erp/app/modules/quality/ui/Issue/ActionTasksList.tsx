import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  HStack,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  VStack,
} from "@carbon/react";
import { useFetcher, useParams } from "@remix-run/react";
import { useCallback, useEffect, useState } from "react";
import { LuCirclePlus } from "react-icons/lu";
import { useRouteData } from "~/hooks";
import type { IssueActionTask } from "~/modules/quality";
import type { ListItem } from "~/types";
import { path } from "~/utils/path";
import { TaskItem, TaskProgress } from "./IssueTask";

export function ActionTasksList({
  tasks,
  suppliers,
  isDisabled,
}: {
  tasks: IssueActionTask[];
  suppliers: { supplierId: string; externalLinkId: string | null }[];
  isDisabled: boolean;
}) {
  if (tasks.length === 0) return <NewAction isDisabled={isDisabled} />;

  return (
    <Card className="w-full" isCollapsible>
      <HStack className="justify-between w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Actions</CardTitle>
        </CardHeader>
        <TaskProgress tasks={tasks} />
      </HStack>
      <CardContent>
        <VStack spacing={3}>
          {tasks
            .sort((a, b) => a.name?.localeCompare(b.name ?? "") ?? 0)
            .map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                type="action"
                suppliers={suppliers}
                isDisabled={isDisabled}
              />
            ))}
        </VStack>
      </CardContent>
    </Card>
  );
}

function NewAction({ isDisabled }: { isDisabled: boolean }) {
  const { id } = useParams();
  if (!id) throw new Error("id not found");

  const [isOpen, setIsOpen] = useState(false);
  const [selectedActionIds, setSelectedActionIds] = useState<string[]>([]);

  const routeData = useRouteData<{
    requiredActions: ListItem[];
  }>(path.to.issue(id));

  const fetcher = useFetcher();

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      setIsOpen(false);
      setSelectedActionIds([]);
    }
  }, [fetcher.state, fetcher.data]);

  const handleSubmit = useCallback(() => {
    const formData = new FormData();
    formData.append("ids", id);
    formData.append("field", "requiredActionIds");
    formData.append("value", selectedActionIds.join(","));

    fetcher.submit(formData, {
      method: "post",
      action: path.to.bulkUpdateIssue,
    });
  }, [id, selectedActionIds, fetcher]);

  const handleCheckboxChange = useCallback(
    (actionId: string, checked: boolean) => {
      setSelectedActionIds((prev) =>
        checked ? [...prev, actionId] : prev.filter((id) => id !== actionId)
      );
    },
    []
  );

  return (
    <>
      <button
        className="flex items-center justify-start bg-card border-2 border-dashed border-background w-full hover:bg-background/80 rounded-lg px-10 py-6 text-muted-foreground hover:text-foreground gap-2 transition-colors duration-200 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={() => setIsOpen(true)}
        disabled={isDisabled}
      >
        <LuCirclePlus size={16} /> <span>Add Actions</span>
      </button>

      <Modal
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsOpen(false);
            setSelectedActionIds([]);
          }
        }}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Add Required Actions</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <VStack spacing={2}>
              {routeData?.requiredActions.map((action) => (
                <label
                  key={action.id}
                  htmlFor={action.id}
                  className="flex items-center gap-2 w-full px-4 py-3 rounded-lg hover:bg-accent hover:text-accent-foreground border border-border cursor-pointer"
                >
                  <Checkbox
                    id={action.id}
                    isChecked={selectedActionIds.includes(action.id)}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(action.id, !!checked)
                    }
                  />
                  <span className="text-sm font-medium">{action.name}</span>
                </label>
              ))}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setIsOpen(false);
                setSelectedActionIds([]);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                selectedActionIds.length === 0 || fetcher.state !== "idle"
              }
              isLoading={fetcher.state === "submitting"}
            >
              {fetcher.state !== "idle" ? "Adding..." : "Add Actions"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
