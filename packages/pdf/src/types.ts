/**
 * Plain-data shapes that the PDF renderer takes as input. Independent of the
 * Drizzle schema so we can build a `Document` PDF from anywhere (mock data,
 * API call, queue worker).
 */

export type Currency = "EUR" | "CHF";

export type DocumentTypeKey =
  | "quote"
  | "order_confirmation"
  | "delivery_note"
  | "invoice"
  | "partial_invoice"
  | "final_invoice"
  | "credit_note";

export type PdfPosition = {
  kind: "article" | "service" | "text" | "subtotal" | "title";
  positionNumber?: string | null;
  description: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  vatPct?: number;
  totalNet?: number;
};

export type PdfTenant = {
  name: string;
  legalName?: string | null;
  addressStreet?: string | null;
  addressZip?: string | null;
  addressCity?: string | null;
  addressCountry?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  vatId?: string | null;
  iban?: string | null;
  bic?: string | null;
  bankName?: string | null;
  primaryColor?: string | null;
  logoUrl?: string | null;
};

export type PdfContact = {
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  salutation?: string | null;
  email?: string | null;
  street?: string | null;
  zip?: string | null;
  city?: string | null;
  country?: string | null;
  customerNumber?: string | null;
  vatId?: string | null;
};

export type PdfDocument = {
  type: DocumentTypeKey;
  number: string;
  title?: string | null;
  documentDate: string; // YYYY-MM-DD
  dueDate?: string | null;
  currency: Currency;
  introText?: string | null;
  closingText?: string | null;
  totalNet: number;
  totalVat: number;
  totalGross: number;
  positions: PdfPosition[];
};
