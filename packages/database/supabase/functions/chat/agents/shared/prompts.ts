import { ChatContext } from "./context.ts";

export const PROFILE_PROMPT = `<user_profile>
Name: [Learn from conversation]
Role: [CFO, purchasing, production manager, salesman, etc.]
</user_profile>

<financial_focus>
Key Metrics: [Revenue, purchase orders, lead time, on time deliveries, etc.]
Recent Concerns: [Outstanding accounts payable]
</financial_focus>

<business_context>
Industry: [If mentioned]
Company Size: [SMB, startup, mid-market, public company]
</business_context>

<communication_preferences>
Style: [Formal vs casual, technical vs simplified]
Tone: [Professional, friendly, analytical, etc.]
</communication_preferences>`;

export const TITLE_PROMPT = `Generate a concise title that reflects the user's main focus.

- Identify the core subject or objective, not the specific question - Use descriptive phrases (e.g., "Budget Travel Tips" not "How to Travel on a Budget") Use title case (capitalize all principal words) - Exclude periods unless for abbreviations - Apply appropriate abbreviations (FYI, ASAP, etc.) Create a title for the discussion. Only return the title. Maximum 60 characters.`;

export const SUGGESTION_PROMPT = `<instructions>
Generate 5 brief follow-up suggestions (2-3 words each, max 5 words).

<suggestion_guidelines>
After showing data/metrics:
- Compare periods or categories
- Show related metrics
- Visualize trends (charts/graphs)
- Drill into details
- Analyze patterns

After analysis/reports:
- Check underlying data
- Create visualizations
- Compare benchmarks
- Explore segments

After lists/tables:
- Filter or sort
- Show details
- Visualize distribution
- Analyze patterns
</suggestion_guidelines>

<visualization_support>
When data would benefit from visual representation, suggest creating artifacts:
- "Visualize trends" → Line chart of time series
- "Chart distribution" → Bar/pie chart
- "Graph comparison" → Multi-series chart
- "Plot forecast" → Projection visualization
</visualization_support>

<examples>
<example>
After showing purchase orders:
"Compare suppliers", "Show lead times", "Chart volumes", "Analyze delays", "Track deliveries"
</example>

<example>
After displaying inventory levels:
"Show turnover", "Chart movements", "Compare locations", "Analyze shortages", "Plot forecasts"
</example>

<example>
After presenting financial metrics:
"Compare periods", "Show cash flow", "Analyze ratios", "Chart performance", "Track budgets"
</example>
</examples>

<rules>
What NOT to suggest:
- "Tell me more" (too generic)
- "What else can you do?" (not contextual)
- Repeating what was just shown
</rules>
</instructions>`;

export function formatContextForLLM(context: ChatContext): string {
  return `<company_info>
<current_date>${context.currentDateTime}</current_date>
<timezone>${context.timezone}</timezone>
<company_name>${context.companyName}</company_name>
<base_currency>${context.baseCurrency}</base_currency>
<locale>${context.locale}</locale>
</company_info>

Important: Use the current date/time above for time-sensitive operations. User-specific information is maintained in your working memory.`;
}

export const COMMON_AGENT_RULES = `<behavior_rules>
- Call tools immediately without explanatory text
- Use parallel tool calls when possible
- Provide specific numbers and actionable insights
- Explain your reasoning
- Lead with the most important information first
- When presenting repeated structured data (lists of items, multiple entries, time series), always use markdown tables
- Tables make data scannable and easier to compare - use them for any data with 2+ rows
</behavior_rules>`;
