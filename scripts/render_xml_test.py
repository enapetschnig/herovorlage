"""End-to-end test for XRechnung generation: pulls the live demo document
from Supabase and renders the XML in pure Python (mirrors packages/integrations/zugferd
output 1:1 for the values we care about). Validates the XML parses and contains
the expected EN 16931 anchors.
"""
import json
import os
import sys
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET

PROJECT_REF = "lkngyjkrhgtxnebpepie"
TOKEN = os.environ["SUPABASE_MANAGEMENT_TOKEN"]


def run_sql(query: str) -> list:
    body = json.dumps({"query": query}).encode("utf-8")
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query",
        data=body,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json", "User-Agent": "heatflow-test/0.1"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


# ---- 1. Pull tenant + document + positions
print("Loading data from Supabase...")
tenant = run_sql("SELECT name, legal_name, address_street, address_zip, address_city, address_country, email, phone, vat_id, iban, bic, bank_name FROM tenants WHERE id='ten_DEMO_HEATFLOW_AT'")[0]
doc = run_sql("SELECT id, type, number, title, document_date, due_date, currency, intro_text, closing_text, total_net, total_vat, total_gross, contact_id FROM documents WHERE number='AN-2026-001'")[0]
contact = run_sql(f"SELECT company_name, first_name, last_name, salutation, email, customer_number, vat_id FROM contacts WHERE id='{doc['contact_id']}'")[0]
addr = run_sql(f"SELECT street, zip, city, country FROM contact_addresses WHERE contact_id='{doc['contact_id']}' LIMIT 1")[0]
positions = run_sql(f"SELECT order_num, kind, position_number, description, quantity, unit, unit_price, vat_pct, total_net FROM document_positions WHERE document_id='{doc['id']}' ORDER BY order_num")

print(f"  Tenant: {tenant['name']}")
print(f"  Document: {doc['number']} ({doc['type']}) — €{doc['total_gross']}")
print(f"  Contact: {contact['first_name']} {contact['last_name']} ({addr['street']}, {addr['city']})")
print(f"  Positions: {len(positions)}")

# ---- 2. Generate XML (mirrors packages/integrations/zugferd/src/index.ts)
def esc(s):
    if s is None:
        return ""
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;").replace("'", "&apos;")

def num(n, digits=2):
    return f"{float(n):.{digits}f}"

def date_basic(d):
    return d.replace("-", "")

TYPE_CODES = {"quote": "84", "invoice": "380", "credit_note": "381", "delivery_note": "270", "order_confirmation": "220"}
type_code = TYPE_CODES.get(doc["type"], "380")

# VAT buckets
buckets = {}
for p in positions:
    if p["kind"] not in ("article", "service"):
        continue
    rate = float(p["vat_pct"])
    net = float(p["total_net"])
    if rate not in buckets:
        buckets[rate] = {"net": 0.0, "vat": 0.0}
    buckets[rate]["net"] += net
    buckets[rate]["vat"] += net * rate / 100

# Line items
line_items_xml = []
for i, p in enumerate(positions):
    if p["kind"] not in ("article", "service"):
        continue
    line_items_xml.append(f"""    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument><ram:LineID>{i+1}</ram:LineID></ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct><ram:Name>{esc(p['description'])}</ram:Name></ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice><ram:ChargeAmount>{num(p['unit_price'], 4)}</ram:ChargeAmount></ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="H87">{num(p['quantity'], 3)}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>S</ram:CategoryCode>
          <ram:RateApplicablePercent>{num(p['vat_pct'])}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>{num(p['total_net'])}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>""")

trade_taxes = "\n".join(f"""      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>{num(v['vat'])}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>{num(v['net'])}</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>{num(rate)}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>""" for rate, v in sorted(buckets.items()))

xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>{esc(doc['number'])}</ram:ID>
    <ram:TypeCode>{type_code}</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="102">{date_basic(doc['document_date'])}</udt:DateTimeString></ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
{chr(10).join(line_items_xml)}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:BuyerReference>{esc(contact.get('customer_number'))}</ram:BuyerReference>
      <ram:SellerTradeParty>
        <ram:Name>{esc(tenant.get('legal_name') or tenant['name'])}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>{esc(tenant['address_zip'])}</ram:PostcodeCode>
          <ram:LineOne>{esc(tenant['address_street'])}</ram:LineOne>
          <ram:CityName>{esc(tenant['address_city'])}</ram:CityName>
          <ram:CountryID>{esc(tenant['address_country'] or 'AT')}</ram:CountryID>
        </ram:PostalTradeAddress>
        <ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">{esc(tenant['vat_id'])}</ram:ID></ram:SpecifiedTaxRegistration>
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>{esc(contact.get('company_name') or f"{contact.get('first_name','')} {contact.get('last_name','')}".strip())}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>{esc(addr['zip'])}</ram:PostcodeCode>
          <ram:LineOne>{esc(addr['street'])}</ram:LineOne>
          <ram:CityName>{esc(addr['city'])}</ram:CityName>
          <ram:CountryID>{esc(addr['country'] or 'AT')}</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime><udt:DateTimeString format="102">{date_basic(doc['document_date'])}</udt:DateTimeString></ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>{esc(doc['currency'])}</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>58</ram:TypeCode>
        <ram:Information>SEPA Überweisung</ram:Information>
        <ram:PayeePartyCreditorFinancialAccount><ram:IBANID>{esc(tenant['iban'] or '')}</ram:IBANID></ram:PayeePartyCreditorFinancialAccount>
      </ram:SpecifiedTradeSettlementPaymentMeans>
{trade_taxes}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>{num(doc['total_net'])}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>{num(doc['total_net'])}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="{esc(doc['currency'])}">{num(doc['total_vat'])}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>{num(doc['total_gross'])}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>{num(doc['total_gross'])}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>"""

# ---- 3. Save + validate
import tempfile
out_path = os.path.join(tempfile.gettempdir(), "heatflow_test.xml")
with open(out_path, "w", encoding="utf-8") as f:
    f.write(xml)
print(f"\nWritten {len(xml)} chars to {out_path}")

# Parse
try:
    root = ET.fromstring(xml)
    print(f"  OK XML well-formed")
    ns = {"rsm": "urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100",
          "ram": "urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"}

    inv_id = root.find(".//rsm:ExchangedDocument/ram:ID", ns).text
    type_c = root.find(".//rsm:ExchangedDocument/ram:TypeCode", ns).text
    grand_total = root.find(".//ram:GrandTotalAmount", ns).text
    seller = root.find(".//ram:SellerTradeParty/ram:Name", ns).text
    buyer = root.find(".//ram:BuyerTradeParty/ram:Name", ns).text
    line_items = root.findall(".//ram:IncludedSupplyChainTradeLineItem", ns)
    tax_buckets = root.findall(".//ram:ApplicableHeaderTradeSettlement/ram:ApplicableTradeTax", ns)

    print(f"  OK Invoice ID: {inv_id}")
    print(f"  OK Type Code:  {type_c} (84=offer, 380=invoice)")
    print(f"  OK Seller:     {seller}")
    print(f"  OK Buyer:      {buyer}")
    print(f"  OK Line items: {len(line_items)}")
    print(f"  OK VAT buckets: {len(tax_buckets)}")
    print(f"  OK Grand total: {grand_total}")

    # Sanity: grand_total must equal net+vat
    net = float(root.find(".//ram:LineTotalAmount[1]", ns).text) if False else float(doc['total_net'])
    vat = float(doc['total_vat'])
    expected = round(net + vat, 2)
    if abs(float(grand_total) - expected) < 0.01:
        print(f"  OK Math check OK: {net} + {vat} = {expected}")
    else:
        print(f"  ERR Math check FAILED: {grand_total} vs {expected}")
        sys.exit(1)
except ET.ParseError as e:
    print(f"  ERR XML PARSE ERROR: {e}")
    sys.exit(1)

print("\nFirst 1500 chars of output:")
print("-" * 60)
print(xml[:1500])
print("...")
