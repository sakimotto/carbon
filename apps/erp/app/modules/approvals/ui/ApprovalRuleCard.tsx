import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  HStack,
  IconButton,
  useDisclosure
} from "@carbon/react";
import { memo, useCallback } from "react";
import { LuEllipsisVertical, LuPencil, LuTrash } from "react-icons/lu";
import { useNavigate } from "react-router";
import ConfirmDelete from "~/components/Modals/ConfirmDelete";
import {
  useCurrencyFormatter,
  usePermissions,
  useUrlParams,
  useUser
} from "~/hooks";
import type { ApprovalRule } from "~/modules/approvals";
import { path } from "~/utils/path";
import ApprovalRuleDetails from "./ApprovalRuleDetails";

type ApprovalRuleCardProps = {
  rule: ApprovalRule & { approverGroupNames?: string[] };
  documentType: "purchaseOrder" | "qualityDocument";
};

const ApprovalRuleCard = memo(
  ({ rule, documentType }: ApprovalRuleCardProps) => {
    const [params] = useUrlParams();
    const navigate = useNavigate();
    const permissions = usePermissions();
    const user = useUser();
    const currencyFormatter = useCurrencyFormatter();
    const deleteDisclosure = useDisclosure();

    const canEdit =
      permissions.can("update", "settings") && rule.createdBy === user?.id;
    const canDelete =
      permissions.can("update", "settings") && rule.createdBy === user?.id;

    const handleEdit = useCallback(() => {
      if (!rule.id) return;
      navigate(`${path.to.approvalRule(rule.id)}?${params.toString()}`);
    }, [navigate, params, rule.id]);

    const handleDeleteClick = useCallback(() => {
      deleteDisclosure.onOpen();
    }, [deleteDisclosure]);

    const handleDeleteConfirm = useCallback(() => {
      deleteDisclosure.onClose();
    }, [deleteDisclosure]);

    if (!rule.id) return null;

    return (
      <>
        <Card className="p-0 border">
          <Accordion type="multiple" className="w-full">
            <AccordionItem value={rule.id} className="border-none">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center justify-between w-full pr-4">
                  <HStack spacing={4} className="flex-1">
                    <Badge
                      variant={rule.enabled ? "green" : "gray"}
                      className="text-xs font-medium"
                    >
                      {rule.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                    <span className="font-medium text-sm">{rule.name}</span>
                    {documentType === "purchaseOrder" && (
                      <span className="text-xs text-muted-foreground">
                        {currencyFormatter.format(rule.lowerBoundAmount ?? 0)}
                        {rule.upperBoundAmount
                          ? ` - ${currencyFormatter.format(rule.upperBoundAmount)}`
                          : "+"}
                      </span>
                    )}
                  </HStack>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <IconButton
                        aria-label="More options"
                        icon={<LuEllipsisVertical />}
                        variant="ghost"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        disabled={!canEdit}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit();
                        }}
                      >
                        <LuPencil className="mr-2 h-4 w-4" />
                        Edit Rule
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        destructive
                        disabled={!canDelete}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick();
                        }}
                      >
                        <LuTrash className="mr-2 h-4 w-4" />
                        Delete Rule
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-5">
                <ApprovalRuleDetails
                  rule={rule}
                  documentType={documentType}
                  currencyFormatter={currencyFormatter}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>
        <ConfirmDelete
          action={path.to.deleteApprovalRule(rule.id)}
          isOpen={deleteDisclosure.isOpen}
          name={`${documentType === "purchaseOrder" ? "Purchase Order" : "Quality Document"} approval rule`}
          text={`Are you sure you want to delete this approval rule? This cannot be undone.`}
          onCancel={deleteDisclosure.onClose}
          onSubmit={handleDeleteConfirm}
        />
      </>
    );
  }
);

ApprovalRuleCard.displayName = "ApprovalRuleCard";
export default ApprovalRuleCard;
