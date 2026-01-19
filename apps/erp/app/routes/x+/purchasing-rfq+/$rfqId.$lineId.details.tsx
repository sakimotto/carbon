import { assertIsPost, error, getCarbonServiceRole } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { flash } from "@carbon/auth/session.server";
import { validationError, validator } from "@carbon/form";
import type { JSONContent } from "@carbon/react";
import { Fragment } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Outlet, redirect, useLoaderData, useParams } from "react-router";
import { CadModel } from "~/components";
import { usePermissions } from "~/hooks";
import {
  getPurchasingRFQLine,
  purchasingRfqLineValidator,
  upsertPurchasingRFQLine
} from "~/modules/purchasing";
import {
  PurchasingRFQLineForm,
  PurchasingRFQLineNotes
} from "~/modules/purchasing/ui/PurchasingRfq";
import { setCustomFields } from "~/utils/form";
import { path } from "~/utils/path";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await requirePermissions(request, {
    view: "purchasing"
  });

  const { rfqId, lineId } = params;
  if (!rfqId) throw new Error("Could not find rfqId");
  if (!lineId) throw new Error("Could not find lineId");

  const serviceRole = await getCarbonServiceRole();

  const [line] = await Promise.all([getPurchasingRFQLine(serviceRole, lineId)]);

  if (line.error) {
    throw redirect(
      path.to.purchasingRfq(rfqId),
      await flash(request, error(line.error, "Failed to load line"))
    );
  }

  return {
    line: line.data
  };
};

export async function action({ request, params }: ActionFunctionArgs) {
  assertIsPost(request);
  const { client, companyId, userId } = await requirePermissions(request, {
    update: "purchasing"
  });

  const { rfqId, lineId } = params;
  if (!rfqId) throw new Error("Could not find rfqId");
  if (!lineId) throw new Error("Could not find lineId");

  const formData = await request.formData();

  const validation = await validator(purchasingRfqLineValidator).validate(
    formData
  );

  if (validation.error) {
    return validationError(validation.error);
  }

  // biome-ignore lint/correctness/noUnusedVariables: suppressed due to migration
  const { id, ...d } = validation.data;

  const updateLine = await upsertPurchasingRFQLine(client, {
    id: lineId,
    ...d,
    companyId,
    updatedBy: userId,
    customFields: setCustomFields(formData)
  });

  if (updateLine.error) {
    throw redirect(
      path.to.purchasingRfqLine(rfqId, lineId),
      await flash(request, error(updateLine.error, "Failed to update RFQ line"))
    );
  }

  throw redirect(path.to.purchasingRfqLine(rfqId, lineId));
}

export default function PurchasingRFQLine() {
  const { line } = useLoaderData<typeof loader>();

  const permissions = usePermissions();

  const { rfqId, lineId } = useParams();
  if (!rfqId) throw new Error("Could not find rfqId");
  if (!lineId) throw new Error("Could not find lineId");

  const initialValues = {
    ...line,
    id: line.id ?? undefined,
    purchasingRfqId: line.purchasingRfqId ?? "",
    partNumber: line.partNumber ?? "",
    partRevision: line.partRevision ?? "",
    description: line.description ?? "",
    itemId: line.itemId ?? "",
    quantity: line.quantity ?? [1],
    order: line.order ?? 1,
    unitOfMeasureCode: line.unitOfMeasureCode ?? ""
  };

  return (
    <Fragment key={lineId}>
      <PurchasingRFQLineForm key={lineId} initialValues={initialValues} />
      <PurchasingRFQLineNotes
        id={line.id}
        table="purchasingRfqLine"
        title="Notes"
        subTitle={line.partNumber ?? ""}
        internalNotes={line.internalNotes as JSONContent}
        externalNotes={line.externalNotes as JSONContent}
      />
      <CadModel
        isReadOnly={!permissions.can("update", "purchasing")}
        metadata={{
          purchasingRfqLineId: line.id ?? undefined,
          itemId: line.itemId ?? undefined
        }}
        modelPath={line?.modelPath ?? null}
        title="CAD Model"
        uploadClassName="aspect-square min-h-[420px] max-h-[70vh]"
        viewerClassName="aspect-square min-h-[420px] max-h-[70vh]"
      />

      <Outlet />
    </Fragment>
  );
}
