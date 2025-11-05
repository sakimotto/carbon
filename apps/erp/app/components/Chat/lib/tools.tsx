import type { ComponentType, SVGProps } from "react";
import { LuArrowRight, LuBrain, LuSearch, LuShoppingCart, LuSquareStack } from "react-icons/lu";

export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export interface ToolConfig {
  name: string;
  icon: IconComponent;
  description?: string;
}

export const TOOL_CONFIGS: Record<string, ToolConfig> = {
  // Purchasing tools
  createPurchaseOrder: {
    name: "Create Purchase Order",
    icon: LuShoppingCart,
    description: "Creating a purchase order",
  },
  getPart: {
    name: "Get Part",
    icon: LuSquareStack,
    description: "Searching for a part",
  },
  getSupplier: {
    name: "Get Supplier",
    icon: LuSearch,
    description: "Searching for a supplier",
  },
  getSupplierForParts: {
    name: "Get Supplier for Parts",
    icon: LuSearch,
    description: "Searching for suppliers for parts",
  },

  // Research tools
  webSearch: {
    name: "Web Search",
    icon: LuSearch,
    description: "Searching the web",
  },

  // Memory tools
  updateWorkingMemory: {
    name: "Update Memory",
    icon: LuBrain,
    description: "Updating working memory",
  },

  // Handoff tools
  handoff_to_agent: {
    name: "Routing",
    icon: LuArrowRight,
    description: "Routing to specialist",
  },
};

/**
 * Get tool configuration by tool name
 */
export function getToolConfig(toolName: string): ToolConfig | null {
  return TOOL_CONFIGS[toolName] || null;
}

/**
 * Get tool icon component by tool name
 */
export function getToolIcon(toolName: string): IconComponent | null {
  const config = getToolConfig(toolName);
  return config?.icon || null;
}

/**
 * Get tool display name by tool name
 */
export function getToolDisplayName(toolName: string): string | null {
  const config = getToolConfig(toolName);
  return config?.name || null;
}
