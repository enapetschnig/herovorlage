import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | null = null;

export function claudeClient(): Anthropic {
  if (cached) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing — set in .env.local to use FlowAI");
  cached = new Anthropic({ apiKey });
  return cached;
}

/** Default model. Per CLAUDE.md Teil F.8: claude-sonnet-4-6 or newer. */
export const FLOWAI_MODEL = process.env.FLOWAI_MODEL ?? "claude-sonnet-4-6";

/** Long-context model for assistant chat that needs the full project history. */
export const FLOWAI_MODEL_LONG = process.env.FLOWAI_MODEL_LONG ?? "claude-opus-4-7";
