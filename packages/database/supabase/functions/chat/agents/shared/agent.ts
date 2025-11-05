import { Agent, type AgentConfig } from "npm:@ai-sdk-tools/agents@1.0.0";
import { UpstashProvider } from "npm:@ai-sdk-tools/memory@1.0.0/upstash";
import { Redis } from "npm:@upstash/redis@1.34.3";
import { openai } from "../../../lib/ai/openai.ts";
import type { ChatContext } from "./context.ts";
import { PROFILE_PROMPT, SUGGESTION_PROMPT, TITLE_PROMPT } from "./prompts.ts";

export const memoryProvider = new UpstashProvider(
  new Redis({
    url: Deno.env.get("UPSTASH_REDIS_REST_URL") ?? "",
    token: Deno.env.get("UPSTASH_REDIS_REST_TOKEN") ?? "",
  })
);

export const createAgent = (config: AgentConfig<ChatContext>) => {
  return new Agent({
    modelSettings: {
      parallel_tool_calls: true,
    },
    ...config,
    memory: {
      provider: memoryProvider,
      history: {
        enabled: true,
        limit: 10,
      },
      workingMemory: {
        enabled: true,
        template: PROFILE_PROMPT,
        scope: "user",
      },
      chats: {
        enabled: true,
        generateTitle: {
          model: openai("gpt-4.1-nano"),
          instructions: TITLE_PROMPT,
        },
        generateSuggestions: {
          enabled: true,
          model: openai("gpt-4.1-nano"),
          limit: 5,
          instructions: SUGGESTION_PROMPT,
        },
      },
    },
  });
};
