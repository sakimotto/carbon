import { useCarbon } from "@carbon/auth";
import { ValidatedForm } from "@carbon/form";
import {
  Badge,
  CardAction,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuIcon,
  DropdownMenuItem,
  DropdownMenuTrigger,
  HStack,
  IconButton,
  ModalCard,
  ModalCardBody,
  ModalCardContent,
  ModalCardDescription,
  ModalCardFooter,
  ModalCardHeader,
  ModalCardProvider,
  ModalCardTitle,
  toast,
  useDisclosure,
  VStack
} from "@carbon/react";
import { useState } from "react";
import { BsThreeDotsVertical } from "react-icons/bs";
import { LuTrash } from "react-icons/lu";
import { useParams } from "react-router";
import type { z } from "zod";
import {
  ArrayNumeric,
  CustomFormFields,
  Hidden,
  InputControlled,
  Item,
  Submit,
  UnitOfMeasure
} from "~/components/Form";
import { usePermissions, useRouteData, useUser } from "~/hooks";
import { path } from "~/utils/path";
import { purchasingRfqLineValidator } from "../../purchasing.models";
import type { PurchasingRFQ, PurchasingRFQLine } from "../../types";
import DeletePurchasingRFQLine from "./DeletePurchasingRFQLine";

type PurchasingRFQLineFormProps = {
  initialValues: z.infer<typeof purchasingRfqLineValidator>;
  type?: "card" | "modal";
  onClose?: () => void;
};

const PurchasingRFQLineForm = ({
  initialValues,
  type,
  onClose
}: PurchasingRFQLineFormProps) => {
  const permissions = usePermissions();
  const { company } = useUser();
  const { carbon } = useCarbon();

  const { rfqId } = useParams();

  if (!rfqId) throw new Error("rfqId not found");

  const routeData = useRouteData<{
    rfqSummary: PurchasingRFQ;
  }>(path.to.purchasingRfq(rfqId));

  const isEditable = ["Draft"].includes(routeData?.rfqSummary?.status ?? "");

  const isEditing = initialValues.id !== undefined;

  const [itemData, setItemData] = useState<{
    partNumber: string;
    partRevision: string;
    itemId: string;
    description: string;
    unitOfMeasureCode: string;
  }>({
    partNumber: initialValues.partNumber ?? "",
    partRevision: initialValues.partRevision ?? "",
    itemId: initialValues.itemId ?? "",
    description: initialValues.description ?? "",
    unitOfMeasureCode: initialValues.unitOfMeasureCode ?? "EA"
  });

  const onItemChange = async (itemId: string) => {
    if (!carbon) return;

    const item = await carbon
      .from("item")
      .select("name, unitOfMeasureCode")
      .eq("id", itemId)
      .eq("companyId", company.id)
      .single();

    if (item.error) {
      toast.error("Failed to load item details");
      return;
    }

    const newItemData = {
      ...itemData,
      itemId,
      description: item.data?.name ?? "",
      unitOfMeasureCode: item.data?.unitOfMeasureCode ?? "EA"
    };

    setItemData(newItemData);
  };

  const deleteDisclosure = useDisclosure();

  return (
    <>
      <ModalCardProvider type={type}>
        <ModalCard
          onClose={onClose}
          isCollapsible={isEditing}
          defaultCollapsed={false}
        >
          <ModalCardContent>
            <ValidatedForm
              defaultValues={initialValues}
              validator={purchasingRfqLineValidator}
              method="post"
              action={
                isEditing
                  ? path.to.purchasingRfqLine(rfqId, initialValues.id!)
                  : path.to.newPurchasingRFQLine(rfqId)
              }
              className="w-full"
              onSubmit={() => {
                if (type === "modal") onClose?.();
              }}
            >
              <HStack className="w-full justify-between items-start">
                <ModalCardHeader>
                  <ModalCardTitle>
                    {isEditing
                      ? `${itemData?.partNumber}${
                          itemData?.partRevision
                            ? `.${itemData?.partRevision}`
                            : ""
                        }`
                      : "New RFQ Line"}
                  </ModalCardTitle>
                  <ModalCardDescription>
                    {isEditing ? (
                      <div className="flex flex-col items-start gap-1">
                        <span>{itemData?.description}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {initialValues?.quantity?.join(", ")}
                          </Badge>
                        </div>
                      </div>
                    ) : (
                      "An RFQ line contains part and quantity information about the requested item"
                    )}
                  </ModalCardDescription>
                </ModalCardHeader>
                {isEditing && permissions.can("update", "purchasing") && (
                  <CardAction className="pr-12">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <IconButton
                          icon={<BsThreeDotsVertical />}
                          aria-label="More"
                          variant="ghost"
                        />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={!isEditable}
                          onClick={deleteDisclosure.onOpen}
                        >
                          <DropdownMenuIcon icon={<LuTrash />} />
                          Delete Line
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardAction>
                )}
              </HStack>
              <ModalCardBody>
                <Hidden name="id" />
                <Hidden name="purchasingRfqId" />
                <Hidden name="order" />
                <VStack>
                  <div className="grid w-full gap-x-8 gap-y-4 grid-cols-1 lg:grid-cols-3">
                    <div className="col-span-2 grid w-full gap-x-8 gap-y-4 grid-cols-1 lg:grid-cols-2 auto-rows-min">
                      <InputControlled
                        name="partNumber"
                        label="Part Number"
                        value={itemData.partNumber}
                        onChange={(newValue) => {
                          setItemData((d) => ({
                            ...d,
                            partNumber: newValue
                          }));
                        }}
                        autoFocus
                      />
                      <InputControlled
                        name="partRevision"
                        label="Part Revision"
                        value={itemData.partRevision}
                        onChange={(newValue) => {
                          setItemData((d) => ({
                            ...d,
                            partRevision: newValue
                          }));
                        }}
                      />
                      <Item
                        name="itemId"
                        label="Part"
                        type="Part"
                        value={itemData.itemId}
                        includeInactive
                        onChange={(value) => {
                          onItemChange(value?.value as string);
                        }}
                      />
                      <InputControlled
                        name="description"
                        label="Description"
                        value={itemData.description}
                        isReadOnly={!!itemData.itemId}
                      />
                      <UnitOfMeasure
                        name="unitOfMeasureCode"
                        value={itemData.unitOfMeasureCode}
                        onChange={(newValue) =>
                          setItemData((d) => ({
                            ...d,
                            unitOfMeasureCode: newValue?.value ?? "EA"
                          }))
                        }
                      />

                      <CustomFormFields table="purchasingRfqLine" />
                    </div>
                    <div className="flex gap-y-4">
                      <ArrayNumeric
                        name="quantity"
                        label="Quantity"
                        defaults={[1, 25, 50, 100]}
                      />
                    </div>
                  </div>
                </VStack>
              </ModalCardBody>
              <ModalCardFooter>
                <Submit
                  isDisabled={
                    !isEditable ||
                    (isEditing
                      ? !permissions.can("update", "purchasing")
                      : !permissions.can("create", "purchasing"))
                  }
                >
                  Save
                </Submit>
              </ModalCardFooter>
            </ValidatedForm>
          </ModalCardContent>
        </ModalCard>
      </ModalCardProvider>
      {isEditing && deleteDisclosure.isOpen && (
        <DeletePurchasingRFQLine
          line={initialValues as PurchasingRFQLine}
          onCancel={deleteDisclosure.onClose}
        />
      )}
    </>
  );
};

export default PurchasingRFQLineForm;
