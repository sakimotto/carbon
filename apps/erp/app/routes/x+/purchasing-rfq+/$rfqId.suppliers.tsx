import { assertIsPost, error, success } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { flash } from "@carbon/auth/session.server";
import { validationError, validator } from "@carbon/form";
import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import {
  purchasingRfqSuppliersValidator,
  upsertPurchasingRFQSuppliers
} from "~/modules/purchasing";
import { path } from "~/utils/path";

export async function action({ request, params }: ActionFunctionArgs) {
  assertIsPost(request);
  const { client, companyId, userId } = await requirePermissions(request, {
    update: "purchasing"
  });

  const { rfqId: id } = params;
  if (!id) throw new Error("Could not find id");

  const formData = await request.formData();
  const validation = await validator(purchasingRfqSuppliersValidator).validate(
    formData
  );

  if (validation.error) {
    return validationError(validation.error);
  }

  const { purchasingRfqId, supplierIds } = validation.data;

  const update = await upsertPurchasingRFQSuppliers(
    client,
    purchasingRfqId,
    supplierIds,
    companyId,
    userId
  );

  if (update.error) {
    throw redirect(
      path.to.purchasingRfq(id),
      await flash(request, error(update.error, "Failed to update suppliers"))
    );
  }

  throw redirect(
    path.to.purchasingRfq(id),
    await flash(request, success("Updated suppliers"))
  );
}
