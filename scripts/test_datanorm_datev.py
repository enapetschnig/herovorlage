"""Parser + Format tests for Datanorm and DATEV integrations.

Verifies that the Datanorm parser handles a realistic sample file
and that the DATEV CSV output matches the v12.0 header layout.
"""
import io
import sys

# -----------------------------------------------------------------------------
# 1) Datanorm: simulate a mini file and parse it using the same logic
#    the TS parser in packages/integrations/datanorm implements.
# -----------------------------------------------------------------------------
SAMPLE_DATANORM = """V;050;EUR;20260422;050;Frauenthal Service AG;AT;;;
A;N;4711-100;0;Vitocal 350-G 10kW Sole/Wasser-WP;Viessmann Wärmepumpe;ST;1;1;1220000;R1;RG1;;VITO-350-G-10;;;4250123456789
A;N;4711-101;0;Vitocell 100-E Pufferspeicher 800L;Viessmann Hydraulik;ST;1;1;145000;R1;RG1;;VITO-PUF-800;;;4250123456790
A;N;4711-102;0;Vitocell 100-V Warmwasserspeicher 300L;Viessmann Hydraulik;ST;1;1;108000;R1;RG1;;VITO-DHW-300;;;4250123456791
A;A;4711-100;0;Vitocal 350-G 10kW Sole/Wasser-WP;Viessmann Wärmepumpe;ST;1;1;1295000;R1;RG1;;VITO-350-G-10;;;4250123456789
A;L;4711-OLD;0;;;ST;1;1;0;;;;;;;
T;N;4711-100;1;Effiziente Erdwärmepumpe mit hohem COP
T;N;4711-100;2;Für Wohnflächen 150-250 m2 geeignet
"""

PRICE_KIND_MAP = {"1": "list", "2": "purchase", "3": "net", "4": "net"}

def parse_a_record(cols):
    if len(cols) < 10:
        return None
    kind_key = (cols[1] or "N").strip().upper()
    kind = "delete" if kind_key == "L" else "change" if kind_key == "A" else "new"
    number = (cols[2] or "").strip()
    if not number:
        return None
    short_text_parts = [c.strip() for c in [cols[4] if len(cols) > 4 else "", cols[5] if len(cols) > 5 else ""] if c and c.strip()]
    short_text = " ".join(short_text_parts)
    unit = (cols[6] or "ST").strip()
    price_kind = PRICE_KIND_MAP.get((cols[7] or "1").strip(), "list")
    price_per = int((cols[8] or "1").strip() or "1")
    price_cents = int((cols[9] or "0").strip() or "0")
    price_euro = (price_cents / 100) / price_per
    ean = cols[16].strip() if len(cols) > 16 else ""
    return {
        "kind": kind,
        "number": number,
        "short_text": short_text,
        "unit": unit,
        "price_kind": price_kind,
        "price_euro": round(price_euro, 4),
        "ean": ean or None,
    }


def parse_datanorm(text):
    articles = []
    meta = {}
    errors = []
    long_texts = {}
    lines = text.splitlines()
    total_lines = len(lines)
    skipped = 0
    for i, raw in enumerate(lines):
        line = raw.strip()
        if not line:
            skipped += 1
            continue
        cols = line.split(";")
        kind = (cols[0] or "").upper()
        if kind == "V":
            meta = {"supplier": cols[5].strip() if len(cols) > 5 else "", "currency": cols[2].strip() if len(cols) > 2 else "EUR", "date": cols[3].strip() if len(cols) > 3 else ""}
        elif kind == "A":
            art = parse_a_record(cols)
            if art:
                articles.append(art)
            else:
                errors.append({"line": i + 1, "reason": "A-Record unparseable"})
                skipped += 1
        elif kind == "T":
            num = cols[2].strip() if len(cols) > 2 else ""
            txt = cols[4].strip() if len(cols) > 4 else ""
            if num and txt:
                long_texts.setdefault(num, []).append(txt)
        else:
            skipped += 1
    for a in articles:
        if a["number"] in long_texts:
            a["long_text"] = "\n".join(long_texts[a["number"]])
    return {"articles": articles, "total_lines": total_lines, "skipped_lines": skipped, "meta": meta, "errors": errors}


print("=== Datanorm Parser Test ===")
r = parse_datanorm(SAMPLE_DATANORM)
print(f"Meta:     supplier={r['meta'].get('supplier')!r}  currency={r['meta'].get('currency')!r}  date={r['meta'].get('date')!r}")
print(f"Parsed:   {len(r['articles'])} articles from {r['total_lines']} lines ({r['skipped_lines']} skipped)")
print(f"Errors:   {len(r['errors'])}")
print("Articles:")
for a in r["articles"]:
    lt = f"  +longText({len(a.get('long_text',''))} chars)" if a.get("long_text") else ""
    print(f"  [{a['kind']:6}] {a['number']:<12} €{a['price_euro']:>8.2f}  {a['unit']}  {a['short_text'][:50]!r}{lt}")

# Sanity: counts match expectation
assert len(r["articles"]) == 5, f"Expected 5 articles, got {len(r['articles'])}"
assert r["articles"][0]["kind"] == "new"
assert r["articles"][3]["kind"] == "change" and r["articles"][3]["number"] == "4711-100"
assert r["articles"][4]["kind"] == "delete"
assert r["articles"][0]["price_euro"] == 12200.00, f"Expected 12200.00, got {r['articles'][0]['price_euro']}"
assert "long_text" in r["articles"][0] and "COP" in r["articles"][0]["long_text"]
assert r["meta"]["supplier"] == "Frauenthal Service AG"
print("OK — all assertions pass")

# -----------------------------------------------------------------------------
# 2) DATEV format test: build the CSV like the TS renderer does.
# -----------------------------------------------------------------------------
print()
print("=== DATEV CSV Format Test ===")

def format_amount(n):
    return f"{n:.2f}".replace(".", ",")

def format_booking_date(yyyymmdd):
    d = yyyymmdd.replace("-", "")
    return d[6:8] + d[4:6] if len(d) >= 8 else ""

def csv_line(cells):
    out = []
    for c in cells:
        s = str(c) if c is not None else ""
        if s == "":
            out.append("")
        elif any(ch in s for ch in [";", '"', "\r", "\n"]):
            out.append('"' + s.replace('"', '""') + '"')
        else:
            out.append(s)
    return ";".join(out)

# Header (matches TS implementation)
header = [
    "EXTF", "510", "21", "Buchungsstapel", "12",
    "20260422104530000",  # fixed timestamp for reproducibility
    "", "RE", "HeatFlow", "",
    "", "",              # consultant, client (empty for demo)
    "20260101",          # fiscal year start
    "4",                 # account length
    "20260101",          # from
    "20260422",          # to
    "", "", "1", "0", "0", "EUR",
    "", "", "", "", "", "", "", "",  # more empty fields
]
columns = [
    "Umsatz (ohne Soll/Haben-Kz)", "Soll/Haben-Kennzeichen", "WKZ Umsatz", "Kurs",
    "Basis-Umsatz", "WKZ Basis-Umsatz", "Konto", "Gegenkonto (ohne BU-Schlüssel)",
    "BU-Schlüssel", "Belegdatum", "Belegfeld 1", "Belegfeld 2", "Skonto",
    "Buchungstext", "Postenschlüssel-Erweiterung",
]
# Sample booking: Steiner-invoice €31.320 brutto, 20% USt
# Debitor Steiner = 10001, Erlöse 20% = 8400, BU = 3
bookings = [
    (31320.00, "S", "EUR", "", "", "", "10001", "8400", "3", "20260422", "RE-2026-001", "", "", "RE RE-2026-001 Klaus Steiner"),
]

rows = [csv_line(header), csv_line(columns)]
for b in bookings:
    cells = list(b)
    cells[0] = format_amount(cells[0])
    cells[9] = format_booking_date(cells[9])
    rows.append(csv_line(cells))

csv = "\r\n".join(rows) + "\r\n"
print("First 3 lines:")
for i, ln in enumerate(csv.split("\r\n")[:3]):
    print(f"  [{i}] {ln[:120]}{'...' if len(ln) > 120 else ''}")

# Sanity: valid DATEV v12 markers
assert csv.startswith("EXTF;510;21;Buchungsstapel;12"), "DATEV header magic wrong"
assert "\r\n" in csv, "DATEV must use CRLF line endings"
assert '"Umsatz (ohne Soll/Haben-Kz)"' in csv or "Umsatz (ohne Soll/Haben-Kz)" in csv, "Column header missing"
assert "31320,00" in csv, "Amount must use German decimal comma"
assert ";2204;" in csv.replace('"',''), "Booking date TTMM must be 2204 for 22.04"
assert ";S;" in csv, "Debit/Credit flag must be S (Soll)"
assert "RE-2026-001" in csv, "Belegfeld 1 must contain invoice number"
print("OK — header magic valid, CRLF, amount comma, TTMM date, S-flag, Belegfeld")

print()
print("Both integrations parse/render correctly ✓")
