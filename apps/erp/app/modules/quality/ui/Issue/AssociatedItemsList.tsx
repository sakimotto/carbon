import { Select, ValidatedForm } from "@carbon/form";
import { Card, CardContent, CardHeader, CardTitle, toast } from "@carbon/react";
import { useFetcher } from "@remix-run/react";
import { useCallback, useEffect } from "react";
import { z } from "zod/v3";
import { usePermissions } from "~/hooks";
import type { action } from "~/routes/x+/issue+/item+/update";
import { useItems } from "~/stores";
import { path } from "~/utils/path";
import { disposition } from "../../quality.models";
import type { IssueAssociationNode } from "../../types";
import { DispositionStatus } from "./DispositionStatus";

type AssociatedItemsListProps = {
  associatedItems: IssueAssociationNode["children"];
};

export function AssociatedItemsList({
  associatedItems,
}: AssociatedItemsListProps) {
  const [items] = useItems();
  const permissions = usePermissions();
  const fetcher = useFetcher<typeof action>();

  useEffect(() => {
    if (fetcher.data?.error) {
      toast.error(fetcher.data.error.message);
    }
  }, [fetcher.data]);

  const onUpdateDisposition = useCallback(
    (nonConformanceItemId: string, dispositionValue: string | null) => {
      const formData = new FormData();
      formData.append("id", nonConformanceItemId);
      formData.append("field", "disposition");
      formData.append("value", dispositionValue ?? "");

      fetcher.submit(formData, {
        method: "post",
        action: path.to.updateIssueItem,
      });
    },
    [fetcher]
  );

  if (!associatedItems || associatedItems.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {associatedItems.length > 1 ? "Dispositions" : "Disposition"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col">
          {associatedItems.map((child) => {
            // Resolve item information from the items store using documentId
            const item = items.find((i) => i.id === child.documentId);

            if (!item) return null;

            return (
              <li
                key={child.id}
                className="bg-muted/30 border border-border rounded-lg w-full px-6 py-4"
              >
                <div className="flex items-center justify-between w-full gap-4">
                  <div className="flex flex-col flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">
                        {item.readableIdWithRevision}
                      </h3>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {item.name}
                    </span>
                  </div>
                  <ValidatedForm
                    defaultValues={{
                      disposition: (child as any).disposition ?? "Pending",
                    }}
                    validator={z.object({
                      disposition: z.string().optional(),
                    })}
                    className="flex-shrink-0"
                  >
                    <Select
                      options={disposition.map((d) => ({
                        value: d,
                        label: <DispositionStatus disposition={d} />,
                      }))}
                      isReadOnly={!permissions.can("update", "quality")}
                      label=""
                      name="disposition"
                      inline={(value) => {
                        return <DispositionStatus disposition={value} />;
                      }}
                      onChange={(value) => {
                        if (value) {
                          onUpdateDisposition(child.id, value.value);
                        }
                      }}
                    />
                  </ValidatedForm>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
