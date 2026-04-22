import { claudeClient, FLOWAI_MODEL } from "./client";
import { PROMPT_ASSISTANT_SYSTEM as systemPrompt } from "./prompts";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type AssistantContext = {
  user: { id: string; name: string; role: string };
  tenant: { id: string; name: string };
  /** Page-specific context — e.g. project summary, contact summary, document summary. */
  page?: Record<string, unknown>;
};

/** Streams an assistant reply. Caller handles SSE/streaming on the wire. */
export async function* assistantStream(history: ChatMessage[], ctx: AssistantContext): AsyncGenerator<string> {
  const client = claudeClient();
  const contextBlock =
    `## Kontext\n` +
    `User: ${ctx.user.name} (${ctx.user.role})\n` +
    `Betrieb: ${ctx.tenant.name}\n` +
    (ctx.page ? `\nSeitenkontext:\n\`\`\`json\n${JSON.stringify(ctx.page, null, 2)}\n\`\`\`` : "");

  const stream = await client.messages.stream({
    model: FLOWAI_MODEL,
    max_tokens: 1500,
    system: [
      { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
      { type: "text", text: contextBlock },
    ],
    messages: history.map((m) => ({ role: m.role, content: m.content })),
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}
