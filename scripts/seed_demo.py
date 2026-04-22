"""Seed the demo tenant for HeatFlow into Supabase via the Management API.

Idempotent: drops the existing demo tenant before re-creating.
Mirrors packages/db/src/seed.ts (TS version requires Node + DB password).
"""
import json
import os
import sys
import urllib.request
import urllib.error
import secrets
import string
import time
from datetime import datetime, timedelta, timezone

PROJECT_REF = "lkngyjkrhgtxnebpepie"
TOKEN = os.environ["SUPABASE_MANAGEMENT_TOKEN"]

# argon2id hash of "demo1234" — verified, OK to commit (DEMO ONLY)
DEMO_PW_HASH = "$argon2id$v=19$m=65536,t=3,p=4$1TUG1n6SvHl/kfppG98aNQ$Cay0SvxxARtpK4R4PhR9f9LOrJucsO9ogieZln/iKiQ"


def run_sql(query: str) -> list:
    body = json.dumps({"query": query}).encode("utf-8")
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query",
        data=body,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
            "User-Agent": "heatflow-seed/0.1",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            text = resp.read().decode("utf-8")
            if not text:
                return []
            data = json.loads(text)
            return data if isinstance(data, list) else []
    except urllib.error.HTTPError as e:
        body_txt = e.read().decode("utf-8", errors="replace")
        raise SystemExit(f"HTTP {e.code} {e.reason}\n{body_txt}\n--- query ---\n{query[:500]}")


# ULID-ish generator (Crockford base32 + timestamp ms). Sufficient for seeds.
_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"


def ulid() -> str:
    ts = int(time.time() * 1000)
    ts_part = ""
    for _ in range(10):
        ts_part = _ALPHABET[ts & 0x1F] + ts_part
        ts >>= 5
    rand_part = "".join(secrets.choice(_ALPHABET) for _ in range(16))
    return ts_part + rand_part


def nid(prefix: str) -> str:
    return f"{prefix}_{ulid()}"


def lit(v) -> str:
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, datetime):
        return f"'{v.isoformat()}'::timestamptz"
    if isinstance(v, (list, dict)):
        return "'" + json.dumps(v).replace("'", "''") + "'::jsonb"
    return "'" + str(v).replace("'", "''") + "'"


def insert(table: str, cols: dict) -> None:
    keys = list(cols.keys())
    col_sql = ", ".join(keys)
    val_sql = ", ".join(lit(cols[k]) for k in keys)
    run_sql(f"INSERT INTO {table} ({col_sql}) VALUES ({val_sql})")


def date_in_days(n: int) -> str:
    d = (datetime.now(timezone.utc) + timedelta(days=n)).date()
    return d.isoformat()


def main() -> None:
    print("Seeding demo tenant for HeatFlow into Supabase…")

    TENANT_ID = "ten_DEMO_HEATFLOW_AT"
    SLUG = "demo-heatflow"

    # 1. Clean slate
    print("  · wiping existing demo tenant")
    run_sql(f"DELETE FROM tenants WHERE id = {lit(TENANT_ID)} OR slug = {lit(SLUG)}")
    # also clean up any orphaned funding programs from a previous run
    run_sql("DELETE FROM funding_programs WHERE name LIKE '%(Bund AT)%' OR name LIKE '%BAFA%' OR name LIKE '%KfW%' OR name LIKE '%Klimaaktiv%'")

    # 2. Tenant
    print("  · creating tenant")
    insert("tenants", {
        "id": TENANT_ID,
        "name": "epower GmbH",
        "legal_name": "epower GmbH",
        "slug": SLUG,
        "country": "AT",
        "currency": "EUR",
        "locale": "de-AT",
        "vat_id": "ATU12345678",
        "address_street": "Energieweg 12",
        "address_zip": "9020",
        "address_city": "Klagenfurt am Wörthersee",
        "address_country": "AT",
        "email": "office@epower-demo.at",
        "phone": "+43 463 123456",
        "website": "https://www.epower-demo.at",
        "primary_color": "#1e6fff",
        "settings": {"onboarded": True, "demo": True},
    })

    # 3. Features
    print("  · enabling features")
    features = [
        "core.contacts", "core.projects", "core.documents", "core.articles", "core.time",
        "core.e_invoice", "core.mobile", "core.portal",
        "m1.datanorm", "m3.maintenance", "m5.calculation", "m7.funding", "m10.datev", "m12.flow_ai",
    ]
    for f in features:
        insert("tenant_features", {"tenant_id": TENANT_ID, "feature_key": f, "active": True})

    # 4. Users
    print("  · creating users")
    USER_ADMIN = nid("usr")
    USER_OFFICE = nid("usr")
    USER_TECH = nid("usr")
    USER_PLANNER = nid("usr")

    users = [
        (USER_ADMIN,   "Markus Berger",  "admin@demo.heatflow.local",   "owner"),
        (USER_OFFICE,  "Sabine Berger",  "office@demo.heatflow.local",  "office"),
        (USER_TECH,    "Thomas Huber",   "thomas@demo.heatflow.local",  "technician"),
        (USER_PLANNER, "Andreas Maier",  "andreas@demo.heatflow.local", "planner"),
    ]
    for uid, name, email, role in users:
        insert("users", {
            "id": uid, "tenant_id": TENANT_ID, "email": email, "name": name,
            "password_hash": DEMO_PW_HASH, "role": role, "active": True,
        })

    # 5. Tags
    print("  · creating tags")
    TAG_VIP = nid("tag"); TAG_BAFA = nid("tag"); TAG_WARTUNG = nid("tag")
    for tid, name, color in [
        (TAG_VIP,     "VIP",             "#f59e0b"),
        (TAG_BAFA,    "BAFA-Förderung",  "#10b981"),
        (TAG_WARTUNG, "Wartungskunde",   "#6366f1"),
    ]:
        insert("tags", {"id": tid, "tenant_id": TENANT_ID, "name": name, "color": color})

    # 6. Project types
    print("  · creating project types")
    PT_LWP = nid("pty"); PT_SWP = nid("pty"); PT_PV = nid("pty"); PT_WARTUNG = nid("pty")
    stages = [
        "Beratung", "Vor-Ort-Termin", "Heizlast", "Angebot", "Förderung beantragt",
        "Auftrag", "Materialbestellung", "Installation", "Inbetriebnahme", "Abnahme", "Rechnung", "Wartung",
    ]
    for pid, name, color, trade in [
        (PT_LWP,     "Wärmepumpe Luft/Wasser", "#0ea5e9", "SHK"),
        (PT_SWP,     "Wärmepumpe Sole/Wasser", "#0284c7", "SHK"),
        (PT_PV,      "PV + Wärmepumpe Kombi",  "#f59e0b", "Elektro+SHK"),
        (PT_WARTUNG, "Wartung & Service",      "#10b981", "SHK"),
    ]:
        insert("project_types", {
            "id": pid, "tenant_id": TENANT_ID, "name": name, "color": color,
            "trade": trade, "default_stages": stages,
        })

    # 7. Contacts
    print("  · creating contacts")
    contacts = [
        dict(id=nid("ctc"), type="customer", kind="person", customer_number="K-2026-001",
             first_name="Klaus", last_name="Steiner", email="klaus.steiner@example.at",
             phone="+43 463 220 110", mobile="+43 664 1234567",
             street="Seenstraße 5", zip="9081", city="Reifnitz",
             iban="AT611904300234573201",
             notes="Möchte Sole/Wasser-Wärmepumpe, 220m² Wohnfläche, Baujahr 1995.",
             tag_ids=[TAG_VIP, TAG_BAFA]),
        dict(id=nid("ctc"), type="customer", kind="person", customer_number="K-2026-002",
             first_name="Maria", last_name="Hofer", email="maria.hofer@example.at",
             phone="+43 4242 778899", mobile=None,
             street="Bergweg 22", zip="9500", city="Villach", iban=None,
             notes=None, tag_ids=[TAG_BAFA]),
        dict(id=nid("ctc"), type="customer", kind="company", customer_number="K-2026-003",
             first_name=None, last_name=None, company_name="Alpenhotel Bergblick GmbH",
             email="buchhaltung@alpenhotel-bergblick.at", phone="+43 4827 555000", mobile=None,
             street="Almweg 1", zip="9546", city="Bad Kleinkirchheim", iban=None,
             notes=None, tag_ids=[TAG_WARTUNG, TAG_VIP]),
        dict(id=nid("ctc"), type="customer", kind="person", customer_number="K-2026-004",
             first_name="Johann", last_name="Pfeifer", email="j.pfeifer@example.at",
             phone=None, mobile="+43 660 9988776",
             street="Schillerstraße 14", zip="9020", city="Klagenfurt", iban=None,
             notes="Anfrage über Webformular, will Vor-Ort-Termin.", tag_ids=[]),
        dict(id=nid("ctc"), type="supplier", kind="company", customer_number="L-001",
             first_name=None, last_name=None, company_name="Viessmann Österreich GmbH",
             email="service@viessmann.at", phone="+43 1 4030060", mobile=None,
             street="Liechtensteinstraße 4", zip="1090", city="Wien", iban=None,
             notes="Hauptlieferant Wärmepumpen + Speicher.", tag_ids=[]),
        dict(id=nid("ctc"), type="supplier", kind="company", customer_number="L-002",
             first_name=None, last_name=None, company_name="Frauenthal Service AG",
             email="info@frauenthal.at", phone="+43 1 79572-0", mobile=None,
             street="Hainburger Straße 11", zip="1030", city="Wien", iban=None,
             notes="SHK-Großhandel, IDS-Connect-fähig.", tag_ids=[]),
    ]
    contact_id_map: dict[str, str] = {}
    for c in contacts:
        insert("contacts", {
            "id": c["id"], "tenant_id": TENANT_ID, "type": c["type"], "kind": c["kind"],
            "customer_number": c["customer_number"],
            "first_name": c.get("first_name"), "last_name": c.get("last_name"),
            "company_name": c.get("company_name"),
            "email": c.get("email"), "phone": c.get("phone"), "mobile": c.get("mobile"),
            "iban": c.get("iban"), "notes": c.get("notes"),
            "payment_terms_days": 14, "discount_pct": 0, "created_by_user_id": USER_ADMIN,
        })
        insert("contact_addresses", {
            "id": nid("cad"), "tenant_id": TENANT_ID, "contact_id": c["id"], "kind": "main",
            "street": c["street"], "zip": c["zip"], "city": c["city"], "country": "AT",
        })
        contact_id_map[c["customer_number"]] = c["id"]
        for tag_id in c["tag_ids"]:
            run_sql(f"INSERT INTO contact_tags (contact_id, tag_id) VALUES ({lit(c['id'])}, {lit(tag_id)})")

    # 8. Projects
    print("  · creating projects")
    PRJ_1 = nid("prj"); PRJ_2 = nid("prj"); PRJ_3 = nid("prj"); PRJ_4 = nid("prj")
    projects = [
        (PRJ_1, "P-2026-001", "Sole/Wasser-WP 12kW Steiner",  "in_progress", PT_SWP, "K-2026-001", 38500, USER_PLANNER, "Komplettsanierung Heizung: Öl raus, Sole/Wasser-WP rein. Pufferspeicher 800L."),
        (PRJ_2, "P-2026-002", "Luft/Wasser-WP 8kW Hofer",     "quoted",      PT_LWP, "K-2026-002", 22800, USER_PLANNER, "Neubau Einfamilienhaus, FBH bereits vorhanden."),
        (PRJ_3, "P-2026-003", "PV 15 kWp + WP 16kW Alpenhotel","scheduled",  PT_PV,  "K-2026-003", 89000, USER_ADMIN,   "Großauftrag: PV-Aufdach + zwei Kaskade-WPs für Hotel."),
        (PRJ_4, "P-2026-004", "Beratungstermin Pfeifer",       "lead",        PT_LWP, "K-2026-004", 18000, USER_OFFICE,  "Erstkontakt aus Webformular."),
    ]
    for pid, num, title, status, type_id, c_num, pot, resp, desc in projects:
        cid = contact_id_map[c_num]
        insert("projects", {
            "id": pid, "tenant_id": TENANT_ID, "number": num, "title": title, "status": status,
            "contact_id": cid, "project_type_id": type_id, "trade": "SHK",
            "potential_value": pot, "source": "Webformular",
            "description": desc, "responsible_user_id": resp,
        })

    # 9. Articles
    print("  · creating articles")
    articles = [
        ("VI-VIT200-A12",   "Vitocal 200-A 12kW Luft/Wasser-WP",   "Viessmann", 9800,  7200),
        ("VI-VIT350-G10",   "Vitocal 350-G 10kW Sole/Wasser-WP",   "Viessmann", 12200, 9100),
        ("VI-PUF-800",      "Vitocell 100-E Pufferspeicher 800L",  "Viessmann", 1450,  980),
        ("VI-DHW-300",      "Vitocell 100-V Warmwasserspeicher 300L","Viessmann",1080, 720),
        ("FT-AUSDEHN-50",   "Ausdehnungsgefäß 50L",                "Reflex",    89,    52),
        ("FT-PUMPE-25-6",   "Hocheffizienzpumpe 25-6",             "Grundfos",  320,   210),
        ("FT-MISCHER-3W-25","3-Wege-Mischer DN25 mit Stellmotor",  "Honeywell", 280,   165),
        ("WERKSTOFF-SOLE",  "Sole-Flüssigkeit 30%, 25L",           "Tyfocor",   145,   95),
    ]
    for num, name, manu, price, ek in articles:
        insert("articles", {
            "id": nid("art"), "tenant_id": TENANT_ID, "number": num, "name": name,
            "unit": "Stk", "purchase_price": ek, "list_price": price, "sale_price": price,
            "vat_pct": 20, "manufacturer": manu, "manufacturer_number": num,
        })

    # 10. Services
    print("  · creating services")
    for name, price, unit in [
        ("Montage Wärmepumpe Außeneinheit", 980,  "Stk"),
        ("Hydraulik-Anschluss komplett",     1850, "Stk"),
        ("Inbetriebnahme + Einweisung",      480,  "Stk"),
        ("Wartung Wärmepumpe (jährlich)",   220,  "Stk"),
    ]:
        insert("services", {
            "id": nid("svc"), "tenant_id": TENANT_ID, "name": name, "sale_price": price,
            "vat_pct": 20, "unit": unit, "calculation": {"material": [], "labor": []},
        })

    # 11. Time categories + wage groups
    print("  · creating time categories + wage groups")
    for name, color, billable in [
        ("Umsetzung", "#10b981", True),
        ("Fahrzeit",  "#f59e0b", True),
        ("Büro",      "#6366f1", False),
        ("Wartung",   "#0ea5e9", True),
    ]:
        insert("time_categories", {
            "id": nid("tcat"), "tenant_id": TENANT_ID, "name": name, "color": color, "billable": billable,
        })
    for name, rate, cost in [("Geselle", 78.0, 28.0), ("Meister", 95.0, 38.0), ("Lehrling", 42.0, 16.0)]:
        insert("wage_groups", {
            "id": nid("wgr"), "tenant_id": TENANT_ID, "name": name, "hourly_rate": rate, "hourly_cost": cost,
        })

    # 12. Funding programs
    print("  · seeding funding programs")
    for name, country, max_amt, desc in [
        ("Raus-aus-Öl-Bonus (Bund AT)",    "AT", 7500,   "Bundesförderung für Heizungstausch in AT."),
        ("Klimaaktiv Bonus",                 "AT", 2000,   "Bundesländer-Zusatzförderung."),
        ("BAFA BEG EM (Heizung)",            "DE", 30000,  "Bundesförderung effiziente Gebäude."),
        ("KfW 358/359 (Ergänzungskredit)",   "DE", 120000, "Zinsgünstiger KfW-Kredit."),
    ]:
        insert("funding_programs", {
            "id": nid("fpr"), "name": name, "country": country, "max_amount": max_amt,
            "description": desc, "active": True,
        })

    # 13. Tasks
    print("  · creating tasks")
    for proj, title, due_days, assigned, prio in [
        (PRJ_1, "Sole-Bohrung beauftragen",       3, USER_ADMIN,   "high"),
        (PRJ_1, "Pufferspeicher bestellen",       7, USER_OFFICE,  "normal"),
        (PRJ_2, "Heizlastberechnung erstellen",   2, USER_PLANNER, "high"),
        (PRJ_3, "PV-Anmeldung Netzbetreiber",     5, USER_OFFICE,  "normal"),
        (PRJ_4, "Vor-Ort-Termin vereinbaren",     1, USER_OFFICE,  "urgent"),
    ]:
        insert("tasks", {
            "id": nid("tsk"), "tenant_id": TENANT_ID, "project_id": proj, "title": title,
            "due_date": date_in_days(due_days), "assigned_user_id": assigned,
            "status": "open", "priority": prio,
        })

    # 14. Logbook entries
    print("  · creating logbook entries")
    for proj, msg, kind in [
        (PRJ_1, "Erstgespräch bei Familie Steiner. Will Sole/Wasser-WP, Bohrung möglich.", "note"),
        (PRJ_1, "Angebot übermittelt: Vitocal 350-G 10kW + Pufferspeicher 800L.", "event"),
        (PRJ_1, "Auftrag erteilt — Förderung BAFA wird parallel beantragt.", "event"),
        (PRJ_2, "Telefonat mit Frau Hofer — bevorzugt Termin in KW 18.", "call"),
        (PRJ_3, "Hotel hat 2 weitere Objekte für 2027 in Aussicht gestellt.", "note"),
    ]:
        run_sql(
            "INSERT INTO logbook_entries (id, tenant_id, entity_type, entity_id, kind, message, author_user_id, occurred_at) "
            f"VALUES ({lit(nid('log'))}, {lit(TENANT_ID)}, 'project', {lit(proj)}, {lit(kind)}, {lit(msg)}, {lit(USER_OFFICE)}, now())"
        )

    # 15. Email template
    print("  · creating email template")
    body = (
        "Sehr geehrte/r {{Contact.salutation}} {{Contact.lastName}},\n\n"
        "im Anhang finden Sie unser Angebot {{Document.number}} vom {{Document.date}}.\n"
        "Bei Fragen stehen wir gerne zur Verfügung.\n\n"
        "Mit besten Grüßen\n{{User.name}}\n{{Company.name}}"
    )
    insert("email_templates", {
        "id": nid("etpl"), "tenant_id": TENANT_ID, "name": "Standard Angebot", "context": "quote_send",
        "subject": "Ihr Angebot {{Document.number}} von {{Company.name}}",
        "body_text": body,
        "variables": ["Contact.salutation", "Contact.lastName", "Document.number",
                       "Document.date", "User.name", "Company.name"],
        "is_default": True,
    })

    print("\nDone. Demo tenant ready.")
    print(f"  Login:     admin@demo.heatflow.local / demo1234")
    print(f"  Tenant ID: {TENANT_ID}")


if __name__ == "__main__":
    main()
