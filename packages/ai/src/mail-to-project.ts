import { z } from "zod";
import { claudeClient, FLOWAI_MODEL } from "./client";
import { PROMPT_MAIL_TO_PROJECT as systemPrompt } from "./prompts";

export const mailToProjectResult = z.object({
  is_new_inquiry: z.boolean(),
  intent: z.enum(["neue_anfrage", "rückfrage_bestehend", "spam", "rechnung_lieferant", "sonstiges"]),
  matched_contact_hint: z.string().nullable(),
  extracted: z.object({
    name: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    address_street: z.string().nullable(),
    address_zip: z.string().nullable(),
    address_city: z.string().nullable(),
    trade: z.enum(["SHK", "Elektro", "sonstige"]),
    scope_summary: z.string(),
    preferred_callback_at: z.string().nullable(),
    urgency: z.enum(["low", "normal", "high"]),
  }),
  suggested_actions: z.array(z.string()),
});
export type MailToProjectResult = z.infer<typeof mailToProjectResult>;

export async function mailToProject(input: { from: string; subject: string; body: string }): Promise<MailToProjectResult> {
  const client = claudeClient();
  const resp = await client.messages.create({
    model: FLOWAI_MODEL,
    max_tokens: 1200,
    system: systemPrompt,
    messages: [
      { role: "user", content: `Von: ${input.from}\nBetreff: ${input.subject}\n\n${input.body}` },
    ],
  });
  const text = resp.content.find((b) => b.type === "text")?.text ?? "";
  return mailToProjectResult.parse(JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}"));
}
