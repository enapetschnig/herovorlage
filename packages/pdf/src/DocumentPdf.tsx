import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { formatMoney, formatDate } from "@heatflow/utils";
import type { PdfContact, PdfDocument, PdfTenant } from "./types";

const TYPE_LABEL: Record<string, string> = {
  quote: "Angebot",
  order_confirmation: "Auftragsbestätigung",
  delivery_note: "Lieferschein",
  invoice: "Rechnung",
  partial_invoice: "Teilrechnung",
  final_invoice: "Schlussrechnung",
  credit_note: "Gutschrift",
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 28 },
  senderLine: { fontSize: 7, color: "#6b7280", marginBottom: 6, borderBottom: "1pt solid #e5e7eb", paddingBottom: 2 },
  recipientCol: { flex: 1, paddingRight: 12 },
  metaCol: { width: 200 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  metaLabel: { color: "#6b7280" },
  h1: { fontSize: 18, fontWeight: "bold", marginBottom: 14 },
  intro: { marginBottom: 14, lineHeight: 1.4 },

  table: { marginTop: 8 },
  thead: { flexDirection: "row", borderBottom: "1.5pt solid #1a1a1a", paddingBottom: 4, marginBottom: 4, fontWeight: "bold", fontSize: 8, color: "#6b7280", textTransform: "uppercase" },
  tr: { flexDirection: "row", borderBottom: "0.5pt solid #e5e7eb", paddingVertical: 6 },
  trText: { backgroundColor: "#f9fafb" },
  trTitle: { paddingTop: 14, paddingBottom: 6 },
  trSubtotal: { backgroundColor: "#f3f4f6", paddingVertical: 6, fontWeight: "bold", borderTop: "0.5pt solid #d1d5db" },

  cPos: { width: 40 },
  cDesc: { flex: 1, paddingRight: 8 },
  cQty: { width: 40, textAlign: "right" },
  cUnit: { width: 32 },
  cPrice: { width: 60, textAlign: "right" },
  cTotal: { width: 70, textAlign: "right" },

  totals: { marginTop: 18, marginLeft: "auto", width: 220 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  totalRowGrand: { flexDirection: "row", justifyContent: "space-between", borderTop: "1.5pt solid #1a1a1a", paddingTop: 4, marginTop: 4, fontWeight: "bold", fontSize: 11 },

  closing: { marginTop: 22, lineHeight: 1.4 },

  footer: {
    position: "absolute", bottom: 28, left: 40, right: 40,
    paddingTop: 6, borderTop: "0.5pt solid #e5e7eb", fontSize: 7, color: "#6b7280",
    flexDirection: "row", justifyContent: "space-between",
  },
  footerCol: { flex: 1, marginRight: 8 },

  pageNum: { position: "absolute", bottom: 16, left: 0, right: 40, textAlign: "right", fontSize: 7, color: "#9ca3af" },

  bold: { fontWeight: "bold" },
  muted: { color: "#6b7280" },
});

type Props = {
  document: PdfDocument;
  tenant: PdfTenant;
  contact: PdfContact;
};

export function DocumentPdf({ document, tenant, contact }: Props) {
  const recipientName =
    contact.companyName ?? `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() || "—";
  const senderLine = [tenant.name, tenant.addressStreet, `${tenant.addressZip ?? ""} ${tenant.addressCity ?? ""}`.trim()]
    .filter(Boolean).join(" · ");

  // VAT breakdown
  const vatBuckets = new Map<number, { net: number; vat: number }>();
  for (const p of document.positions) {
    if (p.kind !== "article" && p.kind !== "service") continue;
    const rate = p.vatPct ?? 0;
    const net = p.totalNet ?? 0;
    const cur = vatBuckets.get(rate) ?? { net: 0, vat: 0 };
    cur.net += net;
    cur.vat += net * (rate / 100);
    vatBuckets.set(rate, cur);
  }

  const fmt = (n: number) => formatMoney(n, { currency: document.currency, locale: "de-AT" });

  return (
    <Document
      title={`${TYPE_LABEL[document.type]} ${document.number}`}
      author={tenant.name}
      subject={document.title ?? document.number}
      creator="HeatFlow"
      producer="HeatFlow"
    >
      <Page size="A4" style={styles.page}>
        {/* Header — sender mini line + recipient + meta */}
        <View style={styles.header}>
          <View style={styles.recipientCol}>
            <Text style={styles.senderLine}>{senderLine}</Text>
            <Text>{recipientName}</Text>
            {contact.street && <Text>{contact.street}</Text>}
            {(contact.zip || contact.city) && <Text>{contact.zip} {contact.city}</Text>}
            {contact.country && contact.country !== "AT" && <Text>{contact.country}</Text>}
          </View>
          <View style={styles.metaCol}>
            <View style={styles.metaRow}><Text style={styles.metaLabel}>Datum:</Text><Text>{formatDate(document.documentDate)}</Text></View>
            <View style={styles.metaRow}><Text style={styles.metaLabel}>Nummer:</Text><Text>{document.number}</Text></View>
            {contact.customerNumber && (
              <View style={styles.metaRow}><Text style={styles.metaLabel}>Kdnr.:</Text><Text>{contact.customerNumber}</Text></View>
            )}
            {document.dueDate && (
              <View style={styles.metaRow}><Text style={styles.metaLabel}>Fällig:</Text><Text>{formatDate(document.dueDate)}</Text></View>
            )}
          </View>
        </View>

        <Text style={styles.h1}>{TYPE_LABEL[document.type]}{document.title ? ` — ${document.title}` : ""}</Text>

        {document.introText && <Text style={styles.intro}>{document.introText}</Text>}

        {/* Positions table */}
        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={styles.cPos}>Pos.</Text>
            <Text style={styles.cDesc}>Bezeichnung</Text>
            <Text style={styles.cQty}>Menge</Text>
            <Text style={styles.cUnit}>Einh.</Text>
            <Text style={styles.cPrice}>EP</Text>
            <Text style={styles.cTotal}>Gesamt</Text>
          </View>
          {document.positions.map((p, i) => {
            if (p.kind === "title") {
              return (
                <View key={i} style={[styles.tr, styles.trTitle]}>
                  <Text style={[styles.bold, { fontSize: 10 }]}>{p.description}</Text>
                </View>
              );
            }
            if (p.kind === "text") {
              return (
                <View key={i} style={[styles.tr, styles.trText]}>
                  <Text style={[styles.muted, { fontStyle: "italic" }]}>{p.description}</Text>
                </View>
              );
            }
            if (p.kind === "subtotal") {
              return (
                <View key={i} style={[styles.tr, styles.trSubtotal]}>
                  <Text style={[{ flex: 1 }, styles.bold]}>Zwischensumme</Text>
                  <Text style={[styles.cTotal, styles.bold]}>{fmt(p.totalNet ?? 0)}</Text>
                </View>
              );
            }
            return (
              <View key={i} style={styles.tr} wrap={false}>
                <Text style={[styles.cPos, styles.muted]}>{p.positionNumber ?? ""}</Text>
                <Text style={styles.cDesc}>{p.description}</Text>
                <Text style={styles.cQty}>{(p.quantity ?? 0).toLocaleString("de-AT", { maximumFractionDigits: 3 })}</Text>
                <Text style={styles.cUnit}>{p.unit ?? ""}</Text>
                <Text style={styles.cPrice}>{fmt(p.unitPrice ?? 0)}</Text>
                <Text style={[styles.cTotal, styles.bold]}>{fmt(p.totalNet ?? 0)}</Text>
              </View>
            );
          })}
        </View>

        {/* Totals */}
        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.muted}>Nettobetrag</Text>
            <Text>{fmt(document.totalNet)}</Text>
          </View>
          {Array.from(vatBuckets.entries()).sort(([a], [b]) => a - b).map(([rate, v]) => (
            <View key={rate} style={styles.totalRow}>
              <Text style={styles.muted}>USt. {rate} %</Text>
              <Text>{fmt(v.vat)}</Text>
            </View>
          ))}
          <View style={styles.totalRowGrand}>
            <Text>Gesamt</Text>
            <Text>{fmt(document.totalGross)}</Text>
          </View>
        </View>

        {document.closingText && <Text style={styles.closing}>{document.closingText}</Text>}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <View style={styles.footerCol}>
            <Text style={styles.bold}>{tenant.legalName ?? tenant.name}</Text>
            <Text>{tenant.addressStreet}</Text>
            <Text>{tenant.addressZip} {tenant.addressCity}</Text>
          </View>
          <View style={styles.footerCol}>
            {tenant.email && <Text>{tenant.email}</Text>}
            {tenant.phone && <Text>{tenant.phone}</Text>}
            {tenant.website && <Text>{tenant.website}</Text>}
            {tenant.vatId && <Text>UID: {tenant.vatId}</Text>}
          </View>
          <View style={styles.footerCol}>
            {tenant.bankName && <Text>{tenant.bankName}</Text>}
            {tenant.iban && <Text>IBAN: {tenant.iban}</Text>}
            {tenant.bic && <Text>BIC: {tenant.bic}</Text>}
          </View>
        </View>

        <Text style={styles.pageNum} render={({ pageNumber, totalPages }) => `Seite ${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
