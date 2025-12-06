import { validationError, validator } from "@carbon/form";
import { error, success } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { flash } from "@carbon/auth/session.server";
import { redirect, useLoaderData, useNavigate, useParams } from "@remix-run/react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@vercel/remix";
import { json } from "@vercel/remix";
import {
  getTrainingAssignment,
  getTrainingAssignmentStatus,
  getTrainingsList,
  trainingAssignmentValidator,
  upsertTrainingAssignment,
} from "~/modules/people";
import type { TrainingAssignmentStatusItem, TrainingListItem } from "~/modules/people/types";
import TrainingAssignmentForm from "~/modules/people/ui/Training/TrainingAssignmentForm";
import type { Handle } from "~/utils/handle";
import { path } from "~/utils/path";

export const handle: Handle = {
  breadcrumb: "Edit Assignment",
  to: path.to.trainingAssignments,
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { client, companyId } = await requirePermissions(request, {
    view: "people",
    role: "employee",
  });

  const { assignmentId } = params;
  if (!assignmentId) {
    throw redirect(
      path.to.trainingAssignments,
      await flash(request, error(null, "Assignment ID is required"))
    );
  }

  const assignmentIdNum = parseInt(assignmentId, 10);
  if (isNaN(assignmentIdNum)) {
    throw redirect(
      path.to.trainingAssignments,
      await flash(request, error(null, "Invalid assignment ID"))
    );
  }

  const [assignment, trainings, assignmentStatus] = await Promise.all([
    getTrainingAssignment(client, assignmentIdNum),
    getTrainingsList(client, companyId),
    getTrainingAssignmentStatus(client, companyId, {
      // We'll filter by trainingId which we'll get from the assignment
    }),
  ]);

  if (assignment.error) {
    throw redirect(
      path.to.trainingAssignments,
      await flash(request, error(assignment.error, "Error loading assignment"))
    );
  }

  if (trainings.error) {
    throw redirect(
      path.to.trainingAssignments,
      await flash(request, error(trainings.error, "Error loading trainings"))
    );
  }

  // Filter assignment status by trainingAssignmentId
  const filteredStatus = (assignmentStatus.data ?? []).filter(
    (s) => s.trainingAssignmentId === assignmentIdNum
  );

  const currentPeriod =
    filteredStatus.length > 0 ? filteredStatus[0].currentPeriod : null;

  return json({
    assignment: assignment.data,
    trainings: (trainings.data ?? []) as TrainingListItem[],
    assignmentStatus: filteredStatus as TrainingAssignmentStatusItem[],
    currentPeriod,
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { client, userId } = await requirePermissions(request, {
    update: "people",
    role: "employee",
  });

  const { assignmentId } = params;
  if (!assignmentId) {
    return json(
      { error: "Assignment ID is required" },
      { status: 400 }
    );
  }

  const assignmentIdNum = parseInt(assignmentId, 10);
  if (isNaN(assignmentIdNum)) {
    return json(
      { error: "Invalid assignment ID" },
      { status: 400 }
    );
  }

  const formData = await request.formData();
  const validation = await validator(trainingAssignmentValidator).validate(
    formData
  );

  if (validation.error) {
    return validationError(validation.error);
  }

  const { trainingId, groupIds } = validation.data;

  const result = await upsertTrainingAssignment(client, {
    id: assignmentIdNum,
    trainingId,
    groupIds,
    companyId: "", // not used for updates
    updatedBy: userId,
  });

  if (result.error) {
    return json(
      { error: result.error.message },
      {
        status: 500,
        headers: await flash(
          request,
          error(result.error, "Failed to update assignment")
        ),
      }
    );
  }

  throw redirect(
    path.to.trainingAssignments,
    await flash(request, success("Assignment updated successfully"))
  );
}

export default function EditTrainingAssignmentRoute() {
  const { assignment, trainings, assignmentStatus, currentPeriod } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const params = useParams();

  const initialValues = {
    id: parseInt(params.assignmentId!, 10),
    trainingId: assignment?.trainingId ?? "",
    groupIds: assignment?.groupIds ?? [],
  };

  return (
    <TrainingAssignmentForm
      initialValues={initialValues}
      trainings={trainings}
      assignmentStatus={assignmentStatus}
      currentPeriod={currentPeriod}
      onClose={() => navigate(path.to.trainingAssignments)}
    />
  );
}
