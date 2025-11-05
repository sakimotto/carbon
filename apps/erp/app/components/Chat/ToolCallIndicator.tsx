import { cn, TextShimmer } from "@carbon/react";
import { LuGlobe, LuSearch, LuShoppingCart, LuSquareStack } from "react-icons/lu";

export const toolDisplayConfig = {
  createPurchaseOrder: {
    displayText: "Purchasing",
    icon: LuShoppingCart,
  },
  getSupplier: {
    displayText: "Getting Supplier",
    icon: LuSearch,
  },
  getSupplierForParts: {
    displayText: "Getting Supplier for Parts",
    icon: LuSearch,
  },
  getPart: {
    displayText: "Getting Part",
    icon: LuSquareStack,
  },
  webSearch: {
    displayText: "Searching the Web",
    icon: LuGlobe,
  },
} as const;

export type SupportedToolName = keyof typeof toolDisplayConfig;

export interface ToolCallIndicatorProps {
  toolName: SupportedToolName;
  className?: string;
}

export function ToolCallIndicator({
  toolName,
  className,
}: ToolCallIndicatorProps) {
  const config = toolDisplayConfig[toolName];

  if (!config) {
    return null;
  }

  return (
    <div className={cn("flex justify-start mt-3 animate-fade-in", className)}>
      <div className="border px-3 py-1 flex items-center gap-2 w-fit">
        <div className="flex items-center justify-center size-3.5">
          <config.icon size={14} />
        </div>
        <TextShimmer className="text-xs text-[#707070]" duration={1}>
          {config.displayText}
        </TextShimmer>
      </div>
    </div>
  );
}
