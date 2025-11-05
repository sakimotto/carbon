import SupabaseClient from "https://esm.sh/v135/@supabase/supabase-js@2.33.1/dist/module/SupabaseClient.d.ts";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { tool } from "npm:ai@5.0.87";
import z from "npm:zod@^3.24.1/v3";
import { Database } from "../../lib/types.ts";
import { ChatContext } from "../agents/shared/context.ts";

const model = new Supabase.ai.Session("gte-small");

export const getSupplierSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    partIds: z.array(z.string()).optional(),
  })
  .refine(
    (data) => data.id || data.name || data.description || data.partIds,
    {
      message: "Either id, name, description, or partIds must be provided",
    }
  );

export const getSupplierTool = tool({
  description:
    "Search for suppliers by a specific name as specified by the user, a deduced description, or a list of part ids",
  inputSchema: getSupplierSchema,
  execute: async function (args, executionOptions) {
    const context = executionOptions.experimental_context as ChatContext;
    let { name, description, partIds } = args;

    if (args.id) {
      const supplier = await context.client
        .from("supplier")
        .select("*")
        .eq("id", args.id)
        .eq("companyId", context.companyId)
        .single();
      if (supplier.data) {
        return {
          id: supplier.data.id,
          name: supplier.data.name,
        };
      }
    }

    if (partIds && partIds.length > 0) {
      return getSuppliersForParts(context.client, partIds, context);
    }

    if (args.name) {
      const supplier = await context.client
        .from("supplier")
        .select("*")
        .eq("name", args.name)
        .eq("companyId", context.companyId)
        .single();
      if (supplier.data) {
        return {
          id: supplier.data.id,
        };
      }
      if (!description) {
        description = name;
      }
    }

    if (description) {
      const embedding = await generateEmbedding(description);
      const search = await context.client.rpc("suppliers_search", {
        query_embedding: JSON.stringify(embedding),
        match_threshold: 0.8,
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

export const getSupplierForPartsSchema = z.object({
  partIds: z.array(z.string()),
});

export const getSupplierForPartsTool = tool({
  description: "Suggest a list of suppliers for a given list of parts",
  inputSchema: getSupplierForPartsSchema,
  execute: async function (args, executionOptions) {
    const context = executionOptions.experimental_context as ChatContext;
    return await getSuppliersForParts(context.client, args.partIds, context);
  },
});

async function getSuppliersForParts(
  client: SupabaseClient<Database>,
  partIds: string[],
  context: { companyId: string }
) {
  // Find suppliers that provide these parts
  const [supplierParts, preferredSuppliers] = await Promise.all([
    client
      .from("supplierPart")
      .select("itemId, supplierId, unitPrice, supplierUnitOfMeasureCode")
      .in("itemId", partIds)
      .eq("companyId", context.companyId),
    client
      .from("itemReplenishment")
      .select("itemId, preferredSupplierId")
      .in("itemId", partIds)
      .eq("companyId", context.companyId),
  ]);

  if (partIds.length === 1) {
    const preferredSupplier = preferredSuppliers.data?.find(
      (p) => p.itemId === partIds[0]
    );
    if (preferredSupplier) {
      return {
        id: preferredSupplier.preferredSupplierId,
      };
    }

    const firstSupplier = supplierParts.data?.find(
      (p) => p.itemId === partIds[0]
    );
    if (firstSupplier) {
      return {
        id: firstSupplier.supplierId,
      };
    }
  }

  // Count occurrences of each supplier in preferred suppliers
  const preferredSupplierCounts =
    preferredSuppliers.data?.reduce((counts, item) => {
      if (item.preferredSupplierId) {
        counts[item.preferredSupplierId] =
          (counts[item.preferredSupplierId] || 0) + 1;
      }
      return counts;
    }, {} as Record<string, number>) || {};

  // Find the most frequent preferred supplier
  let mostFrequentPreferredSupplierId: string | null = null;
  let maxPreferredCount = 0;

  for (const [supplierId, count] of Object.entries(preferredSupplierCounts)) {
    if (count > maxPreferredCount) {
      maxPreferredCount = count;
      mostFrequentPreferredSupplierId = supplierId;
    }
  }

  // If we found a preferred supplier, return it
  if (mostFrequentPreferredSupplierId) {
    return {
      id: mostFrequentPreferredSupplierId,
    };
  }

  // If no preferred supplier, count occurrences in supplierParts
  const supplierPartCounts =
    supplierParts.data?.reduce((counts, item) => {
      if (item.supplierId) {
        counts[item.supplierId] = (counts[item.supplierId] || 0) + 1;
      }
      return counts;
    }, {} as Record<string, number>) || {};

  // Find the most frequent supplier from supplierParts
  let mostFrequentSupplierId: string | null = null;
  let maxCount = 0;

  for (const [supplierId, count] of Object.entries(supplierPartCounts)) {
    if (count > maxCount) {
      maxCount = count;
      mostFrequentSupplierId = supplierId;
    }
  }

  // Return the most frequent supplier if found
  if (mostFrequentSupplierId) {
    const supplier = supplierParts.data?.find(
      (p) => p.supplierId === mostFrequentSupplierId
    );
    return {
      id: mostFrequentSupplierId,
      unitPrice: supplier?.unitPrice,
      supplierUnitOfMeasureCode: supplier?.supplierUnitOfMeasureCode,
    };
  }

  // Return null if no supplier was found
  return null;
}

async function generateEmbedding(text: string): Promise<number[]> {
  const embedding = await model.run(text, {
    mean_pool: true,
    normalize: true,
  });

  return embedding as number[];
}

