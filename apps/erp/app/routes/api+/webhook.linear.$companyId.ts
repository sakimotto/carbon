import { getCarbonServiceRole } from "@carbon/auth";
import { syncIssueFromLinearSchema } from "@carbon/jobs/trigger/linear";
import { tasks } from "@trigger.dev/sdk";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@vercel/remix";
import { json } from "@vercel/remix";
import { getIntegration } from "../../modules/settings";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { companyId } = params;
  if (!companyId) {
    return json({ success: false }, { status: 400 });
  }

  return json({
    success: true,
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { companyId } = params;

  if (!companyId) {
    return json({ success: false }, { status: 400 });
  }

  const serviceRole = getCarbonServiceRole();
  const integration = await getIntegration(serviceRole, "linear", companyId);

  if (integration.error) {
    console.error(
      "Linear webhook: integration query failed",
      integration.error
    );
    return json(
      { success: false, error: "Integration query failed" },
      { status: 400 }
    );
  }

  if (!integration.data) {
    return json(
      { success: false, error: "Integration not configured" },
      { status: 400 }
    );
  }

  if (!integration.data.active) {
    return json(
      { success: false, error: "Integration not active" },
      { status: 400 }
    );
  }

  const body = await request.json();

  const parsed = syncIssueFromLinearSchema.safeParse({
    companyId,
    event: body,
  });

  if (!parsed.success) {
    return json(
      { success: false, error: parsed.error.format() },
      { status: 400 }
    );
  }

  try {
    await tasks.trigger("sync-issue-from-linear", parsed.data);
    return json({ success: true });
  } catch (err) {
    console.error("Linear webhook: failed to trigger task", err);
    return json({ success: false }, { status: 500 });
  }
}
