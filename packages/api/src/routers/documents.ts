import { router, protectedProcedure } from "../trpc";
import { schema } from "@heatflow/db";
import {
  documentCreateSchema,
  documentListInput,
  documentUpdateSchema,
  type DocumentPositionInput,
} from "@heatflow/schemas";
import { idFor } from "@heatflow/utils/ids";
import { lineNet, round2 } from "@heatflow/utils/money";
import { renderDocumentPdf } from "@heatflow/pdf";
import { renderXRechnungXml } from "@heatflow/integrations-zugferd";
import { renderTemplate, sendEmail } from "@heatflow/integrations-email";
import { invoiceToBookings, renderDatevCsv } from "@heatflow/integrations-datev";
import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { loadRenderInput, loadDatevBookings } from "../services/document-render";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedAdmin: SupabaseClient | null = null;
function admin(): SupabaseClient {
  if (cachedAdmin) return cachedAdmin;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required");
  cachedAdmin = createClient(url, key, { auth: { persistSession: false } });
  return cachedAdmin;
}

const DOC_PREFIX: Record<string, string> = {
  quote: "AN",
  order_confirmation: "AB",
  delivery_note: "LS",
  invoice: "RE",
  partial_invoice: "TR",
  final_invoice: "SR",
  credit_note: "GU",
};

export const documentsRouter = router({
  list: protectedProcedure.input(documentListInput).query(async ({ ctx, input }) => {
    const { page, pageSize, search, status, type, contactId, projectId } = input;
    const d = schema.documents;
    const filters = [eq(d.tenantId, ctx.tenantId), isNull(d.deletedAt)];
    if (status) filters.push(eq(d.status, status));
    if (type) filters.push(eq(d.type, type));
    if (contactId) filters.push(eq(d.contactId, contactId));
    if (projectId) filters.push(eq(d.projectId, projectId));
    if (search) {
      const s = `%${search}%`;
      const or_ = or(ilike(d.number, s), ilike(d.title, s));
      if (or_) filters.push(or_);
    }
    const offset = (page - 1) * pageSize;

    const [items, [{ total }]] = await Promise.all([
      ctx.db
        .select({
          id: d.id, number: d.number, type: d.type, title: d.title, status: d.status,
          documentDate: d.documentDate, dueDate: d.dueDate,
          totalNet: d.totalNet, totalGross: d.totalGross, currency: d.currency,
          locked: d.locked,
          contactId: d.contactId,
          contactName: sql<string>`coalesce(${schema.contacts.companyName}, concat_ws(' ', ${schema.contacts.firstName}, ${schema.contacts.lastName}))`,
          projectId: d.projectId,
          projectTitle: schema.projects.title,
        })
        .from(d)
        .leftJoin(schema.contacts, eq(schema.contacts.id, d.contactId))
        .leftJoin(schema.projects, eq(schema.projects.id, d.projectId))
        .where(and(...filters))
        .orderBy(desc(d.documentDate), desc(d.createdAt))
        .limit(pageSize)
        .offset(offset),
      ctx.db.select({ total: count() }).from(d).where(and(...filters)),
    ]);

    return { items, total: Number(total ?? 0), page, pageSize };
  }),

  byId: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const [doc] = await ctx.db
      .select()
      .from(schema.documents)
      .where(
        and(
          eq(schema.documents.id, input.id),
          eq(schema.documents.tenantId, ctx.tenantId),
          isNull(schema.documents.deletedAt),
        ),
      )
      .limit(1);
    if (!doc) throw new TRPCError({ code: "NOT_FOUND" });

    const [contact] = await ctx.db
      .select()
      .from(schema.contacts)
      .where(eq(schema.contacts.id, doc.contactId))
      .limit(1);

    const positions = await ctx.db
      .select()
      .from(schema.documentPositions)
      .where(eq(schema.documentPositions.documentId, doc.id))
      .orderBy(asc(schema.documentPositions.orderNum));

    return { ...doc, contact: contact ?? null, positions };
  }),

  create: protectedProcedure.input(documentCreateSchema).mutation(async ({ ctx, input }) => {
    const id = idFor.document();
    const number = await nextDocumentNumber(ctx.db, ctx.tenantId, input.type);

    // Compute totals from positions
    const totals = computeTotals(input.positions);

    return ctx.db.transaction(async (tx) => {
      await tx.insert(schema.documents).values({
        id,
        tenantId: ctx.tenantId,
        type: input.type,
        number,
        title: input.title ?? null,
        contactId: input.contactId,
        addressId: input.addressId ?? null,
        projectId: input.projectId ?? null,
        documentDate: input.documentDate,
        dueDate: input.dueDate ?? null,
        status: input.status,
        currency: input.currency,
        introText: input.introText ?? null,
        closingText: input.closingText ?? null,
        totalNet: String(totals.net),
        totalVat: String(totals.vat),
        totalGross: String(totals.gross),
        createdByUserId: ctx.userId,
      });

      let order = 0;
      for (const p of input.positions) {
        order += 1;
        const lineN = p.kind === "article" || p.kind === "service"
          ? lineNet(p.quantity, p.unitPrice, p.discountPct)
          : 0;
        await tx.insert(schema.documentPositions).values({
          id: idFor.documentPosition(),
          tenantId: ctx.tenantId,
          documentId: id,
          parentPositionId: p.parentPositionId ?? null,
          orderNum: order,
          kind: p.kind,
          articleId: p.articleId ?? null,
          serviceId: p.serviceId ?? null,
          positionNumber: p.positionNumber ?? null,
          description: p.description,
          quantity: String(p.quantity),
          unit: p.unit,
          unitPrice: String(p.unitPrice),
          discountPct: String(p.discountPct),
          vatPct: String(p.vatPct),
          totalNet: String(lineN),
        });
      }

      // Logbook
      await tx.insert(schema.logbookEntries).values({
        id: idFor.logbookEntry(),
        tenantId: ctx.tenantId,
        entityType: input.projectId ? "project" : "contact",
        entityId: input.projectId ?? input.contactId,
        kind: "system",
        message: `${humanType(input.type)} ${number} angelegt (€${totals.gross.toFixed(2)}).`,
        authorUserId: ctx.userId,
        isSystemEvent: true,
      });

      return { id, number };
    });
  }),

  update: protectedProcedure.input(documentUpdateSchema).mutation(async ({ ctx, input }) => {
    const { id, positions, ...rest } = input;

    // Locked check
    const [existing] = await ctx.db
      .select({ locked: schema.documents.locked })
      .from(schema.documents)
      .where(and(eq(schema.documents.id, id), eq(schema.documents.tenantId, ctx.tenantId)))
      .limit(1);
    if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
    if (existing.locked) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Dokument ist abgeschlossen — bitte Kopie erstellen." });
    }

    return ctx.db.transaction(async (tx) => {
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rest)) if (v !== undefined) patch[k] = v;

      if (positions) {
        const totals = computeTotals(positions);
        patch.totalNet = String(totals.net);
        patch.totalVat = String(totals.vat);
        patch.totalGross = String(totals.gross);

        await tx.delete(schema.documentPositions).where(eq(schema.documentPositions.documentId, id));
        let order = 0;
        for (const p of positions) {
          order += 1;
          const lineN = p.kind === "article" || p.kind === "service"
            ? lineNet(p.quantity, p.unitPrice, p.discountPct)
            : 0;
          await tx.insert(schema.documentPositions).values({
            id: idFor.documentPosition(),
            tenantId: ctx.tenantId,
            documentId: id,
            parentPositionId: p.parentPositionId ?? null,
            orderNum: order,
            kind: p.kind,
            articleId: p.articleId ?? null,
            serviceId: p.serviceId ?? null,
            positionNumber: p.positionNumber ?? null,
            description: p.description,
            quantity: String(p.quantity),
            unit: p.unit,
            unitPrice: String(p.unitPrice),
            discountPct: String(p.discountPct),
            vatPct: String(p.vatPct),
            totalNet: String(lineN),
          });
        }
      }

      if (Object.keys(patch).length > 0) {
        await tx
          .update(schema.documents)
          .set(patch)
          .where(and(eq(schema.documents.id, id), eq(schema.documents.tenantId, ctx.tenantId)));
      }
      return { id };
    });
  }),

  finalize: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const [doc] = await ctx.db
      .select({
        id: schema.documents.id, locked: schema.documents.locked, type: schema.documents.type,
        number: schema.documents.number, projectId: schema.documents.projectId, contactId: schema.documents.contactId,
      })
      .from(schema.documents)
      .where(and(eq(schema.documents.id, input.id), eq(schema.documents.tenantId, ctx.tenantId)))
      .limit(1);
    if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
    if (doc.locked) throw new TRPCError({ code: "BAD_REQUEST", message: "Bereits abgeschlossen." });

    await ctx.db
      .update(schema.documents)
      .set({ locked: true, lockedAt: new Date(), lockedByUserId: ctx.userId })
      .where(eq(schema.documents.id, input.id));

    await ctx.db.insert(schema.logbookEntries).values({
      id: idFor.logbookEntry(),
      tenantId: ctx.tenantId,
      entityType: doc.projectId ? "project" : "contact",
      entityId: doc.projectId ?? doc.contactId,
      kind: "system",
      message: `${humanType(doc.type)} ${doc.number} abgeschlossen (unveränderbar).`,
      authorUserId: ctx.userId,
      isSystemEvent: true,
    });

    return { id: input.id };
  }),

  /** Clone a document (for "convertToInvoice", "duplicate as new quote", etc.) */
  clone: protectedProcedure
    .input(z.object({ id: z.string(), newType: z.enum(["quote","order_confirmation","delivery_note","invoice","partial_invoice","final_invoice","credit_note"]).optional() }))
    .mutation(async ({ ctx, input }) => {
      const [orig] = await ctx.db
        .select()
        .from(schema.documents)
        .where(and(eq(schema.documents.id, input.id), eq(schema.documents.tenantId, ctx.tenantId)))
        .limit(1);
      if (!orig) throw new TRPCError({ code: "NOT_FOUND" });

      const positions = await ctx.db
        .select()
        .from(schema.documentPositions)
        .where(eq(schema.documentPositions.documentId, orig.id))
        .orderBy(asc(schema.documentPositions.orderNum));

      const newType = input.newType ?? orig.type;
      const newId = idFor.document();
      const newNumber = await nextDocumentNumber(ctx.db, ctx.tenantId, newType);

      await ctx.db.transaction(async (tx) => {
        await tx.insert(schema.documents).values({
          ...orig,
          id: newId,
          number: newNumber,
          type: newType,
          status: "draft",
          locked: false,
          lockedAt: null,
          lockedByUserId: null,
          referenceDocumentId: orig.id,
          documentDate: new Date().toISOString().slice(0, 10),
          dueDate: null,
          sentAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          createdByUserId: ctx.userId,
        });
        for (const p of positions) {
          await tx.insert(schema.documentPositions).values({
            ...p,
            id: idFor.documentPosition(),
            documentId: newId,
          });
        }
      });

      return { id: newId, number: newNumber };
    }),

  remove: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.db
      .update(schema.documents)
      .set({ deletedAt: new Date() })
      .where(and(eq(schema.documents.id, input.id), eq(schema.documents.tenantId, ctx.tenantId)));
    return { id: input.id };
  }),

  /**
   * Generates a fresh PDF, uploads it to the `documents` Storage bucket, persists
   * the storage key on the document row, and returns a 1h signed download URL.
   */
  generatePdf: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const data = await loadRenderInput(ctx.db, ctx.tenantId, input.id);
      const buffer = await renderDocumentPdf(data);

      const key = `${ctx.tenantId}/document/${input.id}/${data.document.number}.pdf`;
      const { error: upErr } = await admin().storage
        .from("documents")
        .upload(key, buffer, { contentType: "application/pdf", upsert: true });
      if (upErr) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: upErr.message });

      await ctx.db
        .update(schema.documents)
        .set({ pdfStorageKey: key })
        .where(and(eq(schema.documents.id, input.id), eq(schema.documents.tenantId, ctx.tenantId)));

      const { data: signed, error: signErr } = await admin().storage
        .from("documents")
        .createSignedUrl(key, 3600);
      if (signErr) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: signErr.message });

      return { storageKey: key, signedUrl: signed.signedUrl, sizeBytes: buffer.byteLength };
    }),

  /**
   * Sends the document by email with a freshly-generated PDF (and optionally
   * the XRechnung XML) attached.
   */
  sendByEmail: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        to: z.string().email(),
        cc: z.array(z.string().email()).default([]),
        subject: z.string().min(1).max(300),
        body: z.string().min(1).max(8000),
        attachXml: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const data = await loadRenderInput(ctx.db, ctx.tenantId, input.id);
      const pdf = await renderDocumentPdf(data);

      const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [
        { filename: `${data.document.number}.pdf`, content: pdf, contentType: "application/pdf" },
      ];
      if (input.attachXml) {
        const xml = renderXRechnungXml(data);
        attachments.push({
          filename: `${data.document.number}-xrechnung.xml`,
          content: Buffer.from(xml, "utf8"),
          contentType: "application/xml",
        });
      }

      // Render placeholders {{Document.number}}, {{Contact.lastName}}, ...
      const tplCtx = {
        Document: data.document,
        Contact: data.contact,
        Company: data.tenant,
        User: { name: ctx.session?.user?.name ?? "" },
      };
      const subject = renderTemplate(input.subject, tplCtx);
      const body = renderTemplate(input.body, tplCtx);
      const replyTo = data.tenant.email ?? undefined;

      const result = await sendEmail({
        to: input.to,
        cc: input.cc.length > 0 ? input.cc : undefined,
        subject,
        text: body,
        replyTo,
        attachments,
      });

      // Outbox entry
      await ctx.db.insert(schema.emailOutbox).values({
        id: idFor.file(),
        tenantId: ctx.tenantId,
        toAddress: input.to,
        fromAddress: replyTo ?? "noreply@heatflow.local",
        subject,
        body,
        status: "sent",
        sentAt: new Date(),
        attempts: 1,
        messageId: result.messageId,
      });

      // Mark document as sent + logbook
      await ctx.db
        .update(schema.documents)
        .set({ status: "sent", sentAt: new Date() })
        .where(and(eq(schema.documents.id, input.id), eq(schema.documents.tenantId, ctx.tenantId)));

      const [doc] = await ctx.db
        .select({ projectId: schema.documents.projectId, contactId: schema.documents.contactId, type: schema.documents.type, number: schema.documents.number })
        .from(schema.documents)
        .where(eq(schema.documents.id, input.id))
        .limit(1);
      if (doc) {
        await ctx.db.insert(schema.logbookEntries).values({
          id: idFor.logbookEntry(),
          tenantId: ctx.tenantId,
          entityType: doc.projectId ? "project" : "contact",
          entityId: doc.projectId ?? doc.contactId,
          kind: "email",
          message: `${humanType(doc.type)} ${doc.number} an ${input.to} versendet.`,
          authorUserId: ctx.userId,
          isSystemEvent: true,
        });
      }

      return { messageId: result.messageId, accepted: result.accepted };
    }),

  /** Preview: counts finalized invoices + total gross for a DATEV-export date range. */
  datevPreview: protectedProcedure
    .input(
      z.object({
        fromDate: z.string().date(),
        toDate: z.string().date(),
        sr: z.enum(["SKR03", "SKR04"]).default("SKR03"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { bookings, count, totalGross } = await loadDatevBookings(ctx.db, ctx.tenantId, input);
      return { documents: count, bookings: bookings.length, totalGross };
    }),
});

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------
function computeTotals(positions: DocumentPositionInput[]): { net: number; vat: number; gross: number } {
  let net = 0;
  let vat = 0;
  for (const p of positions) {
    if (p.kind !== "article" && p.kind !== "service") continue;
    const ln = lineNet(p.quantity, p.unitPrice, p.discountPct);
    net += ln;
    vat += round2(ln * (p.vatPct / 100));
  }
  return { net: round2(net), vat: round2(vat), gross: round2(net + vat) };
}

async function nextDocumentNumber(
  db: typeof import("@heatflow/db").db,
  tenantId: string,
  type: string,
): Promise<string> {
  const prefix = DOC_PREFIX[type] ?? "DOC";
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-%`;
  const [{ max }] = await db
    .select({ max: sql<string | null>`max(number)` })
    .from(schema.documents)
    .where(and(eq(schema.documents.tenantId, tenantId), ilike(schema.documents.number, pattern)));
  let next = 1;
  if (max) {
    const m = max.match(/(\d+)$/);
    if (m) next = parseInt(m[1] ?? "0", 10) + 1;
  }
  return `${prefix}-${year}-${String(next).padStart(3, "0")}`;
}

function humanType(t: string): string {
  return ({
    quote: "Angebot",
    order_confirmation: "Auftragsbestätigung",
    delivery_note: "Lieferschein",
    invoice: "Rechnung",
    partial_invoice: "Teilrechnung",
    final_invoice: "Schlussrechnung",
    credit_note: "Gutschrift",
  })[t] ?? t;
}
