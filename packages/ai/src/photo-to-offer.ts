import { z } from "zod";
import { claudeClient, FLOWAI_MODEL } from "./client";
import { PROMPT_PHOTO_TO_OFFER } from "./prompts";

const systemPrompt = PROMPT_PHOTO_TO_OFFER;

export const photoToOfferResult = z.object({
  existing_system: z.object({
    type: z.string(),
    brand_guess: z.string(),
    model_guess: z.string(),
    year_guess: z.number().nullable(),
    power_kw_guess: z.number().nullable(),
    confidence: z.enum(["low", "medium", "high"]),
  }),
  condition_notes: z.string(),
  recommended_systems: z.array(
    z.object({
      type: z.enum(["luft_wasser", "sole_wasser", "grundwasser"]),
      brand: z.string(),
      model: z.string(),
      power_kw: z.number(),
      rationale: z.string(),
    }),
  ),
  hydraulics: z.object({
    buffer_liters: z.number(),
    needs_heating_rod: z.boolean(),
    needs_expansion_vessel: z.boolean(),
    needs_mixer: z.boolean(),
    notes: z.string(),
  }),
  open_questions: z.array(z.string()),
});
export type PhotoToOfferResult = z.infer<typeof photoToOfferResult>;

/**
 * Analyse a heating-room photo and propose a heat-pump offer skeleton.
 * @param image - base64-encoded JPEG/PNG (without data URL prefix)
 * @param mediaType - "image/jpeg" | "image/png" | "image/webp"
 */
export async function photoToOffer(image: string, mediaType: "image/jpeg" | "image/png" | "image/webp"): Promise<PhotoToOfferResult> {
  const client = claudeClient();
  const resp = await client.messages.create({
    model: FLOWAI_MODEL,
    max_tokens: 2000,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
          { type: "text", text: "Bitte analysieren und JSON gemäß Schema zurückgeben." },
        ],
      },
    ],
  });

  const text = resp.content.find((b) => b.type === "text")?.text ?? "";
  const json = extractJson(text);
  return photoToOfferResult.parse(json);
}

function extractJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Claude returned no JSON block");
  return JSON.parse(match[0]);
}
