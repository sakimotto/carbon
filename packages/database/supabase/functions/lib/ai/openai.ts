import { createOpenAI } from "npm:@ai-sdk/openai@2.0.60";

export const openai = createOpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});
