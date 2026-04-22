import { z } from "zod";
import { claudeClient, FLOWAI_MODEL } from "./client";
import { PROMPT_OCR_RECEIPT as systemPrompt } from "./prompts";

export const ocrReceiptResult = z.object({
  supplier: z.object({
    name: z.string(),
    vat_id: z.string().nullable(),
    match_confidence: z.enum(["low", "medium", "high"]),
  }),
  invoice: z.object({
    number: z.string(),
    date: z.string(),
    due_date: z.string().nullable(),
    currency: z.enum(["EUR", "CHF"]),
    total_net: z.number(),
    total_vat: z.number(),
    total_gross: z.number(),
    vat_breakdown: z.array(z.object({ rate_pct: z.number(), net: z.number(), vat: z.number() })),
  }),
  positions: z.array(
    z.object({
      article_number: z.string().nullable(),
      description: z.string(),
      quantity: z.number(),
      unit: z.string(),
      unit_price: z.number(),
      total: z.number(),
      vat_pct: z.number(),
    }),
  ),
  matched_project_hints: z.array(z.string()),
  suggested_account_skr03: z.string().nullable(),
  suggested_account_skr04: z.string().nullable(),
});
export type OcrReceiptResult = z.infer<typeof ocrReceiptResult>;

export async function ocrReceipt(image: string, mediaType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf"): Promise<OcrReceiptResult> {
  const client = claudeClient();
  const isPdf = mediaType === "application/pdf";
  const resp = await client.messages.create({
    model: FLOWAI_MODEL,
    max_tokens: 3000,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          isPdf
            ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: image } }
            : { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
          { type: "text", text: "Bitte extrahieren und JSON gemäß Schema zurückgeben." },
        ],
      },
    ],
  });
  const text = resp.content.find((b) => b.type === "text")?.text ?? "";
  return ocrReceiptResult.parse(JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}"));
}
