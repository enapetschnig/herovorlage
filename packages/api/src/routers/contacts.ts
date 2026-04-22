import { router, protectedProcedure } from "../trpc";
import { schema } from "@heatflow/db";
import { contactCreateSchema, contactListInput, contactUpdateSchema } from "@heatflow/schemas";
import { idFor } from "@heatflow/utils/ids";
import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";

export const contactsRouter = router({
  list: protectedProcedure.input(contactListInput).query(async ({ ctx, input }) => {
    const { page, pageSize, search, type, sortBy, sortDir } = input;
    const offset = (page - 1) * pageSize;
    const c = schema.contacts;

    const filters = [eq(c.tenantId, ctx.tenantId), isNull(c.deletedAt)];
    if (type) filters.push(eq(c.type, type));
    if (search) {
      const s = `%${search}%`;
      const or_ = or(
        ilike(c.companyName, s),
        ilike(c.firstName, s),
        ilike(c.lastName, s),
        ilike(c.email, s),
        ilike(c.customerNumber, s),
      );
      if (or_) filters.push(or_);
    }

    const orderCol =
      sortBy === "name"
        ? c.companyName
        : sortBy === "customerNumber"
          ? c.customerNumber
          : c.createdAt;

    const order = sortDir === "asc" ? asc(orderCol) : desc(orderCol);

    const [items, [{ total }]] = await Promise.all([
      ctx.db.select().from(c).where(and(...filters)).orderBy(order).limit(pageSize).offset(offset),
      ctx.db.select({ total: count() }).from(c).where(and(...filters)),
    ]);

    return { items, total: Number(total ?? 0), page, pageSize };
  }),

  byId: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const [c] = await ctx.db
      .select()
      .from(schema.contacts)
      .where(
        and(
          eq(schema.contacts.id, input.id),
          eq(schema.contacts.tenantId, ctx.tenantId),
          isNull(schema.contacts.deletedAt),
        ),
      )
      .limit(1);
    if (!c) throw new TRPCError({ code: "NOT_FOUND" });

    const [addresses, persons, tagsRows, projectsRows] = await Promise.all([
      ctx.db
        .select()
        .from(schema.contactAddresses)
        .where(eq(schema.contactAddresses.contactId, c.id))
        .orderBy(schema.contactAddresses.kind),
      ctx.db
        .select()
        .from(schema.contactPersons)
        .where(eq(schema.contactPersons.contactId, c.id))
        .orderBy(desc(schema.contactPersons.isPrimary), schema.contactPersons.lastName),
      ctx.db
        .select({ id: schema.tags.id, name: schema.tags.name, color: schema.tags.color })
        .from(schema.contactTags)
        .innerJoin(schema.tags, eq(schema.tags.id, schema.contactTags.tagId))
        .where(eq(schema.contactTags.contactId, c.id)),
      ctx.db
        .select({
          id: schema.projects.id,
          number: schema.projects.number,
          title: schema.projects.title,
          status: schema.projects.status,
          potentialValue: schema.projects.potentialValue,
        })
        .from(schema.projects)
        .where(
          and(
            eq(schema.projects.contactId, c.id),
            eq(schema.projects.tenantId, ctx.tenantId),
            isNull(schema.projects.deletedAt),
          ),
        )
        .orderBy(desc(schema.projects.createdAt))
        .limit(20),
    ]);

    return { ...c, addresses, persons, tags: tagsRows, projects: projectsRows };
  }),

  create: protectedProcedure.input(contactCreateSchema).mutation(async ({ ctx, input }) => {
    const id = idFor.contact();
    return ctx.db.transaction(async (tx) => {
      // Generate next customer number if missing
      const customerNumber = await nextCustomerNumber(tx, ctx.tenantId, input.type);

      await tx.insert(schema.contacts).values({
        id,
        tenantId: ctx.tenantId,
        type: input.type,
        kind: input.kind,
        customerNumber,
        salutation: input.salutation || null,
        title: input.title || null,
        firstName: input.firstName || null,
        lastName: input.lastName || null,
        companyName: input.companyName || null,
        email: input.email || null,
        phone: input.phone || null,
        mobile: input.mobile || null,
        fax: input.fax || null,
        website: input.website || null,
        birthday: input.birthday || null,
        category: input.category || null,
        source: input.source || null,
        paymentTermsDays: input.paymentTermsDays,
        discountPct: String(input.discountPct),
        skontoPct: String(input.skontoPct),
        skontoDays: input.skontoDays,
        iban: input.iban || null,
        bic: input.bic || null,
        bankName: input.bankName || null,
        vatId: input.vatId || null,
        leitwegId: input.leitwegId || null,
        debitorAccount: input.debitorAccount || null,
        creditorAccount: input.creditorAccount || null,
        notes: input.notes || null,
        createdByUserId: ctx.userId,
      });

      for (const a of input.addresses) {
        await tx.insert(schema.contactAddresses).values({
          id: idFor.contactAddress(),
          tenantId: ctx.tenantId,
          contactId: id,
          kind: a.kind,
          street: a.street ?? null,
          zip: a.zip ?? null,
          city: a.city ?? null,
          country: a.country,
          lat: a.lat ? String(a.lat) : null,
          lng: a.lng ? String(a.lng) : null,
        });
      }

      for (const tagId of input.tagIds) {
        await tx.insert(schema.contactTags).values({ contactId: id, tagId });
      }

      await tx.insert(schema.logbookEntries).values({
        id: idFor.logbookEntry(),
        tenantId: ctx.tenantId,
        entityType: "contact",
        entityId: id,
        kind: "system",
        message: `Kontakt "${displayName(input)}" angelegt.`,
        authorUserId: ctx.userId,
        isSystemEvent: true,
      });

      return { id, customerNumber };
    });
  }),

  update: protectedProcedure.input(contactUpdateSchema).mutation(async ({ ctx, input }) => {
    const { id, ...rest } = input;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) patch[k] = v === "" ? null : v;
    }
    if (patch.discountPct !== undefined) patch.discountPct = String(patch.discountPct);
    if (patch.skontoPct !== undefined) patch.skontoPct = String(patch.skontoPct);

    await ctx.db
      .update(schema.contacts)
      .set(patch)
      .where(and(eq(schema.contacts.id, id), eq(schema.contacts.tenantId, ctx.tenantId)));

    return { id };
  }),

  remove: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.db
      .update(schema.contacts)
      .set({ deletedAt: new Date() })
      .where(and(eq(schema.contacts.id, input.id), eq(schema.contacts.tenantId, ctx.tenantId)));
    return { id: input.id };
  }),

  /**
   * Bulk-imports contacts from a CSV upload. Each row is validated independently;
   * failures report row number + message but do not abort the batch.
   */
  importBulk: protectedProcedure
    .input(
      z.object({
        rows: z.array(
          z.object({
            type: z.enum(["customer", "supplier", "partner", "other"]).default("customer"),
            kind: z.enum(["person", "company"]).default("person"),
            companyName: z.string().optional(),
            firstName: z.string().optional(),
            lastName: z.string().optional(),
            email: z.string().optional(),
            phone: z.string().optional(),
            mobile: z.string().optional(),
            street: z.string().optional(),
            zip: z.string().optional(),
            city: z.string().optional(),
            country: z.string().length(2).default("AT"),
            vatId: z.string().optional(),
            iban: z.string().optional(),
            notes: z.string().optional(),
          }),
        ).min(1).max(5000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const successes: { row: number; id: string; customerNumber: string }[] = [];
      const errors: { row: number; message: string }[] = [];

      for (let i = 0; i < input.rows.length; i++) {
        const r = input.rows[i]!;
        try {
          // Basic validation: either companyName or first+last name
          if (r.kind === "company" && !r.companyName) {
            errors.push({ row: i + 1, message: "companyName fehlt" });
            continue;
          }
          if (r.kind === "person" && !r.firstName && !r.lastName) {
            errors.push({ row: i + 1, message: "Vor- oder Nachname erforderlich" });
            continue;
          }

          const id = idFor.contact();
          const customerNumber = await nextCustomerNumber(ctx.db, ctx.tenantId, r.type);

          await ctx.db.transaction(async (tx) => {
            await tx.insert(schema.contacts).values({
              id,
              tenantId: ctx.tenantId,
              type: r.type,
              kind: r.kind,
              customerNumber,
              firstName: r.firstName || null,
              lastName: r.lastName || null,
              companyName: r.companyName || null,
              email: r.email || null,
              phone: r.phone || null,
              mobile: r.mobile || null,
              vatId: r.vatId || null,
              iban: r.iban || null,
              notes: r.notes || null,
              paymentTermsDays: 14,
              discountPct: "0",
              skontoPct: "0",
              skontoDays: 0,
              createdByUserId: ctx.userId,
            });
            if (r.street || r.zip || r.city) {
              await tx.insert(schema.contactAddresses).values({
                id: idFor.contactAddress(),
                tenantId: ctx.tenantId,
                contactId: id,
                kind: "main",
                street: r.street || null,
                zip: r.zip || null,
                city: r.city || null,
                country: r.country,
              });
            }
          });

          successes.push({ row: i + 1, id, customerNumber });
        } catch (e) {
          errors.push({ row: i + 1, message: e instanceof Error ? e.message : String(e) });
        }
      }

      return { imported: successes.length, failed: errors.length, successes, errors };
    }),

  searchQuick: protectedProcedure
    .input(z.object({ q: z.string().min(1).max(80), limit: z.number().int().min(1).max(20).default(8) }))
    .query(async ({ ctx, input }) => {
      const s = `%${input.q}%`;
      return ctx.db
        .select({
          id: schema.contacts.id,
          companyName: schema.contacts.companyName,
          firstName: schema.contacts.firstName,
          lastName: schema.contacts.lastName,
          email: schema.contacts.email,
          customerNumber: schema.contacts.customerNumber,
          type: schema.contacts.type,
          kind: schema.contacts.kind,
        })
        .from(schema.contacts)
        .where(
          and(
            eq(schema.contacts.tenantId, ctx.tenantId),
            isNull(schema.contacts.deletedAt),
            or(
              ilike(schema.contacts.companyName, s),
              ilike(schema.contacts.firstName, s),
              ilike(schema.contacts.lastName, s),
              ilike(schema.contacts.email, s),
              ilike(schema.contacts.customerNumber, s),
            ),
          ),
        )
        .orderBy(desc(schema.contacts.updatedAt))
        .limit(input.limit);
    }),
});

function displayName(c: { firstName?: string | ""; lastName?: string | ""; companyName?: string | "" }): string {
  if (c.companyName) return c.companyName;
  return [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || "(unbenannt)";
}

async function nextCustomerNumber(
  tx: Parameters<Parameters<typeof import("@heatflow/db").db.transaction>[0]>[0],
  tenantId: string,
  type: string,
): Promise<string> {
  const prefix = type === "supplier" ? "L" : "K";
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-%`;
  const [{ max }] = await tx
    .select({ max: sql<string | null>`max(customer_number)` })
    .from(schema.contacts)
    .where(
      and(
        eq(schema.contacts.tenantId, tenantId),
        ilike(schema.contacts.customerNumber, pattern),
      ),
    );
  let next = 1;
  if (max) {
    const m = max.match(/(\d+)$/);
    if (m) next = parseInt(m[1] ?? "0", 10) + 1;
  }
  return `${prefix}-${year}-${String(next).padStart(3, "0")}`;
}
