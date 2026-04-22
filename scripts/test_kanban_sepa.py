"""Verify the new pieces against live DB + format checks."""
import json, os, urllib.request, xml.etree.ElementTree as ET, psycopg

PROJECT_REF = "lkngyjkrhgtxnebpepie"
TOKEN = os.environ["SUPABASE_MANAGEMENT_TOKEN"]
DB_URL = os.environ.get("DATABASE_URL_POOLED") or os.environ["DATABASE_URL"]
TENANT = "ten_DEMO_HEATFLOW_AT"

# -----------------------------------------------------------------------------
# 1) Kanban: count projects per status (matches `kanban.board` query)
# -----------------------------------------------------------------------------
print("=== Kanban Board ===")
LANES = ["lead", "quoted", "accepted", "scheduled", "in_progress", "completed", "invoiced"]
with psycopg.connect(DB_URL, autocommit=True) as conn, conn.cursor() as cur:
    for status in LANES:
        cur.execute("""
            SELECT count(*), coalesce(sum(potential_value), 0)
            FROM projects
            WHERE tenant_id=%s AND deleted_at IS NULL AND status = %s
        """, (TENANT, status))
        c, val = cur.fetchone()
        bar = "█" * c
        print(f"  {status:12} {c:>2} cards  €{float(val):>9.2f}  {bar}")

# -----------------------------------------------------------------------------
# 2) SEPA XML format check
# -----------------------------------------------------------------------------
print()
print("=== SEPA XML (pain.008.001.08) ===")

def render_sepa_dd(creditor, collection_date, message_id, transactions):
    total = sum(t["amount"] for t in transactions)
    tx_xml = ""
    for t in transactions:
        tx_xml += f"""
        <DrctDbtTxInf>
          <PmtId><EndToEndId>{t['endToEndId']}</EndToEndId></PmtId>
          <InstdAmt Ccy="EUR">{t['amount']:.2f}</InstdAmt>
          <DrctDbtTx><MndtRltdInf>
            <MndtId>{t['debitor']['mandateId']}</MndtId>
            <DtOfSgntr>{t['debitor']['mandateDate']}</DtOfSgntr>
          </MndtRltdInf></DrctDbtTx>
          <DbtrAgt><FinInstnId><BICFI>{t['debitor']['bic']}</BICFI></FinInstnId></DbtrAgt>
          <Dbtr><Nm>{t['debitor']['name']}</Nm></Dbtr>
          <DbtrAcct><Id><IBAN>{t['debitor']['iban']}</IBAN></Id></DbtrAcct>
          <RmtInf><Ustrd>{t['remittanceInfo']}</Ustrd></RmtInf>
        </DrctDbtTxInf>"""

    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.08">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>{message_id}</MsgId>
      <CreDtTm>2026-04-22T11:00:00</CreDtTm>
      <NbOfTxs>{len(transactions)}</NbOfTxs>
      <CtrlSum>{total:.2f}</CtrlSum>
      <InitgPty><Nm>{creditor['name']}</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>{message_id}-PMT-001</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <NbOfTxs>{len(transactions)}</NbOfTxs>
      <CtrlSum>{total:.2f}</CtrlSum>
      <PmtTpInf>
        <SvcLvl><Cd>SEPA</Cd></SvcLvl>
        <LclInstrm><Cd>CORE</Cd></LclInstrm>
        <SeqTp>RCUR</SeqTp>
      </PmtTpInf>
      <ReqdColltnDt>{collection_date}</ReqdColltnDt>
      <Cdtr><Nm>{creditor['name']}</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>{creditor['iban']}</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BICFI>{creditor['bic']}</BICFI></FinInstnId></CdtrAgt>
      <ChrgBr>SLEV</ChrgBr>
      <CdtrSchmeId><Id><PrvtId><Othr>
        <Id>{creditor['creditorId']}</Id>
        <SchmeNm><Prtry>SEPA</Prtry></SchmeNm>
      </Othr></PrvtId></Id></CdtrSchmeId>{tx_xml}
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>"""

xml = render_sepa_dd(
    creditor={"name": "epower GmbH", "iban": "AT611904300234573201", "bic": "BKAUATWWXXX", "creditorId": "AT44ZZZ00000012345"},
    collection_date="2026-05-01",
    message_id="HF-2026-Q2-001",
    transactions=[
        {"endToEndId": "RE-2026-001", "amount": 31320.00,
         "debitor": {"name": "Klaus Steiner", "iban": "AT611904300234573201", "bic": "BKAUATWWXXX",
                     "mandateId": "MND-K-2026-001", "mandateDate": "2026-03-15"},
         "remittanceInfo": "Rechnung RE-2026-001"}
    ],
)

# Parse + verify
root = ET.fromstring(xml)
ns = {"x": "urn:iso:std:iso:20022:tech:xsd:pain.008.001.08"}
msg_id = root.find(".//x:MsgId", ns).text
ctrl_sum = root.find(".//x:GrpHdr/x:CtrlSum", ns).text
n_tx = root.find(".//x:GrpHdr/x:NbOfTxs", ns).text
seq_tp = root.find(".//x:SeqTp/x:Cd", ns)  # Wrong path, let's check
# Actually
seq_tp = root.find(".//x:PmtTpInf/x:SeqTp", ns)
local_instrument = root.find(".//x:LclInstrm/x:Cd", ns).text
service_level = root.find(".//x:SvcLvl/x:Cd", ns).text
iban_dbt = root.find(".//x:DbtrAcct/x:Id/x:IBAN", ns).text
iban_cdt = root.find(".//x:CdtrAcct/x:Id/x:IBAN", ns).text

assert msg_id == "HF-2026-Q2-001"
assert n_tx == "1"
assert ctrl_sum == "31320.00"
assert seq_tp.text == "RCUR"
assert local_instrument == "CORE"
assert service_level == "SEPA"
assert iban_dbt == "AT611904300234573201"
assert iban_cdt == "AT611904300234573201"
print(f"  OK XML well-formed (pain.008.001.08, {len(xml)} chars)")
print(f"  OK Message ID: {msg_id}")
print(f"  OK Service Level: {service_level} / Local Instrument: {local_instrument} / SeqTp: {seq_tp.text}")
print(f"  OK Control sum matches transactions: {ctrl_sum}")
print(f"  OK Creditor IBAN: {iban_cdt}")
print(f"  OK Debitor IBAN: {iban_dbt}")

# IBAN mod-97 check
def is_valid_iban(iban):
    cleaned = iban.replace(" ", "").upper()
    if not (4 < len(cleaned) <= 34):
        return False
    rearranged = cleaned[4:] + cleaned[:4]
    numeric = ""
    for ch in rearranged:
        if "0" <= ch <= "9":
            numeric += ch
        else:
            numeric += str(ord(ch) - 55)
    return int(numeric) % 97 == 1

print()
print("=== IBAN-Validierung ===")
test_ibans = [
    ("AT611904300234573201", True),  # demo seed IBAN
    ("DE89370400440532013000", True),  # bekannte gültige
    ("AT611904300234573200", False),  # last digit changed → invalid
    ("XYZ", False),
]
for iban, expected in test_ibans:
    actual = is_valid_iban(iban)
    mark = "OK" if actual == expected else "ERR"
    print(f"  {mark} {iban!r:<28} → {actual} (expected {expected})")

# -----------------------------------------------------------------------------
# 3) markOverdue + reminders.overdueList queries
# -----------------------------------------------------------------------------
print()
print("=== Reminders ===")
with psycopg.connect(DB_URL, autocommit=True) as conn, conn.cursor() as cur:
    # How many invoices would be marked overdue?
    cur.execute("""
        SELECT count(*) FROM documents
        WHERE tenant_id=%s AND deleted_at IS NULL
          AND status='sent' AND type IN ('invoice','partial_invoice','final_invoice')
          AND due_date < current_date
    """, (TENANT,))
    overdue_candidates = cur.fetchone()[0]
    print(f"  Aktuell {overdue_candidates} Rechnungen wären als überfällig zu markieren")

    # Existing overdue list query (sent OR overdue + dueDate < today)
    cur.execute("""
        SELECT d.number, d.due_date, d.total_gross, c.email,
               (current_date - d.due_date)::int AS days_overdue
        FROM documents d
        LEFT JOIN contacts c ON c.id = d.contact_id
        WHERE d.tenant_id=%s AND d.deleted_at IS NULL
          AND d.type IN ('invoice','partial_invoice','final_invoice')
          AND d.status IN ('sent','overdue')
          AND d.due_date < current_date
        ORDER BY d.due_date
    """, (TENANT,))
    rows = cur.fetchall()
    if not rows:
        print("  Keine überfälligen Rechnungen im Demo-Tenant — alles OK")
    else:
        for r in rows:
            print(f"  {r[0]} fällig {r[1]} — €{float(r[2]):.2f} — {r[4]} Tage überfällig — {r[3]}")
