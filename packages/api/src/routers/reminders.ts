import { moduleProcedure, router, protectedProcedure } from "../trpc";
import { schema } from "@heatflow/db";
import { idFor } from "@heatflow/utils/ids";
import { FEATURES } from "@heatflow/utils/constants";
import { renderTemplate, sendEmail } from "@heatflow/integrations-email";
import { renderDocumentPdf } from "@heatflow/pdf";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { loadRenderInput } from "../services/document-render";

const M = FEATURES.M11_SEPA;

const REMINDER_LEVELS = {
  1: { name: "1. Mahnung (freundliche Erinnerung)", subject: "Erinnerung: Rechnung {{Document.number}} ist offen", fee: 0 },
  2: { name: "2. Mahnung (Mahnung)", subject: "Mahnung: Rechnung {{Document.number}} überfällig", fee: 5 },
  3: { name: "3. Mahnung (letzte Mahnung)", subject: "LETZTE MAHNUNG: Rechnung {{Document.number}}", fee: 10 },
};

export const remindersRouter = router({
  /**
   * Marks all sent invoices past dueDate as overdue. Idempotent.
   * Should run nightly via a cron — for now exposed as a manual procedure.
   */
  markOverdue: protectedProcedure.mutation(async ({ ctx }) => {
    const today = new Date().toISOString().slice(0, 10);
    const result = await ctx.db
      .update(schema.documents)
      .set({ status: "overdue" })
      .where(
        and(
          eq(schema.documents.tenantId, ctx.tenantId),
          isNull(schema.documents.deletedAt),
          eq(schema.documents.status, "sent"),
          inArray(schema.documents.type, ["invoice", "partial_invoice", "final_invoice"]),
          lt(schema.documents.dueDate, today),
        ),
      )
      .returning({ id: schema.documents.id, number: schema.documents.number });
    return { marked: result.length, numbers: result.map((r) => r.number) };
  }),

  /** Returns the list of overdue invoices with days-overdue + last-reminder-info. */
  overdueList: moduleProcedure(M).query(async ({ ctx }) => {
    const today = new Date().toISOString().slice(0, 10);
    return ctx.db
      .select({
        id: schema.documents.id,
        number: schema.documents.number,
        documentDate: schema.documents.documentDate,
        dueDate: schema.documents.dueDate,
        totalGross: schema.documents.totalGross,
        currency: schema.documents.currency,
        status: schema.documents.status,
        contactId: schema.documents.contactId,
        contactName: sql<string>`coalesce(${schema.contacts.companyName}, concat_ws(' ', ${schema.contacts.firstName}, ${schema.contacts.lastName}))`,
        contactEmail: schema.contacts.email,
        daysOverdue: sql<number>`extract(day from current_date - ${schema.documents.dueDate})::int`,
      })
      .from(schema.documents)
      .leftJoin(schema.contacts, eq(schema.contacts.id, schema.documents.contactId))
      .where(
        and(
          eq(schema.documents.tenantId, ctx.tenantId),
          isNull(schema.documents.deletedAt),
          inArray(schema.documents.type, ["invoice", "partial_invoice", "final_invoice"]),
          inArray(schema.documents.status, ["sent", "overdue"]),
          lt(schema.documents.dueDate, today),
        ),
      )
      .orderBy(asc(schema.documents.dueDate));
  }),

  /**
   * Sends a Mahnung-Mail for an overdue invoice with the original PDF re-attached.
   * Level 1/2/3 changes subject + tone + adds a fee.
   */
  sendReminder: moduleProcedure(M)
    .input(
      z.object({
        documentId: z.string(),
        level: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const data = await loadRenderInput(ctx.db, ctx.tenantId, input.documentId);
      if (!data.contact.email) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Kontakt hat keine E-Mail-Adresse." });
      }

      const lvl = REMINDER_LEVELS[input.level];
      const tplCtx = {
        Document: data.document,
        Contact: data.contact,
        Company: data.tenant,
        User: { name: ctx.session?.user?.name ?? "" },
        Reminder: { level: input.level, fee: lvl.fee.toFixed(2) },
      };

      const subject = renderTemplate(lvl.subject, tplCtx);
      const body = buildReminderBody(input.level, tplCtx);

      const pdf = await renderDocumentPdf(data);

      const result = await sendEmail({
        to: data.contact.email,
        subject,
        text: body,
        replyTo: data.tenant.email ?? undefined,
        attachments: [{ filename: `${data.document.number}.pdf`, content: pdf, contentType: "application/pdf" }],
      });

      // Outbox entry
      await ctx.db.insert(schema.emailOutbox).values({
        id: idFor.emailOutbox(),
        tenantId: ctx.tenantId,
        toAddress: data.contact.email,
        fromAddress: data.tenant.email ?? "noreply@heatflow.local",
        subject,
        body,
        status: "sent",
        sentAt: new Date(),
        attempts: 1,
        messageId: result.messageId,
      });

      // Logbook
      await ctx.db.insert(schema.logbookEntries).values({
        id: idFor.logbookEntry(),
        tenantId: ctx.tenantId,
        entityType: "contact",
        entityId: data.contact ? (await ctx.db.select({ id: schema.documents.contactId }).from(schema.documents).where(eq(schema.documents.id, input.documentId)).limit(1))[0]?.id ?? "" : "",
        kind: "email",
        message: `${lvl.name} für ${data.document.number} an ${data.contact.email} versendet.`,
        authorUserId: ctx.userId,
        isSystemEvent: true,
      });

      return { messageId: result.messageId, level: input.level };
    }),

  /** Marks an invoice as paid manually. */
  markPaid: protectedProcedure
    .input(z.object({ documentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(schema.documents)
        .set({ status: "paid" })
        .where(and(eq(schema.documents.id, input.documentId), eq(schema.documents.tenantId, ctx.tenantId)));

      const [doc] = await ctx.db
        .select({ number: schema.documents.number, contactId: schema.documents.contactId })
        .from(schema.documents)
        .where(eq(schema.documents.id, input.documentId))
        .limit(1);

      if (doc) {
        await ctx.db.insert(schema.logbookEntries).values({
          id: idFor.logbookEntry(),
          tenantId: ctx.tenantId,
          entityType: "contact",
          entityId: doc.contactId,
          kind: "event",
          message: `Zahlung für ${doc.number} eingegangen — als bezahlt markiert.`,
          authorUserId: ctx.userId,
          isSystemEvent: true,
        });
      }
      return { id: input.documentId };
    }),
});

function buildReminderBody(level: 1 | 2 | 3, ctx: Record<string, unknown>): string {
  const greeting = "Sehr geehrte/r {{Contact.salutation}} {{Contact.lastName}},";
  const closing = "\n\nMit freundlichen Grüßen\n{{User.name}}\n{{Company.name}}";
  let body: string;
  if (level === 1) {
    body = `${greeting}\n\nbei der Durchsicht unserer offenen Posten haben wir festgestellt, dass die Rechnung {{Document.number}} vom {{Document.documentDate}} noch nicht beglichen ist.\n\nVielleicht ist Ihnen die Zahlung entgangen — wir bitten Sie freundlich um Begleichung innerhalb der nächsten 7 Tage.${closing}`;
  } else if (level === 2) {
    body = `${greeting}\n\ntrotz unserer Erinnerung ist die Rechnung {{Document.number}} weiterhin offen. Bitte überweisen Sie den fälligen Betrag inkl. Mahngebühr von {{Reminder.fee}} EUR innerhalb von 7 Tagen.\n\nFalls Sie bereits gezahlt haben, betrachten Sie dieses Schreiben bitte als gegenstandslos.${closing}`;
  } else {
    body = `${greeting}\n\ndies ist unsere LETZTE MAHNUNG für die Rechnung {{Document.number}}. Wir setzen Ihnen eine letzte Frist von 7 Tagen zur Begleichung des fälligen Betrags inkl. Mahngebühr von {{Reminder.fee}} EUR.\n\nNach Ablauf dieser Frist sehen wir uns gezwungen, weitere rechtliche Schritte einzuleiten.${closing}`;
  }
  return renderTemplate(body, ctx);
}
