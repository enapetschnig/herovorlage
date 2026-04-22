import { moduleProcedure, router } from "../trpc";
import { schema } from "@heatflow/db";
import { FEATURES } from "@heatflow/utils/constants";
import { idFor } from "@heatflow/utils/ids";
import { photoToOffer, mailToProject, ocrReceipt, voiceToProject, transcribeAudio } from "@heatflow/ai";
import { TRPCError } from "@trpc/server";
import { and, eq, ilike, isNull, sql } from "drizzle-orm";
import { z } from "zod";

const M = FEATURES.M12_FLOW_AI;

function hasKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// -----------------------------------------------------------------------------
// Demo-Stubs — realistic canned outputs for devs without ANTHROPIC_API_KEY.
// Activated automatically when the key is missing, so the UI demo still works
// end-to-end. Each stub is clearly marked with `demo: true` in the response.
// -----------------------------------------------------------------------------
const PHOTO_DEMO = {
  existing_system: {
    type: "Öl-Brennwertkessel",
    brand_guess: "Viessmann",
    model_guess: "Vitorondens 200-T",
    year_guess: 2008,
    power_kw_guess: 24,
    confidence: "medium" as const,
  },
  condition_notes:
    "Kessel sichtbar verkalkt im oberen Bereich. Kein Pufferspeicher vorhanden. Hydraulik-Trennung fehlt — Öl-Versorgungsleitung muss vor WP-Montage zurückgebaut werden.",
  recommended_systems: [
    { type: "sole_wasser" as const, brand: "Viessmann", model: "Vitocal 350-G 10kW", power_kw: 10,
      rationale: "Sole/Wasser-WP bei 24kW Bestandslast mit Pufferspeicher-Kombination wirtschaftlich. COP ~4.5 in bivalenter Fahrweise." },
    { type: "luft_wasser" as const, brand: "Vaillant", model: "aroTHERM plus VWL 125/6 A S2", power_kw: 12,
      rationale: "Luft/Wasser als günstigere Alternative wenn keine Sole-Bohrung möglich. R290-Kältemittel, hoher SCOP." },
    { type: "luft_wasser" as const, brand: "NIBE", model: "F2120-12", power_kw: 12,
      rationale: "NIBE F2120 bei anspruchsvoller Altbausanierung mit hohen VL-Temperaturen bis 65°C." },
  ],
  hydraulics: {
    buffer_liters: 800,
    needs_heating_rod: true,
    needs_expansion_vessel: true,
    needs_mixer: true,
    notes: "800L Pufferspeicher empfohlen für Stromkosten-Optimierung mit PV-Überschuss-Integration. Heizstab 6 kW als Backup.",
  },
  open_questions: [
    "Existiert eine PV-Anlage? Dann FW-Modul für Eigenstromnutzung berücksichtigen.",
    "Schornstein-Rückbau nötig — Kostenvoranschlag Rauchfangkehrer einholen.",
    "Schallschutz-Abstand zur Grundstücksgrenze prüfen (Niederösterreichische BauO).",
    "Heizlastberechnung nach EN 12831 für exakte kW-Dimensionierung erforderlich.",
  ],
};

const MAIL_DEMO = {
  is_new_inquiry: true,
  intent: "neue_anfrage" as const,
  matched_contact_hint: null,
  extracted: {
    name: "Max Mustermann",
    email: "max.mustermann@example.at",
    phone: "+43 664 123456",
    address_street: "Seenstraße 12",
    address_zip: "9020",
    address_city: "Klagenfurt",
    trade: "SHK" as const,
    scope_summary: "Neubau EFH, 180m² Wohnfläche, Wärmepumpe + PV + Pufferspeicher. Bau startet Sommer 2026.",
    preferred_callback_at: null,
    urgency: "normal" as const,
  },
  suggested_actions: ["kontakt_anlegen", "projekt_erstellen", "rückruf_terminieren"],
};

const VOICE_DEMO = {
  contact: {
    kind: "person" as const,
    salutation: "Herr",
    first_name: "Maximilian",
    last_name: "Mustermann",
    company_name: null,
    email: null,
    phone: null,
    mobile: "+43 664 1234567",
    address: { street: "Seenstraße 12", zip: "9020", city: "Klagenfurt" },
  },
  project: {
    title: "EFH Mustermann — WP + PV + Pufferspeicher",
    type_hint: "wärmepumpe_lwp" as const,
    trade: "SHK" as const,
    description: "180 m² Wohnfläche, Baubeginn Sommer 2026. Wärmepumpe mit Pufferspeicher und PV-Anlage gewünscht.",
    potential_value_eur: 35000,
    preferred_appointment_at: null,
  },
  tasks: [{ title: "Vor-Ort-Termin vereinbaren", due_in_days: 7 }],
  uncertainties: ["Genaue Heizlast unbekannt — Berechnung beim Vor-Ort-Termin"],
};

const OCR_DEMO = {
  supplier: { name: "Frauenthal Service AG", vat_id: "ATU12345678", match_confidence: "high" as const },
  invoice: {
    number: "FR-2026-4471",
    date: "2026-04-18",
    due_date: "2026-05-02",
    currency: "EUR" as const,
    total_net: 4820.00,
    total_vat: 964.00,
    total_gross: 5784.00,
    vat_breakdown: [{ rate_pct: 20, net: 4820.00, vat: 964.00 }],
  },
  positions: [
    { article_number: "VI-VIT350-G10", description: "Vitocal 350-G 10kW Sole/Wasser-WP", quantity: 1, unit: "Stk", unit_price: 3200.00, total: 3200.00, vat_pct: 20 },
    { article_number: "VI-PUF-800", description: "Vitocell 100-E Pufferspeicher 800L", quantity: 1, unit: "Stk", unit_price: 980.00, total: 980.00, vat_pct: 20 },
    { article_number: "FT-PUMPE-25-6", description: "Hocheffizienzpumpe 25-6", quantity: 2, unit: "Stk", unit_price: 220.00, total: 440.00, vat_pct: 20 },
    { article_number: null, description: "Liefer- und Montagepauschale", quantity: 1, unit: "Pausch", unit_price: 200.00, total: 200.00, vat_pct: 20 },
  ],
  matched_project_hints: ["Projekt P-2026-001 (Steiner) — Positionen passen zur Sole/Wasser-Installation"],
  suggested_account_skr03: "3400",
  suggested_account_skr04: "5400",
};

// -----------------------------------------------------------------------------
// Router
// -----------------------------------------------------------------------------
export const flowAiRouter = router({
  status: moduleProcedure(M).query(async () => {
    return {
      apiKeyPresent: hasKey(),
      mode: hasKey() ? "live" : "demo",
      model: process.env.FLOWAI_MODEL ?? "claude-sonnet-4-6",
      whisperAvailable: !!process.env.OPENAI_API_KEY,
    };
  }),

  /** Takes a base64-encoded image (no data URL prefix), returns structured analysis. */
  photoToOffer: moduleProcedure(M)
    .input(
      z.object({
        image: z.string().min(100), // base64
        mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
        demo: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      if (!hasKey() || input.demo) {
        await new Promise((r) => setTimeout(r, 800));
        return { ...PHOTO_DEMO, _demo: true as const };
      }
      try {
        const result = await photoToOffer(input.image, input.mediaType);
        return { ...result, _demo: false as const };
      } catch (e) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: e instanceof Error ? e.message : String(e) });
      }
    }),

  mailToProject: moduleProcedure(M)
    .input(
      z.object({
        from: z.string().min(1).max(200),
        subject: z.string().min(1).max(300),
        body: z.string().min(1).max(30000),
        demo: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      if (!hasKey() || input.demo) {
        await new Promise((r) => setTimeout(r, 600));
        return { ...MAIL_DEMO, _demo: true as const };
      }
      try {
        const result = await mailToProject(input);
        return { ...result, _demo: false as const };
      } catch (e) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: e instanceof Error ? e.message : String(e) });
      }
    }),

  /** Voice-Memo → strukturiertes Projekt-JSON (über Whisper + Claude Pipeline). */
  voiceToProject: moduleProcedure(M)
    .input(z.object({ transcript: z.string().min(1).max(20000), demo: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      if (!hasKey() || input.demo) {
        await new Promise((r) => setTimeout(r, 700));
        return { ...VOICE_DEMO, _demo: true as const };
      }
      try {
        const result = await voiceToProject(input.transcript);
        return { ...result, _demo: false as const };
      } catch (e) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: e instanceof Error ? e.message : String(e) });
      }
    }),

  ocrReceipt: moduleProcedure(M)
    .input(
      z.object({
        file: z.string().min(100), // base64
        mediaType: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]).default("application/pdf"),
        demo: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      if (!hasKey() || input.demo) {
        await new Promise((r) => setTimeout(r, 1000));
        return { ...OCR_DEMO, _demo: true as const };
      }
      try {
        const result = await ocrReceipt(input.file, input.mediaType);
        return { ...result, _demo: false as const };
      } catch (e) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: e instanceof Error ? e.message : String(e) });
      }
    }),

  /**
   * After the user confirms the mail-to-project extraction, creates the contact
   * and project in one shot — replaces ~5 manual form-filling minutes.
   */
  createFromMail: moduleProcedure(M)
    .input(
      z.object({
        contact: z.object({
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          companyName: z.string().optional(),
          email: z.string().optional(),
          phone: z.string().optional(),
          street: z.string().optional(),
          zip: z.string().optional(),
          city: z.string().optional(),
        }),
        project: z.object({
          title: z.string().min(1).max(200),
          description: z.string().max(8000).optional(),
          trade: z.string().max(60).optional(),
          potentialValue: z.number().optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const contactId = idFor.contact();
      const projectId = idFor.project();
      const year = new Date().getFullYear();

      const [{ maxCust }] = await ctx.db
        .select({ maxCust: sql<string | null>`max(customer_number)` })
        .from(schema.contacts)
        .where(and(eq(schema.contacts.tenantId, ctx.tenantId), ilike(schema.contacts.customerNumber, `K-${year}-%`)));
      const nextCust = (maxCust?.match(/(\d+)$/)?.[1] ? parseInt(maxCust.match(/(\d+)$/)![1]!, 10) + 1 : 1);
      const customerNumber = `K-${year}-${String(nextCust).padStart(3, "0")}`;

      const [{ maxProj }] = await ctx.db
        .select({ maxProj: sql<string | null>`max(number)` })
        .from(schema.projects)
        .where(and(eq(schema.projects.tenantId, ctx.tenantId), ilike(schema.projects.number, `P-${year}-%`)));
      const nextProj = (maxProj?.match(/(\d+)$/)?.[1] ? parseInt(maxProj.match(/(\d+)$/)![1]!, 10) + 1 : 1);
      const projectNumber = `P-${year}-${String(nextProj).padStart(3, "0")}`;

      await ctx.db.transaction(async (tx) => {
        await tx.insert(schema.contacts).values({
          id: contactId,
          tenantId: ctx.tenantId,
          type: "customer",
          kind: input.contact.companyName ? "company" : "person",
          customerNumber,
          firstName: input.contact.firstName ?? null,
          lastName: input.contact.lastName ?? null,
          companyName: input.contact.companyName ?? null,
          email: input.contact.email ?? null,
          phone: input.contact.phone ?? null,
          paymentTermsDays: 14,
          discountPct: "0",
          skontoPct: "0",
          skontoDays: 0,
          createdByUserId: ctx.userId,
        });

        if (input.contact.street || input.contact.zip || input.contact.city) {
          await tx.insert(schema.contactAddresses).values({
            id: idFor.contactAddress(),
            tenantId: ctx.tenantId,
            contactId,
            kind: "main",
            street: input.contact.street ?? null,
            zip: input.contact.zip ?? null,
            city: input.contact.city ?? null,
            country: "AT",
          });
        }

        await tx.insert(schema.projects).values({
          id: projectId,
          tenantId: ctx.tenantId,
          number: projectNumber,
          title: input.project.title,
          status: "lead",
          contactId,
          trade: input.project.trade ?? "SHK",
          description: input.project.description ?? null,
          potentialValue: input.project.potentialValue !== undefined ? String(input.project.potentialValue) : null,
          source: "FlowAI Mail-Extraktion",
          responsibleUserId: ctx.userId,
        });

        await tx.insert(schema.logbookEntries).values({
          id: idFor.logbookEntry(),
          tenantId: ctx.tenantId,
          entityType: "project",
          entityId: projectId,
          kind: "system",
          message: `Projekt aus Mail-Extraktion (FlowAI) angelegt — Kontakt ${customerNumber}, Projekt ${projectNumber}.`,
          authorUserId: ctx.userId,
          isSystemEvent: true,
        });
      });

      return { contactId, projectId, customerNumber, projectNumber };
    }),

  /**
   * Persists an OCR'd supplier invoice as a material receipt:
   * - logs a system event on the project (or supplier contact) with position summary
   * - upserts article master rows so future quotes can reuse them
   */
  saveOcrAsReceipt: moduleProcedure(M)
    .input(
      z.object({
        supplierContactId: z.string().optional(),
        projectId: z.string().optional(),
        invoice: z.object({
          number: z.string(),
          date: z.string(),
          totalNet: z.number(),
          totalVat: z.number(),
          totalGross: z.number(),
        }),
        positions: z.array(
          z.object({
            articleNumber: z.string().nullable(),
            description: z.string(),
            quantity: z.number(),
            unit: z.string(),
            unitPrice: z.number(),
            total: z.number(),
            vatPct: z.number(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      let articlesUpserted = 0;

      for (const p of input.positions) {
        if (!p.articleNumber) continue;
        const [existing] = await ctx.db
          .select({ id: schema.articles.id })
          .from(schema.articles)
          .where(
            and(
              eq(schema.articles.tenantId, ctx.tenantId),
              eq(schema.articles.number, p.articleNumber),
              isNull(schema.articles.deletedAt),
            ),
          )
          .limit(1);
        if (existing) {
          await ctx.db
            .update(schema.articles)
            .set({ purchasePrice: String(p.unitPrice) })
            .where(eq(schema.articles.id, existing.id));
        } else {
          await ctx.db.insert(schema.articles).values({
            id: idFor.article(),
            tenantId: ctx.tenantId,
            supplierId: input.supplierContactId ?? null,
            number: p.articleNumber,
            name: p.description.slice(0, 300),
            unit: p.unit,
            purchasePrice: String(p.unitPrice),
            listPrice: String(p.unitPrice),
            salePrice: String(p.unitPrice * 1.3),
            vatPct: String(p.vatPct),
            isImported: true,
            importSource: "flowai-ocr",
          });
        }
        articlesUpserted++;
      }

      const entityType = input.projectId ? "project" : "contact";
      const entityId = input.projectId ?? input.supplierContactId;
      if (entityId) {
        const posLines = input.positions
          .map((p) => `  • ${p.quantity} ${p.unit} × ${p.description.slice(0, 60)} — €${p.total.toFixed(2)}`)
          .join("\n");
        await ctx.db.insert(schema.logbookEntries).values({
          id: idFor.logbookEntry(),
          tenantId: ctx.tenantId,
          entityType,
          entityId,
          kind: "event",
          message: `Eingangsrechnung ${input.invoice.number} gebucht (FlowAI-OCR) — €${input.invoice.totalGross.toFixed(2)} brutto`,
          payload: {
            source: "flowai-ocr",
            invoice: input.invoice,
            positionCount: input.positions.length,
            articlesUpserted,
            summary: posLines,
          },
          authorUserId: ctx.userId,
          isSystemEvent: true,
        });
      }

      return { articlesUpserted, positions: input.positions.length };
    }),
});

