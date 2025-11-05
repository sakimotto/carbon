import { openai } from "../../lib/ai/openai.ts";
import { purchasingAgent } from "./purchasing.ts";
import { createAgent } from "./shared/agent.ts";
import { formatContextForLLM } from "./shared/prompts.ts";

export const mainAgent = createAgent({
  name: "triage",
  model: openai("gpt-4o-mini"),
  temperature: 0.1,
  modelSettings: {
    toolChoice: {
      type: "tool",
      toolName: "handoff_to_agent",
    },
  },
  instructions: (ctx) => `Route user requests to the appropriate specialist.

<background-data>
${formatContextForLLM(ctx)}

<agent-capabilities>
general: General questions, greetings, web search
purchasing: creating purchase orders or getting quotes from suppliers
parts: searching for parts or creating new parts
suppliers: searching for suppliers or creating new suppliers
</agent-capabilities>
</background-data>`,
  handoffs: [
    purchasingAgent,
    // partsAgent,
    // suppliersAgent,
  ],
  maxTurns: 1,
});
