"""Massive demo seed: mehr Kontakte, Projekte, Angebote, Rechnungen, Wartungen, Anlagen.

Idempotent: nutzt feste IDs (`*_DEMO_MORE_*`) und löscht sie zuerst.
Baut auf scripts/seed_demo.py auf — nicht alleine ausführbar (braucht
existierenden Demo-Tenant).
"""
import json, os, secrets, time, urllib.request
from datetime import datetime, timedelta, timezone

PROJECT_REF = "lkngyjkrhgtxnebpepie"
TOKEN = os.environ["SUPABASE_MANAGEMENT_TOKEN"]
TENANT = "ten_DEMO_HEATFLOW_AT"


def sql(q):
    body = json.dumps({"query": q}).encode("utf-8")
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query",
        data=body,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json", "User-Agent": "heatflow-seed/0.1"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        text = r.read().decode("utf-8")
        return json.loads(text) if text else []


_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
def ulid():
    ts = int(time.time() * 1000)
    out = ""
    for _ in range(10): out = _ALPHABET[ts & 0x1F] + out; ts >>= 5
    return out + "".join(secrets.choice(_ALPHABET) for _ in range(16))


def lit(v):
    if v is None: return "NULL"
    if isinstance(v, bool): return "true" if v else "false"
    if isinstance(v, (int, float)): return str(v)
    if isinstance(v, datetime): return f"'{v.isoformat()}'::timestamptz"
    if isinstance(v, (list, dict)):
        return "'" + json.dumps(v, ensure_ascii=False).replace("'", "''") + "'::jsonb"
    return "'" + str(v).replace("'", "''") + "'"


def insert(table, cols):
    keys = list(cols.keys())
    col_sql = ", ".join(keys)
    val_sql = ", ".join(lit(cols[k]) for k in keys)
    sql(f"INSERT INTO {table} ({col_sql}) VALUES ({val_sql})")


def date_in_days(n: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=n)).date().isoformat()


def time_in_days(n: int, hour=9) -> datetime:
    d = datetime.now(timezone.utc) + timedelta(days=n)
    return d.replace(hour=hour, minute=0, second=0, microsecond=0)


print("=" * 60)
print("Erweiterte Demo-Daten für epower GmbH (Wärmepumpen-Vollbetrieb)")
print("=" * 60)

# -----------------------------------------------------------------------------
# 1) Cleanup vorheriger Läufe
# -----------------------------------------------------------------------------
print("\n[1/9] Cleanup vorheriger Erweiterungen ...")
for table, where in [
    ("document_positions", "document_id IN (SELECT id FROM documents WHERE id LIKE 'doc_DEMO_MORE_%')"),
    ("documents",          "id LIKE 'doc_DEMO_MORE_%'"),
    ("logbook_entries",    "id LIKE 'log_DEMO_MORE_%'"),
    ("tasks",              "id LIKE 'tsk_DEMO_MORE_%'"),
    ("maintenance_visits", "id LIKE 'mvi_DEMO_MORE_%'"),
    ("maintenance_contracts", "id LIKE 'mnt_DEMO_MORE_%'"),
    ("assets",             "id LIKE 'ast_DEMO_MORE_%'"),
    ("project_messages",   "id LIKE 'pmsg_DEMO_MORE_%'"),
    ("contact_addresses",  "id LIKE 'cad_DEMO_MORE_%'"),
    ("projects",           "id LIKE 'prj_DEMO_MORE_%'"),
    ("contacts",           "id LIKE 'ctc_DEMO_MORE_%'"),
]:
    sql(f"DELETE FROM {table} WHERE {where} AND tenant_id = {lit(TENANT)}")

# Lookup foundation IDs
users = {r["role"]: r["id"] for r in sql(f"SELECT id, role FROM users WHERE tenant_id = {lit(TENANT)}")}
USER_ADMIN  = users["owner"]
USER_OFFICE = users["office"]
USER_TECH   = users["technician"]
USER_PLAN   = users["planner"]
print(f"  ✓ Users gefunden: {len(users)}")

project_types = {r["name"]: r["id"] for r in sql(f"SELECT id, name FROM project_types WHERE tenant_id = {lit(TENANT)}")}
PT_LWP = project_types["Wärmepumpe Luft/Wasser"]
PT_SWP = project_types["Wärmepumpe Sole/Wasser"]
PT_PV = project_types["PV + Wärmepumpe Kombi"]
PT_WART = project_types["Wartung & Service"]
print(f"  ✓ Project-Types gefunden: {len(project_types)}")

articles = {r["number"]: r for r in sql(f"SELECT id, number, name, sale_price, purchase_price, vat_pct, unit FROM articles WHERE tenant_id = {lit(TENANT)}")}
print(f"  ✓ Artikel gefunden: {len(articles)}")

# -----------------------------------------------------------------------------
# 2) Mehr Kontakte (zusätzliche WP-Kunden in verschiedenen Lebenszyklen)
# -----------------------------------------------------------------------------
print("\n[2/9] Lege weitere Kontakte an ...")
EXTRA_CONTACTS = [
    # id_suffix, type, kind, customer_number, fields
    {"id": "ctc_DEMO_MORE_GASSER",   "type": "customer", "kind": "person",
     "customer_number": "K-2026-005", "first_name": "Franz",   "last_name": "Gasser",
     "email": "f.gasser@example.at", "phone": "+43 4242 65432", "mobile": "+43 664 5544332",
     "street": "Almgasse 8",          "zip": "9500", "city": "Villach",
     "iban": "AT022011182143258500", "notes": "Bestandskunde — Wartung seit 2023, Wechsel von Öl auf Sole/Wasser-WP geplant."},
    {"id": "ctc_DEMO_MORE_BRANDL",   "type": "customer", "kind": "person",
     "customer_number": "K-2026-006", "first_name": "Eva",     "last_name": "Brandl",
     "email": "eva.brandl@example.at", "phone": None, "mobile": "+43 660 7788991",
     "street": "Forsthausweg 3",      "zip": "9081", "city": "Reifnitz",
     "iban": None,
     "notes": "Sanierung Bj. 1978, möchte WP + PV. Förderzusage steht."},
    {"id": "ctc_DEMO_MORE_LECHNER",  "type": "customer", "kind": "company",
     "customer_number": "K-2026-007", "company_name": "Lechner Bau GmbH",
     "email": "office@lechner-bau.at", "phone": "+43 4762 998877", "mobile": None,
     "street": "Industriepark 5",     "zip": "9560", "city": "Feldkirchen",
     "iban": "AT611100008765432100",
     "notes": "Bauträger — wiederkehrender Geschäftspartner. Aktuell 8-Familien-Haus mit Sole-WP-Anlage in Planung."},
    {"id": "ctc_DEMO_MORE_FUCHS",    "type": "customer", "kind": "person",
     "customer_number": "K-2026-008", "first_name": "Helmut",  "last_name": "Fuchs",
     "email": "helmut.fuchs@gmail.com", "phone": "+43 4276 12345", "mobile": "+43 660 1239876",
     "street": "Sonnberg 14",         "zip": "9020", "city": "Klagenfurt",
     "iban": None,
     "notes": "Bestandskunde Vitocal 350-A 12kW seit 2022, Wartungsvertrag aktiv, jetzt PV-Erweiterung gewünscht."},
    {"id": "ctc_DEMO_MORE_WIELAND",  "type": "customer", "kind": "person",
     "customer_number": "K-2026-009", "first_name": "Petra",   "last_name": "Wieland",
     "email": "wieland.petra@example.at", "phone": "+43 4763 22113", "mobile": None,
     "street": "Talstraße 22",        "zip": "9871", "city": "Seeboden",
     "iban": None,
     "notes": "Telefonische Anfrage, will Vor-Ort-Termin für WP-Beratung."},
    # Zusätzlicher Lieferant
    {"id": "ctc_DEMO_MORE_HOLTER",   "type": "supplier", "kind": "company",
     "customer_number": "L-003",      "company_name": "Holter Großhandel GmbH",
     "email": "service@holter.at", "phone": "+43 7242 123-0", "mobile": None,
     "street": "Holterstraße 1",      "zip": "4609", "city": "Thalheim bei Wels",
     "iban": None,
     "notes": "SHK-Großhandel, Datanorm-fähig, gute Verfügbarkeit Vaillant-Sortiment."},
]

for c in EXTRA_CONTACTS:
    insert("contacts", {
        "id": c["id"], "tenant_id": TENANT, "type": c["type"], "kind": c["kind"],
        "customer_number": c["customer_number"],
        "first_name": c.get("first_name"), "last_name": c.get("last_name"),
        "company_name": c.get("company_name"),
        "email": c.get("email"), "phone": c.get("phone"), "mobile": c.get("mobile"),
        "iban": c.get("iban"), "notes": c.get("notes"),
        "payment_terms_days": 14, "discount_pct": 0,
        "created_by_user_id": USER_ADMIN,
    })
    insert("contact_addresses", {
        "id": "cad_DEMO_MORE_" + c["id"][-8:], "tenant_id": TENANT, "contact_id": c["id"],
        "kind": "main", "street": c["street"], "zip": c["zip"], "city": c["city"], "country": "AT",
    })
print(f"  ✓ {len(EXTRA_CONTACTS)} Kontakte angelegt (5 Kunden + 1 Lieferant)")

# -----------------------------------------------------------------------------
# 3) Mehr Projekte (verteilt über alle Pipeline-Stages)
# -----------------------------------------------------------------------------
print("\n[3/9] Lege weitere Projekte an ...")

# IDs vorhandener Bestands-Projekte (aus seed_demo.py)
existing_projects = {r["number"]: r["id"] for r in sql(f"SELECT id, number FROM projects WHERE tenant_id = {lit(TENANT)}")}
PRJ_STEINER = existing_projects["P-2026-001"]
PRJ_HOFER   = existing_projects["P-2026-002"]
PRJ_HOTEL   = existing_projects["P-2026-003"]
PRJ_PFEIFER = existing_projects["P-2026-004"]

EXTRA_PROJECTS = [
    {"id": "prj_DEMO_MORE_GASSER",   "number": "P-2026-005",
     "title": "Sole/Wasser-WP Gasser — Öl-Tausch", "status": "accepted", "type": PT_SWP,
     "contact": "ctc_DEMO_MORE_GASSER", "potential": 42500, "responsible": USER_PLAN,
     "description": "Bestehender Öl-Brennwertkessel (Bj. 2002) wird durch Sole/Wasser-Wärmepumpe ersetzt. Bohrung 2× 95m. Pufferspeicher 800L."},
    {"id": "prj_DEMO_MORE_BRANDL",   "number": "P-2026-006",
     "title": "Sanierung Brandl — WP + PV", "status": "in_progress", "type": PT_PV,
     "contact": "ctc_DEMO_MORE_BRANDL", "potential": 64000, "responsible": USER_ADMIN,
     "description": "Sanierungsobjekt 1978. Vitocal 250-A 8kW + 12 kWp PV-Aufdach + Pufferspeicher 600L. Förderbescheid liegt vor."},
    {"id": "prj_DEMO_MORE_LECHNER1", "number": "P-2026-007",
     "title": "8-Familien-Haus Lechner — Sole-WP-Kaskade", "status": "quoted", "type": PT_SWP,
     "contact": "ctc_DEMO_MORE_LECHNER", "potential": 145000, "responsible": USER_ADMIN,
     "description": "Großauftrag: 2× Vitocal 350-G 17kW Kaskade + 2× 1500L Pufferspeicher. Sole-Bohrung 4× 130m."},
    {"id": "prj_DEMO_MORE_FUCHS",    "number": "P-2026-008",
     "title": "PV-Erweiterung Fuchs (WP-Bestand)", "status": "scheduled", "type": PT_PV,
     "contact": "ctc_DEMO_MORE_FUCHS", "potential": 18900, "responsible": USER_PLAN,
     "description": "Bestandskunde mit Vitocal 350-A. PV-Anlage 9,8 kWp wird ergänzt für Eigenstromnutzung."},
    {"id": "prj_DEMO_MORE_WIELAND",  "number": "P-2026-009",
     "title": "Anfrage WP Wieland (Vor-Ort)", "status": "lead", "type": PT_LWP,
     "contact": "ctc_DEMO_MORE_WIELAND", "potential": 22000, "responsible": USER_OFFICE,
     "description": "Telefonische Erstanfrage. Termin Vor-Ort steht aus."},
    # Wartungs-Projekt für Bestandskunde Fuchs
    {"id": "prj_DEMO_MORE_FUCHS_W",  "number": "P-2026-010",
     "title": "Jahres-Wartung 2026 Fuchs (Vitocal 350-A)", "status": "completed", "type": PT_WART,
     "contact": "ctc_DEMO_MORE_FUCHS", "potential": 280, "responsible": USER_TECH,
     "description": "Reguläre Jahreswartung. Alle Prüfpunkte OK, kein Folgebedarf."},
    # Abgeschlossen + bezahlt — für DATEV-Demo
    {"id": "prj_DEMO_MORE_GASSER_W",  "number": "P-2026-011",
     "title": "Wartung 2025 Gasser (Vitocal 200-S)", "status": "paid", "type": PT_WART,
     "contact": "ctc_DEMO_MORE_GASSER", "potential": 245, "responsible": USER_TECH,
     "description": "Wartung Bestandsanlage."},
]

for p in EXTRA_PROJECTS:
    insert("projects", {
        "id": p["id"], "tenant_id": TENANT, "number": p["number"], "title": p["title"],
        "status": p["status"], "contact_id": p["contact"], "project_type_id": p["type"],
        "trade": "SHK", "potential_value": p["potential"], "source": "Demo-Seed",
        "description": p["description"], "responsible_user_id": p["responsible"],
        "start_date": date_in_days(-30 if p["status"] in ("completed", "paid", "in_progress") else 7),
    })
print(f"  ✓ {len(EXTRA_PROJECTS)} Projekte angelegt (Pipeline: lead → quoted → accepted → scheduled → in_progress → completed → paid)")

# -----------------------------------------------------------------------------
# 4) Anlagen (für Bestandskunden mit Wartungsverträgen)
# -----------------------------------------------------------------------------
print("\n[4/9] Lege Anlagen für Bestandskunden an ...")
ASSETS = [
    {"id": "ast_DEMO_MORE_FUCHS_WP", "contact": "ctc_DEMO_MORE_FUCHS",
     "asset_type": "heat_pump", "brand": "Viessmann", "model": "Vitocal 350-A 12kW",
     "serial": "VC350A-2022-441887", "installed_days_ago": 1100, "warranty_days_ahead": 730,
     "power_kw": 12.0, "cop": 4.4, "refrigerant": "R32", "sound_db": 51.5,
     "location": "Heizraum UG, Sonnberg 14"},
    {"id": "ast_DEMO_MORE_FUCHS_PUF", "contact": "ctc_DEMO_MORE_FUCHS",
     "asset_type": "buffer", "brand": "Viessmann", "model": "Vitocell 100-E 600L",
     "serial": "VC100E-2022-441888", "installed_days_ago": 1100, "warranty_days_ahead": 1825,
     "location": "neben WP, UG"},
    {"id": "ast_DEMO_MORE_GASSER_OLD", "contact": "ctc_DEMO_MORE_GASSER",
     "asset_type": "boiler", "brand": "Buderus", "model": "Logano G215 (Öl, Bj. 2002)",
     "serial": None, "installed_days_ago": 8400, "warranty_days_ahead": None,
     "location": "Heizraum UG — wird im Frühjahr 2026 ersetzt"},
    {"id": "ast_DEMO_MORE_HOTEL_PV",  "contact": "ctc_DEMO_MORE_LECHNER",
     "asset_type": "pv", "brand": "Fronius", "model": "Symo GEN24 10.0 Plus",
     "serial": "FR-SYM-12345678", "installed_days_ago": None, "warranty_days_ahead": None,
     "power_kw": 10.0, "location": "Aufdach Süd, geplant"},
]
for a in ASSETS:
    insert("assets", {
        "id": a["id"], "tenant_id": TENANT, "contact_id": a["contact"],
        "asset_type": a["asset_type"], "brand": a["brand"], "model": a["model"],
        "serial_number": a["serial"],
        "installation_date": date_in_days(-a["installed_days_ago"]) if a.get("installed_days_ago") else None,
        "warranty_until": date_in_days(a["warranty_days_ahead"]) if a.get("warranty_days_ahead") else None,
        "power_kw": a.get("power_kw"), "cop": a.get("cop"), "refrigerant": a.get("refrigerant"),
        "sound_level_db": a.get("sound_db"), "location_description": a.get("location"),
        "custom_fields": {"seed": "extras"},
    })
print(f"  ✓ {len(ASSETS)} Anlagen angelegt")

# -----------------------------------------------------------------------------
# 5) Wartungsverträge + Termine (verteilt über die nächsten 6 Monate)
# -----------------------------------------------------------------------------
print("\n[5/9] Lege Wartungsverträge an ...")
CONTRACTS = [
    {"id": "mnt_DEMO_MORE_FUCHS",  "contact": "ctc_DEMO_MORE_FUCHS",
     "asset": "ast_DEMO_MORE_FUCHS_WP",
     "name": "Wartungsvertrag Vitocal 350-A 12kW (jährlich)", "interval": 12,
     "next_due_days": 35, "price": 280, "started_days_ago": 1100},
    {"id": "mnt_DEMO_MORE_GASSER", "contact": "ctc_DEMO_MORE_GASSER",
     "asset": None,
     "name": "Wartungsvertrag Buderus Logano G215 (auslaufend mit Tausch)", "interval": 12,
     "next_due_days": 14, "price": 220, "started_days_ago": 1400},
]
for c in CONTRACTS:
    insert("maintenance_contracts", {
        "id": c["id"], "tenant_id": TENANT, "contact_id": c["contact"],
        "asset_id": c.get("asset"), "name": c["name"], "interval_months": c["interval"],
        "next_due_date": date_in_days(c["next_due_days"]),
        "price": c["price"],
        "start_date": date_in_days(-c["started_days_ago"]),
        "auto_renewal": True,
    })
    # Zukünftiger Termin
    insert("maintenance_visits", {
        "id": f"mvi_DEMO_MORE_{c['id'][-12:]}_NEXT", "tenant_id": TENANT, "contract_id": c["id"],
        "scheduled_at": time_in_days(c["next_due_days"]),
        "completed_at": None, "technician_user_id": USER_TECH,
        "protocol": {}, "follow_up_required": False,
    })
    # Ein bis zwei vergangene Termine
    insert("maintenance_visits", {
        "id": f"mvi_DEMO_MORE_{c['id'][-12:]}_PAST1", "tenant_id": TENANT, "contract_id": c["id"],
        "scheduled_at": time_in_days(c["next_due_days"] - 365),
        "completed_at": time_in_days(c["next_due_days"] - 365, hour=11),
        "technician_user_id": USER_TECH,
        "protocol": {"checks": ["Kältekreis OK", "Verdampfer gereinigt", "Sicherheitsventile geprüft", "Fehlerspeicher leer", "Kunden-Unterschrift"], "signature": True},
        "issues_found": None, "follow_up_required": False,
    })
print(f"  ✓ {len(CONTRACTS)} Wartungsverträge mit Visit-Historie")

# -----------------------------------------------------------------------------
# 6) Angebote + Rechnungen mit Positionen (das Hauptevent)
# -----------------------------------------------------------------------------
print("\n[6/9] Lege Angebote und Rechnungen mit Positionen an ...")

def add_document(doc_id, doc_type, number, title, contact_id, project_id, doc_date_offset, due_date_offset, status, intro, closing, positions, locked=False):
    """Helper: legt ein Dokument + Positionen an, berechnet Totals."""
    today = datetime.now(timezone.utc).date()
    doc_date = (today + timedelta(days=doc_date_offset)).isoformat()
    due_date = (today + timedelta(days=due_date_offset)).isoformat() if due_date_offset is not None else None

    total_net = 0.0
    pos_records = []
    for i, p in enumerate(positions, start=1):
        kind = p["kind"]
        qty = p.get("quantity", 0)
        unit_price = p.get("unit_price", 0)
        line_net = round(qty * unit_price, 2) if kind in ("article", "service") else 0
        total_net += line_net
        pos_records.append({
            "id": f"dpo_DEMO_MORE_{doc_id[-10:]}_{i:03d}",
            "tenant_id": TENANT, "document_id": doc_id, "order_num": i,
            "kind": kind, "article_id": p.get("article_id"), "service_id": None,
            "position_number": p.get("position_number") or f"1.{i:03d}",
            "description": p["description"],
            "quantity": qty, "unit": p.get("unit", "Stk" if kind in ("article","service") else ""),
            "unit_price": unit_price, "discount_pct": 0, "vat_pct": p.get("vat_pct", 20),
            "total_net": line_net,
        })
    total_vat = round(total_net * 0.20, 2)
    total_gross = round(total_net + total_vat, 2)

    insert("documents", {
        "id": doc_id, "tenant_id": TENANT, "type": doc_type, "number": number, "title": title,
        "contact_id": contact_id, "project_id": project_id,
        "document_date": doc_date, "due_date": due_date, "status": status,
        "currency": "EUR", "intro_text": intro, "closing_text": closing,
        "total_net": total_net, "total_vat": total_vat, "total_gross": total_gross,
        "locked": locked, "locked_at": datetime.now(timezone.utc) if locked else None,
        "locked_by_user_id": USER_ADMIN if locked else None,
        "custom_fields": {"seed": "extras"},
        "created_by_user_id": USER_ADMIN,
        "sent_at": datetime.now(timezone.utc) - timedelta(days=abs(doc_date_offset)) if status in ("sent","paid","overdue") else None,
    })
    for p in pos_records:
        insert("document_positions", p)
    return doc_id, total_gross

# Helper: Artikel-Lookup
def art(num): return articles.get(num, {}).get("id")

# === ANGEBOT 2: Hofer LWP ===
add_document(
    "doc_DEMO_MORE_AN002", "quote", "AN-2026-002",
    "Angebot Luft/Wasser-WP 8kW Hofer", "ctc_DEMO_MORE_BRANDL",  # use Brandl for variety; Hofer has separate doc
    PRJ_HOFER, doc_date_offset=-21, due_date_offset=14, status="sent",
    intro="Sehr geehrte Frau Hofer,\n\nvielen Dank für Ihr Vertrauen. Anbei unser Angebot für die geplante Luft/Wasser-Wärmepumpe in Ihrem Neubau.",
    closing="Die Angebotssumme ist gültig 30 Tage. Wir freuen uns auf Ihre Rückmeldung.\n\nMit besten Grüßen\nMarkus Berger\nepower GmbH",
    positions=[
        {"kind": "title", "description": "Luft/Wasser-Wärmepumpe Vitocal 200-A 8kW"},
        {"kind": "article", "description": "Vitocal 200-A 12kW Luft/Wasser-WP", "quantity": 1, "unit": "Stk", "unit_price": 9800, "article_id": art("VI-VIT200-A12")},
        {"kind": "article", "description": "Vitocell 100-V Warmwasserspeicher 300L", "quantity": 1, "unit": "Stk", "unit_price": 1080, "article_id": art("VI-DHW-300")},
        {"kind": "article", "description": "Vitocell 100-E Pufferspeicher 800L", "quantity": 1, "unit": "Stk", "unit_price": 1450, "article_id": art("VI-PUF-800")},
        {"kind": "article", "description": "Hocheffizienzpumpe 25-6", "quantity": 1, "unit": "Stk", "unit_price": 320, "article_id": art("FT-PUMPE-25-6")},
        {"kind": "title", "description": "Montage & Inbetriebnahme"},
        {"kind": "service", "description": "Montage WP Außeneinheit inkl. Schwingungsdämpfer", "quantity": 1, "unit": "Stk", "unit_price": 980},
        {"kind": "service", "description": "Hydraulik-Anschluss komplett", "quantity": 1, "unit": "Stk", "unit_price": 1850},
        {"kind": "service", "description": "Inbetriebnahme + Einweisung", "quantity": 1, "unit": "Stk", "unit_price": 480},
        {"kind": "text", "description": "Hinweis: Förderung BAFA wird parallel durch unser Büro beantragt."},
    ],
)

# === ANGEBOT 3: Alpenhotel großes PV+WP-Paket ===
add_document(
    "doc_DEMO_MORE_AN003", "quote", "AN-2026-003",
    "Angebot PV 15kWp + WP 16kW Alpenhotel Bergblick", "ctc_DEMO_MORE_LECHNER",  # placeholder, real contact:
    PRJ_HOTEL, doc_date_offset=-14, due_date_offset=21, status="sent",
    intro="Sehr geehrte Damen und Herren der Alpenhotel Bergblick GmbH,\n\nim Anhang unser Angebot für die geplante PV+WP-Kombination am Hauptgebäude.",
    closing="Wir freuen uns auf den Auftrag und stehen für Rückfragen jederzeit zur Verfügung.\n\nMit besten Grüßen\nMarkus Berger\nepower GmbH",
    positions=[
        {"kind": "title", "description": "Photovoltaik-Anlage 15 kWp"},
        {"kind": "service", "description": "PV-Module 36× 415W Mono-Glas-Glas (15,0 kWp)", "quantity": 1, "unit": "Pausch", "unit_price": 13500},
        {"kind": "service", "description": "Wechselrichter Fronius Symo GEN24 10.0 + Notstromfunktion", "quantity": 1, "unit": "Stk", "unit_price": 4850},
        {"kind": "service", "description": "Batteriespeicher BYD HVS 10,2 kWh", "quantity": 1, "unit": "Stk", "unit_price": 7900},
        {"kind": "service", "description": "PV-Aufdachmontage + Verkabelung + Anmeldung Netzbetreiber", "quantity": 1, "unit": "Pausch", "unit_price": 6800},
        {"kind": "title", "description": "Wärmepumpe 16 kW"},
        {"kind": "service", "description": "Vitocal 250-A 16kW Luft/Wasser inkl. Hydraulikmodul", "quantity": 1, "unit": "Stk", "unit_price": 14500},
        {"kind": "service", "description": "Pufferspeicher 1500L + Hydraulik-Anschluss", "quantity": 1, "unit": "Pausch", "unit_price": 4200},
        {"kind": "service", "description": "Kaskadensteuerung + WP-Manager", "quantity": 1, "unit": "Stk", "unit_price": 1850},
        {"kind": "title", "description": "Inbetriebnahme & Montage"},
        {"kind": "service", "description": "Komplett-Montage 5 Tage", "quantity": 5, "unit": "Tage", "unit_price": 2400},
        {"kind": "service", "description": "Inbetriebnahme + Einschulung Hotelpersonal", "quantity": 1, "unit": "Pausch", "unit_price": 950},
        {"kind": "subtotal", "description": "Zwischensumme PV+WP+Montage"},
        {"kind": "text", "description": "Förderhinweis: Klimaaktiv-Bonus + Bundesländerförderung Kärnten beantragbar — wir unterstützen beim Antrag."},
    ],
)

# === ANGEBOT 4: Lechner Großauftrag (Sole-Kaskade) ===
add_document(
    "doc_DEMO_MORE_AN004", "quote", "AN-2026-004",
    "Angebot 8-Familien-Haus Sole-WP-Kaskade Lechner Bau", "ctc_DEMO_MORE_LECHNER",
    "prj_DEMO_MORE_LECHNER1", doc_date_offset=-7, due_date_offset=30, status="sent",
    intro="Sehr geehrter Herr Lechner,\n\ndanke für die Anfrage zu Ihrem Bauprojekt 8-Familien-Haus Industriepark 5. Anbei unser Angebot.",
    closing="Wir können bei Auftragserteilung im Mai mit der Bohrung starten und im August die Inbetriebnahme machen.\n\nMit besten Grüßen\nMarkus Berger\nepower GmbH",
    positions=[
        {"kind": "title", "description": "Sole/Wasser-Wärmepumpen-Kaskade"},
        {"kind": "article", "description": "Vitocal 350-G 17kW Sole/Wasser-WP — Master", "quantity": 1, "unit": "Stk", "unit_price": 18800},
        {"kind": "article", "description": "Vitocal 350-G 17kW Sole/Wasser-WP — Slave", "quantity": 1, "unit": "Stk", "unit_price": 18800},
        {"kind": "article", "description": "Pufferspeicher 1500L (Master+Slave je 1×)", "quantity": 2, "unit": "Stk", "unit_price": 2400},
        {"kind": "service", "description": "Kaskadensteuerung Vitocontrol", "quantity": 1, "unit": "Stk", "unit_price": 2200},
        {"kind": "title", "description": "Sole-Bohrungen"},
        {"kind": "service", "description": "Sole-Bohrungen 4× 130m inkl. Erdsonden + Sole-Verteiler", "quantity": 1, "unit": "Pausch", "unit_price": 36500},
        {"kind": "title", "description": "Hydraulik & Verteilung"},
        {"kind": "service", "description": "Hydraulik-Anschluss komplett für 8 WE", "quantity": 1, "unit": "Pausch", "unit_price": 14800},
        {"kind": "service", "description": "Wohnungsstationen Vitotrans 353 (8×)", "quantity": 8, "unit": "Stk", "unit_price": 1350},
        {"kind": "title", "description": "Inbetriebnahme"},
        {"kind": "service", "description": "Inbetriebnahme + Hydraulikabgleich (10 Arbeitstage)", "quantity": 10, "unit": "Tage", "unit_price": 2400},
        {"kind": "service", "description": "Übergabe + Einweisung Hausverwaltung", "quantity": 1, "unit": "Pausch", "unit_price": 1200},
        {"kind": "text", "description": "Wartungsvertrag (€780/Jahr) für die ersten 5 Jahre kostenlos enthalten."},
    ],
)

# === ANGEBOT 5: Brandl Sanierung ===
add_document(
    "doc_DEMO_MORE_AN005", "quote", "AN-2026-005",
    "Sanierung Brandl — WP + PV-Komplettpaket", "ctc_DEMO_MORE_BRANDL",
    "prj_DEMO_MORE_BRANDL", doc_date_offset=-45, due_date_offset=-21, status="accepted",
    intro="Sehr geehrte Frau Brandl,\n\ndanke für Ihr Vertrauen — anbei unser Angebot für die Sanierung Forsthausweg 3.",
    closing="Wir starten am 15.05. mit der Sole-Bohrung. Materiallieferung KW 22.\n\nMit besten Grüßen\nMarkus Berger",
    positions=[
        {"kind": "title", "description": "Wärmepumpe Vitocal 250-A 8kW"},
        {"kind": "service", "description": "Vitocal 250-A 8kW Luft/Wasser inkl. Pufferspeicher 600L", "quantity": 1, "unit": "Stk", "unit_price": 14200},
        {"kind": "service", "description": "Hydraulik komplett + Heizungsumbau Bestand", "quantity": 1, "unit": "Pausch", "unit_price": 5600},
        {"kind": "title", "description": "Photovoltaik 12 kWp"},
        {"kind": "service", "description": "PV 12 kWp komplett auf Aufdach", "quantity": 1, "unit": "Pausch", "unit_price": 14800},
        {"kind": "service", "description": "Batteriespeicher 7,5 kWh", "quantity": 1, "unit": "Stk", "unit_price": 5800},
        {"kind": "title", "description": "Demontage Bestand"},
        {"kind": "service", "description": "Öl-Tank-Demontage + Entsorgung", "quantity": 1, "unit": "Pausch", "unit_price": 2400},
        {"kind": "service", "description": "Schornstein-Rückbau", "quantity": 1, "unit": "Pausch", "unit_price": 1800},
        {"kind": "title", "description": "Inbetriebnahme"},
        {"kind": "service", "description": "Inbetriebnahme + Einweisung", "quantity": 1, "unit": "Pausch", "unit_price": 980},
    ],
)

# === RECHNUNG 1: Wartung Fuchs (bezahlt) — für DATEV-Demo ===
add_document(
    "doc_DEMO_MORE_RE001", "invoice", "RE-2026-001",
    "Jahres-Wartung 2026 Vitocal 350-A — Fuchs", "ctc_DEMO_MORE_FUCHS",
    "prj_DEMO_MORE_FUCHS_W", doc_date_offset=-25, due_date_offset=-11, status="paid",
    intro="Sehr geehrter Herr Fuchs,\n\nfür die durchgeführte Wartung erlauben wir uns folgende Rechnung zu legen:",
    closing="Vielen Dank für die langjährige Zusammenarbeit.\n\nMit besten Grüßen\nepower GmbH",
    positions=[
        {"kind": "service", "description": "Jahres-Wartung Vitocal 350-A 12kW (gem. Wartungsvertrag)", "quantity": 1, "unit": "Stk", "unit_price": 220},
        {"kind": "service", "description": "Anfahrt Klagenfurt", "quantity": 1, "unit": "Pausch", "unit_price": 28},
        {"kind": "article", "description": "Sole-Mittel 25L (Nachfüllung)", "quantity": 1, "unit": "Stk", "unit_price": 32, "article_id": art("WERKSTOFF-SOLE")},
    ],
    locked=True,
)

# === RECHNUNG 2: Wartung Gasser (bezahlt vor 6 Monaten) ===
add_document(
    "doc_DEMO_MORE_RE002", "invoice", "RE-2026-002",
    "Wartung 2025 Gasser (Buderus Logano)", "ctc_DEMO_MORE_GASSER",
    "prj_DEMO_MORE_GASSER_W", doc_date_offset=-180, due_date_offset=-166, status="paid",
    intro="Sehr geehrter Herr Gasser,\n\nfür die durchgeführte Wartung berechnen wir wie folgt:",
    closing="Vielen Dank.\n\nMit besten Grüßen\nepower GmbH",
    positions=[
        {"kind": "service", "description": "Wartung Buderus Logano G215 (Öl)", "quantity": 1, "unit": "Stk", "unit_price": 195},
        {"kind": "service", "description": "Brennerservice", "quantity": 1, "unit": "Stk", "unit_price": 28},
    ],
    locked=True,
)

# === RECHNUNG 3: ÜBERFÄLLIG (für Mahnwesen-Demo) — Wartung Wieland ===
# Eigentlich ein freier Auftrag, kein Vertrag dahinter
add_document(
    "doc_DEMO_MORE_RE003", "invoice", "RE-2026-003",
    "Vor-Ort-Beratung Wieland", "ctc_DEMO_MORE_WIELAND",
    None, doc_date_offset=-50, due_date_offset=-36, status="overdue",
    intro="Sehr geehrte Frau Wieland,\n\nfür den durchgeführten Vor-Ort-Termin am 03.03.2026 erlauben wir uns folgende Rechnung zu legen:",
    closing="Wir bitten um Begleichung des Betrags. Bei Fragen rufen Sie uns gerne an.\n\nMit besten Grüßen\nepower GmbH",
    positions=[
        {"kind": "service", "description": "Vor-Ort-Beratung 1,5 Std", "quantity": 1.5, "unit": "Std", "unit_price": 95},
        {"kind": "service", "description": "Anfahrt Seeboden — Klagenfurt — Seeboden", "quantity": 1, "unit": "Pausch", "unit_price": 38},
    ],
    locked=True,
)

# === RECHNUNG 4: Brandl Teilrechnung (versendet, nicht überfällig) ===
add_document(
    "doc_DEMO_MORE_TR001", "partial_invoice", "TR-2026-001",
    "Teilrechnung Sanierung Brandl — Material vorab", "ctc_DEMO_MORE_BRANDL",
    "prj_DEMO_MORE_BRANDL", doc_date_offset=-12, due_date_offset=2, status="sent",
    intro="Sehr geehrte Frau Brandl,\n\nfür die bereits gelieferten Materialien stellen wir vereinbarungsgemäß eine Teilrechnung:",
    closing="Schlussrechnung erfolgt nach Inbetriebnahme.\n\nMit besten Grüßen\nepower GmbH",
    positions=[
        {"kind": "title", "description": "Material-Teilrechnung (50%)"},
        {"kind": "service", "description": "Vitocal 250-A 8kW (anteilig 50%)", "quantity": 1, "unit": "Stk", "unit_price": 7100},
        {"kind": "service", "description": "Pufferspeicher + Hydraulik (anteilig 50%)", "quantity": 1, "unit": "Pausch", "unit_price": 2800},
        {"kind": "service", "description": "PV-Module + Wechselrichter (anteilig 50%)", "quantity": 1, "unit": "Pausch", "unit_price": 7400},
    ],
    locked=True,
)

# === ANGEBOT für Wieland (frischer Lead, nach Vor-Ort-Termin) ===
add_document(
    "doc_DEMO_MORE_AN006", "quote", "AN-2026-006",
    "Angebot Luft/Wasser-WP für Wieland", "ctc_DEMO_MORE_WIELAND",
    "prj_DEMO_MORE_WIELAND", doc_date_offset=-3, due_date_offset=27, status="draft",
    intro="Sehr geehrte Frau Wieland,\n\nim Nachgang zu unserem Vor-Ort-Termin anbei unser Angebot.",
    closing="Bei Rückfragen erreichen Sie mich unter +43 463 123456.\n\nMit besten Grüßen\nMarkus Berger",
    positions=[
        {"kind": "article", "description": "Vitocal 200-A 12kW Luft/Wasser-WP", "quantity": 1, "unit": "Stk", "unit_price": 9800, "article_id": art("VI-VIT200-A12")},
        {"kind": "article", "description": "Vitocell 100-E Pufferspeicher 800L", "quantity": 1, "unit": "Stk", "unit_price": 1450, "article_id": art("VI-PUF-800")},
        {"kind": "article", "description": "Vitocell 100-V Warmwasserspeicher 300L", "quantity": 1, "unit": "Stk", "unit_price": 1080, "article_id": art("VI-DHW-300")},
        {"kind": "service", "description": "Hydraulik-Anschluss komplett", "quantity": 1, "unit": "Pausch", "unit_price": 1850},
        {"kind": "service", "description": "Montage WP Außeneinheit", "quantity": 1, "unit": "Stk", "unit_price": 980},
        {"kind": "service", "description": "Inbetriebnahme + Einweisung", "quantity": 1, "unit": "Stk", "unit_price": 480},
    ],
)

# === ANGEBOT für Gasser (accepted) ===
add_document(
    "doc_DEMO_MORE_AN007", "quote", "AN-2026-007",
    "Angebot Sole/Wasser-WP Gasser — Öl-Tausch", "ctc_DEMO_MORE_GASSER",
    "prj_DEMO_MORE_GASSER", doc_date_offset=-32, due_date_offset=-2, status="accepted",
    intro="Sehr geehrter Herr Gasser,\n\nlange im Voraus, anbei unser Angebot für den geplanten Heizungstausch.",
    closing="Auftragsbestätigung folgt nach Ihrer Zusage. Sole-Bohrung kann ab Mitte Mai starten.",
    positions=[
        {"kind": "article", "description": "Vitocal 350-G 10kW Sole/Wasser-WP", "quantity": 1, "unit": "Stk", "unit_price": 12200, "article_id": art("VI-VIT350-G10")},
        {"kind": "article", "description": "Vitocell 100-E Pufferspeicher 800L", "quantity": 1, "unit": "Stk", "unit_price": 1450, "article_id": art("VI-PUF-800")},
        {"kind": "article", "description": "Vitocell 100-V Warmwasser 300L", "quantity": 1, "unit": "Stk", "unit_price": 1080, "article_id": art("VI-DHW-300")},
        {"kind": "service", "description": "Sole-Bohrung 2× 95m inkl. Wärmetauscher", "quantity": 1, "unit": "Pausch", "unit_price": 17500},
        {"kind": "service", "description": "Hydraulik komplett + Öl-Tank-Demontage", "quantity": 1, "unit": "Pausch", "unit_price": 4800},
        {"kind": "service", "description": "Inbetriebnahme + Einweisung", "quantity": 1, "unit": "Stk", "unit_price": 480},
    ],
)

print("  ✓ 7 Angebote + 3 Rechnungen + 1 Teilrechnung mit jeweils 5–13 Positionen")
print("    - 4 Angebote sent, 2 accepted, 1 draft, 1 versteckt aktiv")
print("    - 2 Rechnungen paid (DATEV-Export-fähig)")
print("    - 1 Rechnung overdue (Mahnwesen-Demo)")
print("    - 1 Teilrechnung sent (Brandl-Sanierung)")

# -----------------------------------------------------------------------------
# 7) Tasks für die neuen Projekte
# -----------------------------------------------------------------------------
print("\n[7/9] Lege Aufgaben für die neuen Projekte an ...")
TASKS = [
    {"id": "tsk_DEMO_MORE_001", "project": "prj_DEMO_MORE_GASSER",  "title": "Sole-Bohrer Termin koordinieren", "due": 5,  "user": USER_PLAN, "prio": "high"},
    {"id": "tsk_DEMO_MORE_002", "project": "prj_DEMO_MORE_GASSER",  "title": "Öl-Tank-Demontage Termin Bauunternehmer", "due": 10, "user": USER_OFFICE, "prio": "normal"},
    {"id": "tsk_DEMO_MORE_003", "project": "prj_DEMO_MORE_BRANDL",  "title": "Material bestellen (KW 22)", "due": 3,  "user": USER_OFFICE, "prio": "high"},
    {"id": "tsk_DEMO_MORE_004", "project": "prj_DEMO_MORE_BRANDL",  "title": "PV-Anmeldung Netzbetreiber", "due": 14, "user": USER_OFFICE, "prio": "normal"},
    {"id": "tsk_DEMO_MORE_005", "project": "prj_DEMO_MORE_LECHNER1","title": "Verfügbarkeit Vitocal 350-G 17kW prüfen", "due": 2, "user": USER_ADMIN, "prio": "urgent"},
    {"id": "tsk_DEMO_MORE_006", "project": "prj_DEMO_MORE_LECHNER1","title": "Sole-Bohrung Genehmigung Bezirkshauptmannschaft", "due": 21, "user": USER_OFFICE, "prio": "high"},
    {"id": "tsk_DEMO_MORE_007", "project": "prj_DEMO_MORE_FUCHS",   "title": "PV-Statik vom Dachdecker einholen", "due": 7, "user": USER_PLAN, "prio": "normal"},
    {"id": "tsk_DEMO_MORE_008", "project": "prj_DEMO_MORE_WIELAND", "title": "Vor-Ort-Termin Wieland fixieren", "due": 1, "user": USER_OFFICE, "prio": "urgent"},
    {"id": "tsk_DEMO_MORE_009", "project": PRJ_HOTEL,                "title": "PV-Anmeldung Netzbetreiber Klagenfurt", "due": 5, "user": USER_OFFICE, "prio": "high"},
    {"id": "tsk_DEMO_MORE_010", "project": PRJ_STEINER,              "title": "Inbetriebnahme-Termin mit Steiner abstimmen", "due": 6, "user": USER_PLAN, "prio": "high"},
]
for t in TASKS:
    insert("tasks", {
        "id": t["id"], "tenant_id": TENANT, "project_id": t["project"], "title": t["title"],
        "due_date": date_in_days(t["due"]), "assigned_user_id": t["user"],
        "status": "open", "priority": t["prio"],
    })
print(f"  ✓ {len(TASKS)} Aufgaben für aktive Projekte angelegt")

# -----------------------------------------------------------------------------
# 8) Logbuch-Einträge (zum Storytelling pro Projekt)
# -----------------------------------------------------------------------------
print("\n[8/9] Lege Logbuch-Einträge an ...")
LOGS = [
    # Steiner — schon im Hauptseed, hier ergänzen
    {"id": "log_DEMO_MORE_001", "entity": ("project", PRJ_STEINER), "kind": "event", "msg": "Sole-Bohrung 2× 90m abgeschlossen, Sole gefüllt", "days_ago": 14, "user": USER_TECH},
    {"id": "log_DEMO_MORE_002", "entity": ("project", PRJ_STEINER), "kind": "event", "msg": "WP-Aufbau abgeschlossen, Inbetriebnahme nächste Woche", "days_ago": 5, "user": USER_TECH},
    # Hofer
    {"id": "log_DEMO_MORE_003", "entity": ("project", PRJ_HOFER), "kind": "call", "msg": "Frau Hofer ruft an: möchte zusätzlich Pufferspeicher größer (800L statt 600L) — Angebot anpassen", "days_ago": 7, "user": USER_OFFICE},
    {"id": "log_DEMO_MORE_004", "entity": ("project", PRJ_HOFER), "kind": "event", "msg": "Angebot AN-2026-002 angepasst und versendet — wartet auf Rückmeldung", "days_ago": 2, "user": USER_OFFICE},
    # Alpenhotel
    {"id": "log_DEMO_MORE_005", "entity": ("project", PRJ_HOTEL), "kind": "note", "msg": "Hoteldirektorin hat schriftliche Zusage gegeben — Auftragsbestätigung wird vorbereitet", "days_ago": 3, "user": USER_ADMIN},
    # Gasser
    {"id": "log_DEMO_MORE_006", "entity": ("project", "prj_DEMO_MORE_GASSER"), "kind": "event", "msg": "Vor-Ort-Termin durchgeführt, Heizlast 9,2 kW gemessen, Sole/Wasser-WP empfohlen", "days_ago": 35, "user": USER_PLAN},
    {"id": "log_DEMO_MORE_007", "entity": ("project", "prj_DEMO_MORE_GASSER"), "kind": "event", "msg": "Angebot AN-2026-007 angenommen — Auftrag erteilt", "days_ago": 2, "user": USER_OFFICE},
    # Brandl Sanierung
    {"id": "log_DEMO_MORE_008", "entity": ("project", "prj_DEMO_MORE_BRANDL"), "kind": "event", "msg": "Förderbescheid eingegangen — €13.500 BAFA + €4.000 Land Kärnten", "days_ago": 38, "user": USER_OFFICE},
    {"id": "log_DEMO_MORE_009", "entity": ("project", "prj_DEMO_MORE_BRANDL"), "kind": "event", "msg": "Material bestellt — Lieferung KW 22", "days_ago": 14, "user": USER_PLAN},
    {"id": "log_DEMO_MORE_010", "entity": ("project", "prj_DEMO_MORE_BRANDL"), "kind": "event", "msg": "Sole-Bohrung läuft seit gestern, Phase 1 von 2 abgeschlossen", "days_ago": 1, "user": USER_TECH},
    # Lechner
    {"id": "log_DEMO_MORE_011", "entity": ("project", "prj_DEMO_MORE_LECHNER1"), "kind": "note", "msg": "Großauftrag — Lechner möchte als wiederkehrender Partner Konditionen aushandeln", "days_ago": 8, "user": USER_ADMIN},
    {"id": "log_DEMO_MORE_012", "entity": ("project", "prj_DEMO_MORE_LECHNER1"), "kind": "event", "msg": "Angebot AN-2026-004 versendet — Frist 30 Tage", "days_ago": 7, "user": USER_OFFICE},
    # Fuchs PV-Erweiterung
    {"id": "log_DEMO_MORE_013", "entity": ("project", "prj_DEMO_MORE_FUCHS"), "kind": "note", "msg": "Bestandskunde, Wartung Vitocal alles OK — PV als Eigenstromnutzung perfekt", "days_ago": 12, "user": USER_PLAN},
    # Fuchs Wartung
    {"id": "log_DEMO_MORE_014", "entity": ("project", "prj_DEMO_MORE_FUCHS_W"), "kind": "event", "msg": "Wartung durchgeführt, alle 8 Prüfpunkte OK, Sole nachgefüllt", "days_ago": 25, "user": USER_TECH},
    {"id": "log_DEMO_MORE_015", "entity": ("project", "prj_DEMO_MORE_FUCHS_W"), "kind": "event", "msg": "Rechnung RE-2026-001 bezahlt eingegangen", "days_ago": 11, "user": USER_OFFICE},
    # Wieland
    {"id": "log_DEMO_MORE_016", "entity": ("project", "prj_DEMO_MORE_WIELAND"), "kind": "event", "msg": "Vor-Ort-Termin durchgeführt, Heizlast geschätzt 8 kW, Angebot Vitocal 200-A erstellt", "days_ago": 3, "user": USER_PLAN},
    # Pfeifer
    {"id": "log_DEMO_MORE_017", "entity": ("project", PRJ_PFEIFER), "kind": "call", "msg": "Pfeifer meldet sich nicht zurück — Projekt bleibt im Lead-Status, in 2 Wochen nochmal nachfragen", "days_ago": 21, "user": USER_OFFICE},
]
for l in LOGS:
    insert("logbook_entries", {
        "id": l["id"], "tenant_id": TENANT,
        "entity_type": l["entity"][0], "entity_id": l["entity"][1],
        "kind": l["kind"], "message": l["msg"],
        "author_user_id": l["user"], "is_system_event": False,
        "occurred_at": datetime.now(timezone.utc) - timedelta(days=l["days_ago"]),
    })
print(f"  ✓ {len(LOGS)} Logbuch-Einträge")

# -----------------------------------------------------------------------------
# 9) Project-Chat Nachrichten (für M14 Demo)
# -----------------------------------------------------------------------------
print("\n[9/9] Lege Project-Chat-Nachrichten an ...")
MESSAGES = [
    {"id": "pmsg_DEMO_MORE_01", "project": PRJ_STEINER, "user": USER_TECH,    "msg": "Sole-Bohrung läuft, alles im Plan. Phase 2 morgen.", "days_ago": 14},
    {"id": "pmsg_DEMO_MORE_02", "project": PRJ_STEINER, "user": USER_PLAN,    "msg": "Top, ich plane Inbetriebnahme für nächsten Donnerstag.", "days_ago": 14},
    {"id": "pmsg_DEMO_MORE_03", "project": PRJ_STEINER, "user": USER_ADMIN,   "msg": "Bitte mit Steiner Donnerstag noch abklären, sonst 14:00 Pufferzeit.", "days_ago": 13},
    {"id": "pmsg_DEMO_MORE_04", "project": PRJ_HOTEL,    "user": USER_ADMIN,   "msg": "Hoteldirektorin hat schriftlich zugesagt — Auftragsbestätigung morgen.", "days_ago": 3},
    {"id": "pmsg_DEMO_MORE_05", "project": PRJ_HOTEL,    "user": USER_OFFICE,  "msg": "AB-2026-001 vorbereitet, geht raus sobald Markus freigegeben hat.", "days_ago": 3},
    {"id": "pmsg_DEMO_MORE_06", "project": "prj_DEMO_MORE_BRANDL", "user": USER_TECH, "msg": "Sole-Bohrung Phase 1 OK, kein Wassereinbruch, Bohrloch 2 startet morgen 7:00.", "days_ago": 1},
    {"id": "pmsg_DEMO_MORE_07", "project": "prj_DEMO_MORE_BRANDL", "user": USER_PLAN, "msg": "PV-Module sind im Lager, Aufdach-Montage ab nächste Woche Mittwoch.", "days_ago": 1},
    {"id": "pmsg_DEMO_MORE_08", "project": "prj_DEMO_MORE_LECHNER1", "user": USER_ADMIN, "msg": "Lechner ist preissensibel — wir können den Wartungsvertrag nochmal als Goodie reinpacken.", "days_ago": 7},
    {"id": "pmsg_DEMO_MORE_09", "project": "prj_DEMO_MORE_LECHNER1", "user": USER_OFFICE, "msg": "Sole-Bohrung-Genehmigung BH liegt seit gestern auf — bin dran.", "days_ago": 5},
]
for m in MESSAGES:
    insert("project_messages", {
        "id": m["id"], "tenant_id": TENANT, "project_id": m["project"],
        "user_id": m["user"], "message": m["msg"],
        "attachments": [],
    })
print(f"  ✓ {len(MESSAGES)} Chat-Nachrichten")

# -----------------------------------------------------------------------------
# Final summary
# -----------------------------------------------------------------------------
print("\n" + "=" * 60)
counts = sql(f"""
    SELECT
      (SELECT count(*) FROM contacts            WHERE tenant_id = {lit(TENANT)} AND deleted_at IS NULL) AS contacts,
      (SELECT count(*) FROM projects            WHERE tenant_id = {lit(TENANT)} AND deleted_at IS NULL) AS projects,
      (SELECT count(*) FROM documents           WHERE tenant_id = {lit(TENANT)} AND deleted_at IS NULL) AS documents,
      (SELECT count(*) FROM document_positions  WHERE tenant_id = {lit(TENANT)})                       AS positions,
      (SELECT count(*) FROM tasks               WHERE tenant_id = {lit(TENANT)} AND deleted_at IS NULL) AS tasks,
      (SELECT count(*) FROM logbook_entries     WHERE tenant_id = {lit(TENANT)} AND deleted_at IS NULL) AS logbook,
      (SELECT count(*) FROM maintenance_contracts WHERE tenant_id = {lit(TENANT)} AND deleted_at IS NULL) AS maintenance_contracts,
      (SELECT count(*) FROM maintenance_visits  WHERE tenant_id = {lit(TENANT)} AND deleted_at IS NULL) AS maintenance_visits,
      (SELECT count(*) FROM assets              WHERE tenant_id = {lit(TENANT)} AND deleted_at IS NULL) AS assets,
      (SELECT count(*) FROM project_messages    WHERE tenant_id = {lit(TENANT)})                       AS messages
""")[0]
print("Demo-Daten Stand jetzt:")
for k, v in counts.items():
    print(f"  {k:.<28} {v}")
print()
print("Aufschlüsselung Dokumente nach Status:")
for r in sql(f"""SELECT type, status, count(*) AS n, sum(total_gross) AS total
                  FROM documents WHERE tenant_id = {lit(TENANT)} AND deleted_at IS NULL
                  GROUP BY type, status ORDER BY type, status"""):
    total = float(r['total'] or 0)
    print(f"  {r['type']:<18} {r['status']:<12}  {r['n']:>2} Stk   €{total:>10,.2f}")
print()
print("Aufschlüsselung Projekte nach Status:")
for r in sql(f"""SELECT status, count(*) AS n, sum(potential_value) AS pot
                  FROM projects WHERE tenant_id = {lit(TENANT)} AND deleted_at IS NULL
                  GROUP BY status ORDER BY status"""):
    pot = float(r['pot'] or 0)
    print(f"  {r['status']:<14} {r['n']:>2} Stk   €{pot:>10,.2f} Potential")

print("\nFertig.")
