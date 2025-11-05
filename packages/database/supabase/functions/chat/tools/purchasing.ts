import { Transaction } from "https://esm.sh/v135/kysely@0.26.3/dist/cjs/kysely.d.ts";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { tool } from "npm:ai@5.0.87";
import z from "npm:zod@^3.24.1/v3";
import { getCurrencyByCode } from "../../lib/api/accounting.ts";
import {
  deletePurchaseOrder,
  getSupplier as getSupplierById,
  getSupplierPayment,
  getSupplierShipping,
  insertSupplierInteraction,
} from "../../lib/api/purchasing.ts";
import { DB } from "../../lib/database.ts";
import { getNextSequence } from "../../shared/get-next-sequence.ts";
import { ChatContext } from "../agents/shared/context.ts";



export const createPurchaseOrderSchema = z.object({
  supplierId: z.string(),
  parts: z.array(
    z.object({
      partId: z.string(),
      quantity: z.number().positive().default(1),
    })
  ),
})

export const createPurchaseOrderTool = tool({
  description:
    "Create a purchase order from a list of parts and a supplier",
  inputSchema: createPurchaseOrderSchema,
  execute: async function (args, executionOptions) {
    const context = executionOptions.experimental_context as ChatContext;
    const [
      nextSequence,
      supplierInteraction,
      supplier,
      supplierPayment,
      supplierShipping,
      // purchaser
    ] = await Promise.all([
      getNextSequence(
        context.db as unknown as Transaction<DB>,
        "purchaseOrder",
        context.companyId
      ),
      insertSupplierInteraction(context.db, context.companyId, args.supplierId),
      getSupplierById(context.db, args.supplierId),
      getSupplierPayment(context.db, args.supplierId),
      getSupplierShipping(context.db, args.supplierId),
      // getEmployeeJob(client, context.userId, context.companyId),
    ]);

    if (!supplierInteraction) {
      return {
        error: "Failed to create supplier interaction",
      };
    }

    if (!supplier) {
      return {
        error: "Supplier not found",
      };
    }
    if (!supplierPayment) {
      return {
        error: "Supplier payment not found",
      };
    }
    if (!supplierShipping) {
      return {
        error: "Supplier shipping not found",
      };
    }

    const purchaseOrder = {
      purchaseOrderId: nextSequence,
      supplierId: args.supplierId,
      supplierInteractionId: supplierInteraction?.id! ?? null,
      exchangeRate: 1,
      exchangeRateUpdatedAt: new Date().toISOString(),
      companyId: context.companyId,
      createdBy: context.userId,
    };

    const {
      paymentTermId,
      invoiceSupplierId,
      invoiceSupplierContactId,
      invoiceSupplierLocationId,
    } = supplierPayment;

    const { shippingMethodId, shippingTermId } = supplierShipping;

    if (supplier.currencyCode) {
      const currency = await getCurrencyByCode(
        // @ts-ignore: kysely transaction type compatibility
        context.db,
        context.companyId,
        supplier.currencyCode
      );
      if (currency) {
        purchaseOrder.exchangeRate = currency.exchangeRate ?? 1;
        purchaseOrder.exchangeRateUpdatedAt = new Date().toISOString();
      }
    }

    const order = await context.db
      .insertInto("purchaseOrder")
      .values([purchaseOrder])
      .returning(["id", "purchaseOrderId"])
      .executeTakeFirst();

    if (!order) {
      return {
        error: "Failed to create purchase order",
      };
    }

    const purchaseOrderId = order.id;
    const locationId = null; // TODO

    if (!purchaseOrderId) {
      return {
        error: "Failed to create purchase order",
      };
    }

    try {
      await Promise.all([
        context.db
          .insertInto("purchaseOrderDelivery")
          .values({
            id: purchaseOrderId,
            locationId: locationId,
            shippingMethodId: shippingMethodId,
            shippingTermId: shippingTermId,
            companyId: context.companyId,
          })
          .executeTakeFirstOrThrow(),
        context.db
          .insertInto("purchaseOrderPayment")
          .values({
            id: purchaseOrderId,
            invoiceSupplierId: invoiceSupplierId,
            invoiceSupplierContactId: invoiceSupplierContactId,
            invoiceSupplierLocationId: invoiceSupplierLocationId,
            paymentTermId: paymentTermId,
            companyId: context.companyId,
          })
          .executeTakeFirstOrThrow(),
      ]);

      // Create purchase order lines for each part
      await Promise.all(
        args.parts.map(async (part: { partId: string; quantity: number }) => {
          // Get item details
          const [item, supplierPart] = await Promise.all([
            context.db
              .selectFrom("item")
              .select([
                "id",
                "name",
                "readableIdWithRevision",
                "type",
                "unitOfMeasureCode",
              ])
              .where("id", "=", part.partId)
              .where("companyId", "=", context.companyId)
              .executeTakeFirst(),
            context.db
              .selectFrom("supplierPart")
              .selectAll()
              .where("itemId", "=", part.partId)
              .where("companyId", "=", context.companyId)
              .where("supplierId", "=", args.supplierId)
              .executeTakeFirst(),
          ]);

          if (!item) {
            throw new Error(`Item not found: ${part.partId}`);
          }

          // Get item cost and replenishment info
          const [itemCost, itemReplenishment] = await Promise.all([
            context.db
              .selectFrom("itemCost")
              .select(["unitCost"])
              .where("itemId", "=", part.partId)
              .executeTakeFirst(),
            context.db
              .selectFrom("itemReplenishment")
              .select([
                "purchasingUnitOfMeasureCode",
                "conversionFactor",
                "leadTime",
              ])
              .where("itemId", "=", part.partId)
              .executeTakeFirst(),
          ]);

          // Create the purchase order line
          return context.db
            .insertInto("purchaseOrderLine")
            .values({
              purchaseOrderId: purchaseOrderId,
              itemId: part.partId,
              description: item.name,
              purchaseOrderLineType: item.type,
              purchaseQuantity: part.quantity,
              supplierUnitPrice:
                (supplierPart?.unitPrice ?? itemCost?.unitCost ?? 0) /
                purchaseOrder.exchangeRate,
              supplierShippingCost: 0,
              purchaseUnitOfMeasureCode:
                supplierPart?.supplierUnitOfMeasureCode ??
                itemReplenishment?.purchasingUnitOfMeasureCode ??
                item.unitOfMeasureCode ??
                "EA",
              inventoryUnitOfMeasureCode: item.unitOfMeasureCode ?? "EA",
              conversionFactor:
                supplierPart?.conversionFactor ??
                itemReplenishment?.conversionFactor ??
                1,
              locationId: locationId,
              shelfId: null,
              supplierTaxAmount: 0,
              companyId: context.companyId,
              createdBy: context.userId,
            })
            .returning(["id"])
            .executeTakeFirstOrThrow();
        })
      );

      return order;
    } catch (error) {
      if (purchaseOrderId) {
        await deletePurchaseOrder(context.db, purchaseOrderId);
      }
      return {
        error: `Failed to create purchase order details: ${error.message}`,
      };
    }
  },
});

