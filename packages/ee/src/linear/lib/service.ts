import type { Database } from "@carbon/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { markdownToTiptap } from "./richtext";
import { LinearWorkStateType, mapLinearStatusToCarbonStatus } from "./utils";

export const LinearIssueSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullish(),
  url: z.string(),
  state: z.object({
    name: z.string(),
    color: z.string(),
    type: z.nativeEnum(LinearWorkStateType),
  }),
  identifier: z.string(),
  dueDate: z.string().nullish(),
  assignee: z
    .object({
      email: z.string(),
    })
    .nullish(),
});

export async function getLinearIntegration(
  client: SupabaseClient<Database>,
  companyId: string
) {
  return await client
    .from("companyIntegration")
    .select("*")
    .eq("companyId", companyId)
    .eq("id", "linear")
    .limit(1);
}

export function linkActionToLinearIssue(
  client: SupabaseClient<Database>,
  companyId: string,
  input: {
    actionId: string;
    issue: z.infer<typeof LinearIssueSchema>;
    assignee?: string | null;
    syncNotes?: boolean;
  }
) {
  const { data, success } = LinearIssueSchema.safeParse(input.issue);

  if (!success) return null;

  // Convert Linear description (markdown) to Tiptap format for notes
  let notes: any = undefined;
  if (input.syncNotes && data.description) {
    try {
      notes = markdownToTiptap(data.description);
    } catch (e) {
      console.error("Failed to convert Linear description to Tiptap:", e);
    }
  }

  const updateData: Record<string, any> = {
    externalId: {
      linear: data,
    },
    assignee: input.assignee,
    status: mapLinearStatusToCarbonStatus(data.state.type!),
    dueDate: data.dueDate,
  };

  // Only update notes if we successfully converted the description
  if (notes !== undefined) {
    updateData.notes = notes;
  }

  return client
    .from("nonConformanceActionTask")
    .update(updateData)
    .eq("companyId", companyId)
    .eq("id", input.actionId)
    .select("nonConformanceId");
}

export const getCompanyEmployees = async (
  client: SupabaseClient<Database>,
  companyId: string,
  emails: string[]
) => {
  const users = await client
    .from("userToCompany")
    .select("userId,user(email)")
    .eq("companyId", companyId)
    .eq("role", "employee")
    .in("user.email", emails);

  return users.data ?? [];
};

export function unlinkActionFromLinearIssue(
  client: SupabaseClient<Database>,
  companyId: string,
  input: {
    actionId: string;
    assignee?: string | null;
  }
) {
  return client
    .from("nonConformanceActionTask")
    .update({
      externalId: {
        linear: undefined,
      },
    })
    .eq("companyId", companyId)
    .eq("id", input.actionId)
    .select("nonConformanceId");
}

export const getLinearIssueFromExternalId = async (
  client: SupabaseClient<Database>,
  companyId: string,
  actionId: string
) => {
  const { data: action } = await client
    .from("nonConformanceActionTask")
    .select("externalId")
    .eq("companyId", companyId)
    .eq("id", actionId)
    .maybeSingle();

  if (!action) return null;

  const { data } = LinearIssueSchema.safeParse(
    (action.externalId as any)?.linear
  );

  if (!data) return null;

  return data;
};
