/**
 * Generates a UN/CEFACT Cross Industry Invoice (CII) XML document — the
 * payload at the heart of both XRechnung (standalone XML) and ZUGFeRD
 * (XML embedded in PDF/A-3).
 *
 * Profile: BASIC — covers what HeatFlow needs for V1 (line items + totals + taxes).
 * Compliant with EN 16931 / XRechnung 3.0 / ZUGFeRD 2.x BASIC.
 *
 * For the full ZUGFeRD pipeline (PDF/A-3 with embedded XML + XMP metadata),
 * we generate the PDF separately (packages/pdf) and embed the XML in a
 * follow-up step using a PDF-A-3-aware library. For now, the XML can be
 * delivered standalone as XRechnung — that satisfies B2G in DE/AT.
 */
import type { PdfContact, PdfDocument, PdfTenant } from "@heatflow/pdf";

const NS = {
  rsm: "urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100",
  ram: "urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100",
  qdt: "urn:un:unece:uncefact:data:standard:QualifiedDataType:100",
  udt: "urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100",
  xsi: "http://www.w3.org/2001/XMLSchema-instance",
};

// ZUGFeRD type code mapping (UNTDID 1001)
const TYPE_CODES: Record<string, string> = {
  quote: "84",                  // commercial offer
  order_confirmation: "220",    // order
  delivery_note: "270",         // delivery note
  invoice: "380",               // commercial invoice
  partial_invoice: "326",       // partial invoice
  final_invoice: "385",         // final invoice
  credit_note: "381",           // credit note
};

// Standard German unit codes (UN/ECE Recommendation 20)
const UNIT_CODES: Record<string, string> = {
  Stk: "H87", "Stück": "H87",
  m: "MTR", m2: "MTK", m3: "MTQ",
  kg: "KGM", g: "GRM", l: "LTR",
  h: "HUR", Std: "HUR", Stunde: "HUR",
  Pauschal: "C62", "%": "P1",
};

function unitCode(unit: string | undefined): string {
  if (!unit) return "C62";
  return UNIT_CODES[unit.trim()] ?? "C62";
}

function escape(s: string | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function num(n: number, digits = 2): string {
  return n.toFixed(digits);
}

function dateBasic(yyyyMmDd: string): string {
  return yyyyMmDd.replace(/-/g, "");
}

export type CiiInput = {
  document: PdfDocument;
  tenant: PdfTenant;
  contact: PdfContact;
  /** XRechnung Leitweg-ID for B2G (skip for B2B). */
  leitwegId?: string | null;
};

/** Render a Cross-Industry-Invoice 100 BASIC XML document. */
export function renderXRechnungXml(input: CiiInput): string {
  const { document, tenant, contact, leitwegId } = input;
  const typeCode = TYPE_CODES[document.type] ?? "380";

  // VAT trade-tax buckets
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

  const lineItems = document.positions
    .map((p, idx) => renderLineItem(p, idx + 1, document.currency))
    .filter(Boolean)
    .join("\n");

  const tradeTaxes = Array.from(vatBuckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([rate, v]) =>
      `      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${num(v.vat)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${num(v.net)}</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>${num(rate, 2)}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>`,
    )
    .join("\n");

  const buyerRef = leitwegId ?? contact.customerNumber ?? document.number;
  const sellerName = tenant.legalName ?? tenant.name;
  const buyerName = (contact.companyName ?? `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim()) || "Unbekannt";

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="${NS.rsm}"
  xmlns:ram="${NS.ram}"
  xmlns:qdt="${NS.qdt}"
  xmlns:udt="${NS.udt}"
  xmlns:xsi="${NS.xsi}">

  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>

  <rsm:ExchangedDocument>
    <ram:ID>${escape(document.number)}</ram:ID>
    <ram:TypeCode>${typeCode}</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${dateBasic(document.documentDate)}</udt:DateTimeString>
    </ram:IssueDateTime>
${document.introText ? `    <ram:IncludedNote><ram:Content>${escape(document.introText)}</ram:Content></ram:IncludedNote>` : ""}
${document.closingText ? `    <ram:IncludedNote><ram:Content>${escape(document.closingText)}</ram:Content></ram:IncludedNote>` : ""}
  </rsm:ExchangedDocument>

  <rsm:SupplyChainTradeTransaction>
${lineItems}

    <ram:ApplicableHeaderTradeAgreement>
      <ram:BuyerReference>${escape(buyerRef)}</ram:BuyerReference>
      <ram:SellerTradeParty>
        <ram:Name>${escape(sellerName)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${escape(tenant.addressZip ?? "")}</ram:PostcodeCode>
          <ram:LineOne>${escape(tenant.addressStreet ?? "")}</ram:LineOne>
          <ram:CityName>${escape(tenant.addressCity ?? "")}</ram:CityName>
          <ram:CountryID>${escape(tenant.addressCountry ?? "AT")}</ram:CountryID>
        </ram:PostalTradeAddress>
${tenant.email ? `        <ram:URIUniversalCommunication><ram:URIID schemeID="EM">${escape(tenant.email)}</ram:URIID></ram:URIUniversalCommunication>` : ""}
${tenant.vatId ? `        <ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${escape(tenant.vatId)}</ram:ID></ram:SpecifiedTaxRegistration>` : ""}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${escape(buyerName)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${escape(contact.zip ?? "")}</ram:PostcodeCode>
          <ram:LineOne>${escape(contact.street ?? "")}</ram:LineOne>
          <ram:CityName>${escape(contact.city ?? "")}</ram:CityName>
          <ram:CountryID>${escape(contact.country ?? "AT")}</ram:CountryID>
        </ram:PostalTradeAddress>
${contact.email ? `        <ram:URIUniversalCommunication><ram:URIID schemeID="EM">${escape(contact.email)}</ram:URIID></ram:URIUniversalCommunication>` : ""}
${contact.vatId ? `        <ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${escape(contact.vatId)}</ram:ID></ram:SpecifiedTaxRegistration>` : ""}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>

    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">${dateBasic(document.documentDate)}</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>

    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${escape(document.currency)}</ram:InvoiceCurrencyCode>
${tenant.iban ? `      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>58</ram:TypeCode>
        <ram:Information>SEPA Überweisung</ram:Information>
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>${escape(tenant.iban)}</ram:IBANID>
        </ram:PayeePartyCreditorFinancialAccount>
${tenant.bic ? `        <ram:PayeeSpecifiedCreditorFinancialInstitution><ram:BICID>${escape(tenant.bic)}</ram:BICID></ram:PayeeSpecifiedCreditorFinancialInstitution>` : ""}
      </ram:SpecifiedTradeSettlementPaymentMeans>` : ""}

${tradeTaxes}

${document.dueDate ? `      <ram:SpecifiedTradePaymentTerms>
        <ram:Description>Zahlbar bis ${document.dueDate}</ram:Description>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${dateBasic(document.dueDate)}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>` : ""}

      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${num(document.totalNet)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${num(document.totalNet)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${escape(document.currency)}">${num(document.totalVat)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${num(document.totalGross)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${num(document.totalGross)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>
`;
}

function renderLineItem(p: { kind: string; positionNumber?: string | null; description: string; quantity?: number; unit?: string; unitPrice?: number; vatPct?: number; totalNet?: number }, lineNo: number, currency: string): string {
  if (p.kind !== "article" && p.kind !== "service") return "";
  return `    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${lineNo}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${escape(p.description)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${num(p.unitPrice ?? 0, 4)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="${unitCode(p.unit)}">${num(p.quantity ?? 0, 3)}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>S</ram:CategoryCode>
          <ram:RateApplicablePercent>${num(p.vatPct ?? 0, 2)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${num(p.totalNet ?? 0)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`;
}
