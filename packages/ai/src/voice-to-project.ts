import { z } from "zod";
import { claudeClient, FLOWAI_MODEL } from "./client";
import { PROMPT_VOICE_TO_PROJECT as systemPrompt } from "./prompts";

export const voiceToProjectResult = z.object({
  contact: z.object({
    kind: z.enum(["person", "company"]),
    salutation: z.string().nullable(),
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    company_name: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    mobile: z.string().nullable(),
    address: z.object({
      street: z.string().nullable(),
      zip: z.string().nullable(),
      city: z.string().nullable(),
    }),
  }),
  project: z.object({
    title: z.string(),
    type_hint: z.enum(["wärmepumpe_lwp", "wärmepumpe_swp", "sanierung", "wartung", "beratung", "sonstiges"]),
    trade: z.enum(["SHK", "Elektro", "Spengler", "sonstige"]),
    description: z.string(),
    potential_value_eur: z.number().nullable(),
    preferred_appointment_at: z.string().nullable(),
  }),
  tasks: z.array(z.object({ title: z.string(), due_in_days: z.number() })),
  uncertainties: z.array(z.string()),
});
export type VoiceToProjectResult = z.infer<typeof voiceToProjectResult>;

/** Takes a (Whisper-)transcribed string from a voice memo. */
export async function voiceToProject(transcript: string): Promise<VoiceToProjectResult> {
  const client = claudeClient();
  const resp = await client.messages.create({
    model: FLOWAI_MODEL,
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: "user", content: `Transkript:\n\n${transcript}` }],
  });
  const text = resp.content.find((b) => b.type === "text")?.text ?? "";
  return voiceToProjectResult.parse(JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}"));
}
