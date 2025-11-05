import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { tool } from "npm:ai@5.0.87";
import z from "npm:zod@^3.24.1/v3";
import { ChatContext } from "../agents/shared/context.ts";

const model = new Supabase.ai.Session("gte-small");

export const getPartSchema = z
  .object({
    readableId: z.string().optional(),
    description: z.string().optional(),
  })
  .refine((data) => data.readableId || data.description, {
    message: "Either readableId or description must be provided",
  });

export const getPartTool = tool({
  description: "Search for a part by description or readable id",
  inputSchema: getPartSchema,
  execute: async function (args, executionOptions) {
    const context = executionOptions.experimental_context as ChatContext;
    let { readableId, description } = args;
    
    if (readableId) {
      const [part, supplierPart] = await Promise.all([
        context.client
          .from("item")
          .select("*")
          .or(
            `readableId.eq.${readableId},readableIdWithRevision.eq.${readableId}`
          )
          .eq("companyId", context.companyId)
          .order("revision", { ascending: false })
          .limit(1),
        context.client
          .from("supplierPart")
          .select("*, item(*)")
          .eq("supplierPartId", readableId)
          .eq("companyId", context.companyId)
          .single(),
      ]);

      if (supplierPart.data) {
        return {
          id: supplierPart.data.itemId,
          name: supplierPart.data.item?.name,
          description: supplierPart.data.item?.description,
          supplierId: supplierPart.data.supplierId,
        };
      }
      if (part.data?.[0]) {
        return {
          id: part.data[0].id,
          name: part.data[0].name,
          description: part.data[0].description,
        };
      }

      if (!description) {
        description = readableId;
      } else {
        return null;
      }
    }

    if (description) {
      const embedding = await generateEmbedding(description);
      const search = await context.client.rpc("items_search", {
        query_embedding: JSON.stringify(embedding),
        match_threshold: 0.7,
        match_count: 10,
        p_company_id: context.companyId,
      });

      if (search.data && search.data.length > 0) {
        return search.data;
      }
    }

    return null;
  },
});

async function generateEmbedding(text: string): Promise<number[]> {
  const embedding = await model.run(text, {
    mean_pool: true,
    normalize: true,
  });

  return embedding as number[];
}

