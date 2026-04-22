import { schema, type Db } from "@heatflow/db";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import type { PdfContact, PdfDocument, PdfTenant } from "@heatflow/pdf";
import { invoiceToBookings, type DatevBooking, type HeatflowDocumentForDatev } from "@heatflow/integrations-datev";

/** Loads a document + contact + tenant in the shape the PDF/XML renderers expect. */
export async function loadRenderInput(db: Db, tenantId: string, documentId: string): Promise<{
  document: PdfDocument;
  contact: PdfContact;
  tenant: PdfTenant;
}> {
  const [tenant] = await db
    .select()
    .from(schema.tenants)
    .where(and(eq(schema.tenants.id, tenantId), isNull(schema.tenants.deletedAt)))
    .limit(1);
  if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });

  const [doc] = await db
    .select()
    .from(schema.documents)
    .where(
      and(
        eq(schema.documents.id, documentId),
        eq(schema.documents.tenantId, tenantId),
        isNull(schema.documents.deletedAt),
      ),
    )
    .limit(1);
  if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });

  const [contact] = await db
    .select()
    .from(schema.contacts)
    .where(eq(schema.contacts.id, doc.contactId))
    .limit(1);
  if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });

  // Resolve address: prefer doc.addressId, else first contact address.
  let address: { street: string | null; zip: string | null; city: string | null; country: string | null } | null = null;
  if (doc.addressId) {
    const [a] = await db.select().from(schema.contactAddresses).where(eq(schema.contactAddresses.id, doc.addressId)).limit(1);
    if (a) address = { street: a.street, zip: a.zip, city: a.city, country: a.country };
  }
  if (!address) {
    const [a] = await db
      .select()
      .from(schema.contactAddresses)
      .where(eq(schema.contactAddresses.contactId, contact.id))
      .limit(1);
    if (a) address = { street: a.street, zip: a.zip, city: a.city, country: a.country };
  }

  const positions = await db
    .select()
    .from(schema.documentPositions)
    .where(eq(schema.documentPositions.documentId, doc.id))
    .orderBy(asc(schema.documentPositions.orderNum));

  return {
    document: {
      type: doc.type as PdfDocument["type"],
      number: doc.number,
      title: doc.title,
      documentDate: typeof doc.documentDate === "string" ? doc.documentDate : (doc.documentDate as unknown as Date).toISOString().slice(0, 10),
      dueDate: doc.dueDate ? (typeof doc.dueDate === "string" ? doc.dueDate : (doc.dueDate as unknown as Date).toISOString().slice(0, 10)) : null,
      currency: doc.currency as "EUR" | "CHF",
      introText: doc.introText,
      closingText: doc.closingText,
      totalNet: Number(doc.totalNet),
      totalVat: Number(doc.totalVat),
      totalGross: Number(doc.totalGross),
      positions: positions.map((p) => ({
        kind: p.kind as PdfDocument["positions"][number]["kind"],
        positionNumber: p.positionNumber,
        description: p.description,
        quantity: Number(p.quantity),
        unit: p.unit,
        unitPrice: Number(p.unitPrice),
        vatPct: Number(p.vatPct),
        totalNet: Number(p.totalNet),
      })),
    },
    contact: {
      companyName: contact.companyName,
      firstName: contact.firstName,
      lastName: contact.lastName,
      salutation: contact.salutation,
      email: contact.email,
      street: address?.street ?? null,
      zip: address?.zip ?? null,
      city: address?.city ?? null,
      country: address?.country ?? null,
      customerNumber: contact.customerNumber,
      vatId: contact.vatId,
    },
    tenant: {
      name: tenant.name,
      legalName: tenant.legalName,
      addressStreet: tenant.addressStreet,
      addressZip: tenant.addressZip,
      addressCity: tenant.addressCity,
      addressCountry: tenant.addressCountry,
      email: tenant.email,
      phone: tenant.phone,
      website: tenant.website,
      vatId: tenant.vatId,
      iban: tenant.iban,
      bic: tenant.bic,
      bankName: tenant.bankName,
      primaryColor: tenant.primaryColor,
      logoUrl: tenant.logoUrl,
    },
  };
}

/**
 * Loads all finalized invoices in a date range as DATEV bookings.
 * Only `invoice`, `partial_invoice`, `final_invoice`, `credit_note` types are exported.
 * Only `locked` documents are included (GoBD-compliant).
 */
export async function loadDatevBookings(
  db: Db,
  tenantId: string,
  opts: { fromDate: string; toDate: string; sr: "SKR03" | "SKR04" },
): Promise<{ bookings: DatevBooking[]; count: number; totalGross: number }> {
  const invoiceTypes = ["invoice", "partial_invoice", "final_invoice", "credit_note"];

  const docs = await db
    .select({
      id: schema.documents.id,
      number: schema.documents.number,
      documentDate: schema.documents.documentDate,
      dueDate: schema.documents.dueDate,
      type: schema.documents.type,
      totalNet: schema.documents.totalNet,
      totalVat: schema.documents.totalVat,
      totalGross: schema.documents.totalGross,
      debitorAccount: schema.contacts.debitorAccount,
      companyName: schema.contacts.companyName,
      firstName: schema.contacts.firstName,
      lastName: schema.contacts.lastName,
    })
    .from(schema.documents)
    .leftJoin(schema.contacts, eq(schema.contacts.id, schema.documents.contactId))
    .where(
      and(
        eq(schema.documents.tenantId, tenantId),
        isNull(schema.documents.deletedAt),
        inArray(schema.documents.type, invoiceTypes),
        eq(schema.documents.locked, true),
        gte(schema.documents.documentDate, opts.fromDate),
        lte(schema.documents.documentDate, opts.toDate),
      ),
    )
    .orderBy(asc(schema.documents.documentDate));

  const positionsByDoc = docs.length > 0
    ? await db
        .select({
          documentId: schema.documentPositions.documentId,
          kind: schema.documentPositions.kind,
          vatPct: schema.documentPositions.vatPct,
          totalNet: schema.documentPositions.totalNet,
          description: schema.documentPositions.description,
        })
        .from(schema.documentPositions)
        .where(inArray(schema.documentPositions.documentId, docs.map((d) => d.id)))
    : [];

  const positionMap = new Map<string, typeof positionsByDoc>();
  for (const p of positionsByDoc) {
    const list = positionMap.get(p.documentId) ?? [];
    list.push(p);
    positionMap.set(p.documentId, list);
  }

  const bookings: DatevBooking[] = [];
  let totalGross = 0;
  for (const d of docs) {
    const positions = (positionMap.get(d.id) ?? [])
      .filter((p) => p.kind === "article" || p.kind === "service")
      .map((p) => ({ vatPct: Number(p.vatPct), totalNet: Number(p.totalNet), description: p.description }));
    const docForDatev: HeatflowDocumentForDatev = {
      number: d.number,
      documentDate: d.documentDate as unknown as string,
      dueDate: (d.dueDate as unknown as string | null) ?? null,
      type: d.type,
      totalNet: Number(d.totalNet),
      totalVat: Number(d.totalVat),
      totalGross: Number(d.totalGross),
      contact: {
        debitorAccount: d.debitorAccount ?? null,
        companyName: d.companyName ?? null,
        firstName: d.firstName ?? null,
        lastName: d.lastName ?? null,
      },
      positions,
    };
    bookings.push(...invoiceToBookings(docForDatev, { sr: opts.sr }));
    totalGross += Number(d.totalGross);
  }

  return { bookings, count: docs.length, totalGross };
}
