"""Adds richer demo data on top of the base seed: a real quote with positions,
time entries, maintenance contract + asset, funding application.

Idempotent: deletes the extras-block first (by tenant_id + a marker on
custom_fields where applicable) before re-inserting.
"""
import json
import os
import secrets
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone

PROJECT_REF = "lkngyjkrhgtxnebpepie"
TOKEN = os.environ["SUPABASE_MANAGEMENT_TOKEN"]


def run_sql(query: str) -> list:
    body = json.dumps({"query": query}).encode("utf-8")
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query",
        data=body,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
            "User-Agent": "heatflow-seed-extras/0.1",
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


TENANT_ID = "ten_DEMO_HEATFLOW_AT"


def fetch_one(query: str):
    rows = run_sql(query)
    return rows[0] if rows else None


def main() -> None:
    print("Seeding richer demo data...")

    # ---- Lookup foundation IDs (created by seed_demo.py)
    project_steiner = fetch_one(
        f"SELECT id, contact_id FROM projects WHERE tenant_id = {lit(TENANT_ID)} AND number = 'P-2026-001'"
    )
    project_hofer = fetch_one(
        f"SELECT id, contact_id FROM projects WHERE tenant_id = {lit(TENANT_ID)} AND number = 'P-2026-002'"
    )
    if not project_steiner or not project_hofer:
        raise SystemExit("Base seed missing — run scripts/seed_demo.py first.")

    user_admin = fetch_one(f"SELECT id FROM users WHERE tenant_id = {lit(TENANT_ID)} AND role = 'owner'")
    user_tech = fetch_one(f"SELECT id FROM users WHERE tenant_id = {lit(TENANT_ID)} AND role = 'technician'")
    user_planner = fetch_one(f"SELECT id FROM users WHERE tenant_id = {lit(TENANT_ID)} AND role = 'planner'")

    article_wp_swp = fetch_one(
        f"SELECT id, sale_price FROM articles WHERE tenant_id = {lit(TENANT_ID)} AND number = 'VI-VIT350-G10'"
    )
    article_buf = fetch_one(
        f"SELECT id, sale_price FROM articles WHERE tenant_id = {lit(TENANT_ID)} AND number = 'VI-PUF-800'"
    )
    article_dhw = fetch_one(
        f"SELECT id, sale_price FROM articles WHERE tenant_id = {lit(TENANT_ID)} AND number = 'VI-DHW-300'"
    )
    article_pump = fetch_one(
        f"SELECT id, sale_price FROM articles WHERE tenant_id = {lit(TENANT_ID)} AND number = 'FT-PUMPE-25-6'"
    )
    funding_at = fetch_one(
        "SELECT id, name FROM funding_programs WHERE country = 'AT' AND name LIKE 'Raus-aus-Öl%'"
    )

    # ---- Wipe extras from previous runs (anything created by this script is keyed off custom_fields.seed='extras')
    print("  · wiping prior extras")
    run_sql(f"DELETE FROM document_positions WHERE document_id IN (SELECT id FROM documents WHERE tenant_id = {lit(TENANT_ID)} AND custom_fields ->> 'seed' = 'extras')")
    run_sql(f"DELETE FROM documents WHERE tenant_id = {lit(TENANT_ID)} AND custom_fields ->> 'seed' = 'extras'")
    run_sql(f"DELETE FROM time_entries WHERE tenant_id = {lit(TENANT_ID)} AND comment LIKE 'SEED%'")
    run_sql(f"DELETE FROM maintenance_visits WHERE tenant_id = {lit(TENANT_ID)}")
    run_sql(f"DELETE FROM maintenance_contracts WHERE tenant_id = {lit(TENANT_ID)}")
    run_sql(f"DELETE FROM assets WHERE tenant_id = {lit(TENANT_ID)} AND custom_fields ->> 'seed' = 'extras'")
    run_sql(f"DELETE FROM funding_applications WHERE tenant_id = {lit(TENANT_ID)}")

    # ---- 1) Sample quote for Steiner project: 12kW Sole/Wasser-WP
    print("  · creating sample quote with positions")
    doc_id = nid("doc")
    today = datetime.now(timezone.utc).date()
    due = today + timedelta(days=30)

    positions = [
        ("title",   None,  "Wärmepumpen-Anlage Steiner — Sole/Wasser 12kW",  0,    "Stk", 0.0,    20.0,  None),
        ("article", article_wp_swp["id"],  "Vitocal 350-G 10kW Sole/Wasser-WP",  1,  "Stk", float(article_wp_swp["sale_price"]),     20.0, None),
        ("article", article_buf["id"],     "Vitocell 100-E Pufferspeicher 800L", 1,  "Stk", float(article_buf["sale_price"]),        20.0, None),
        ("article", article_dhw["id"],     "Vitocell 100-V Warmwasser 300L",     1,  "Stk", float(article_dhw["sale_price"]),        20.0, None),
        ("article", article_pump["id"],    "Hocheffizienzpumpe 25-6",            2,  "Stk", float(article_pump["sale_price"]),       20.0, None),
        ("title",   None,  "Sole-Bohrung & Installation",                       0,    "Stk", 0.0,    20.0,  None),
        ("service", None,  "Sole-Bohrung 2× 90m inkl. Wärmetauscher",            1,  "Stk", 8400.0,  20.0, None),
        ("service", None,  "Hydraulik-Anschluss komplett",                       1,  "Stk", 1850.0,  20.0, None),
        ("service", None,  "Inbetriebnahme + Einweisung",                        1,  "Stk", 480.0,   20.0, None),
        ("text",    None,  "Hinweis: Förderung BAFA / Raus-aus-Öl wird parallel beantragt.", 0, "", 0.0, 0.0, None),
    ]
    total_net = 0.0
    pos_rows = []
    order = 0
    for pos_index, (kind, art_id, desc, qty, unit, unit_price, vat, _) in enumerate(positions, start=1):
        order += 1
        line_net = round(qty * unit_price, 2) if kind in ("article", "service") else 0.0
        total_net += line_net
        pos_rows.append({
            "id": nid("dpo"),
            "tenant_id": TENANT_ID,
            "document_id": doc_id,
            "order_num": order,
            "kind": kind,
            "article_id": art_id if kind == "article" else None,
            "service_id": None,
            "position_number": f"1.{pos_index:03d}",
            "description": desc,
            "quantity": qty,
            "unit": unit or "Stk",
            "unit_price": unit_price,
            "discount_pct": 0,
            "vat_pct": vat,
            "total_net": line_net,
        })
    total_vat = round(total_net * 0.20, 2)
    total_gross = round(total_net + total_vat, 2)

    insert("documents", {
        "id": doc_id,
        "tenant_id": TENANT_ID,
        "type": "quote",
        "number": "AN-2026-001",
        "title": "Angebot Sole/Wasser-WP 12kW Steiner",
        "contact_id": project_steiner["contact_id"],
        "project_id": project_steiner["id"],
        "document_date": today.isoformat(),
        "due_date": due.isoformat(),
        "status": "sent",
        "currency": "EUR",
        "intro_text": "Sehr geehrter Herr Steiner,\n\nvielen Dank für Ihre Anfrage. Anbei unser Angebot für die geplante Sole/Wasser-Wärmepumpen-Anlage.",
        "closing_text": "Wir freuen uns auf Ihre Rückmeldung. Bei Fragen einfach anrufen.\n\nMit besten Grüßen\nMarkus Berger\nepower GmbH",
        "total_net": total_net,
        "total_vat": total_vat,
        "total_gross": total_gross,
        "locked": False,
        "custom_fields": {"seed": "extras"},
        "created_by_user_id": user_admin["id"],
    })
    for p in pos_rows:
        insert("document_positions", p)

    # Add a logbook entry for the document
    run_sql(
        "INSERT INTO logbook_entries (id, tenant_id, entity_type, entity_id, kind, message, author_user_id, occurred_at) "
        f"VALUES ({lit(nid('log'))}, {lit(TENANT_ID)}, 'project', {lit(project_steiner['id'])}, 'event', "
        f"{lit('Angebot AN-2026-001 erstellt — €' + str(total_gross))}, {lit(user_admin['id'])}, now())"
    )

    # ---- 2) Time entries (last 5 days, multiple users + projects)
    print("  · creating time entries")
    base = datetime.now(timezone.utc).replace(microsecond=0, second=0, minute=0)
    time_entries = [
        # day, user, project, hours, activity, comment
        (1, user_tech["id"],    project_steiner["id"], 7.5, "work",       "SEED — Sole-Bohrung begleitet"),
        (1, user_planner["id"], project_steiner["id"], 2.0, "work",       "SEED — Hydraulik-Schema finalisiert"),
        (2, user_tech["id"],    project_steiner["id"], 8.0, "work",       "SEED — Pufferspeicher angeschlossen"),
        (2, user_admin["id"],   project_hofer["id"],   1.5, "consulting", "SEED — Vor-Ort-Besichtigung Hofer"),
        (3, user_tech["id"],    project_hofer["id"],   6.0, "work",       "SEED — Außeneinheit montiert"),
        (3, user_tech["id"],    None,                  1.0, "drive",      "SEED — Fahrt zum Großhandel"),
        (4, user_planner["id"], project_steiner["id"], 3.0, "work",       "SEED — Inbetriebnahme-Vorbereitung"),
    ]
    for days_ago, user_id, project_id, hours, activity, comment in time_entries:
        started = base - timedelta(days=days_ago, hours=8)
        ended = started + timedelta(hours=hours)
        insert("time_entries", {
            "id": nid("tim"),
            "tenant_id": TENANT_ID,
            "user_id": user_id,
            "project_id": project_id,
            "activity_type": activity,
            "started_at": started,
            "ended_at": ended,
            "break_minutes": 30 if hours > 6 else 0,
            "duration_minutes": int(hours * 60),
            "billable": activity != "drive",
            "comment": comment,
        })

    # ---- 3) Maintenance contract + asset (Alpenhotel)
    print("  · creating maintenance contract + asset (Alpenhotel)")
    hotel_contact = fetch_one(
        f"SELECT id FROM contacts WHERE tenant_id = {lit(TENANT_ID)} AND customer_number = 'K-2026-003'"
    )
    asset_id = nid("ast")
    insert("assets", {
        "id": asset_id,
        "tenant_id": TENANT_ID,
        "contact_id": hotel_contact["id"],
        "asset_type": "heat_pump",
        "brand": "Viessmann",
        "model": "Vitocal 350-A 16kW",
        "serial_number": "VC350A-2024-887421",
        "installation_date": (datetime.now(timezone.utc).date() - timedelta(days=400)).isoformat(),
        "warranty_until": (datetime.now(timezone.utc).date() + timedelta(days=1825)).isoformat(),
        "location_description": "Hotel-Heizraum, UG hinten links",
        "power_kw": 16.0,
        "cop": 4.2,
        "refrigerant": "R290",
        "sound_level_db": 53.5,
        "custom_fields": {"seed": "extras", "fluid_l": 12, "buffer_size_l": 1500},
    })
    contract_id = nid("mnt")
    next_due = datetime.now(timezone.utc).date() + timedelta(days=120)
    insert("maintenance_contracts", {
        "id": contract_id,
        "tenant_id": TENANT_ID,
        "contact_id": hotel_contact["id"],
        "asset_id": asset_id,
        "name": "Wartungsvertrag Vitocal 350-A 16kW (jährlich)",
        "interval_months": 12,
        "next_due_date": next_due.isoformat(),
        "price": 320.0,
        "start_date": (datetime.now(timezone.utc).date() - timedelta(days=400)).isoformat(),
        "auto_renewal": True,
    })
    # Past visit + upcoming visit
    insert("maintenance_visits", {
        "id": nid("mvi"),
        "tenant_id": TENANT_ID,
        "contract_id": contract_id,
        "scheduled_at": datetime.now(timezone.utc) - timedelta(days=370),
        "completed_at": datetime.now(timezone.utc) - timedelta(days=370, hours=-2),
        "technician_user_id": user_tech["id"],
        "protocol": {"checks": ["Kältekreislauf OK","Verdampfer gereinigt","Sole 32% – OK","Sicherheitsventile OK"], "signature": True},
        "issues_found": None,
        "follow_up_required": False,
    })
    insert("maintenance_visits", {
        "id": nid("mvi"),
        "tenant_id": TENANT_ID,
        "contract_id": contract_id,
        "scheduled_at": datetime.now(timezone.utc) + timedelta(days=120),
        "completed_at": None,
        "technician_user_id": user_tech["id"],
        "protocol": {},
        "issues_found": None,
        "follow_up_required": False,
    })

    # ---- 4) Funding application for Steiner project
    if funding_at:
        print(f"  · creating funding application ({funding_at['name']})")
        insert("funding_applications", {
            "id": nid("fun"),
            "tenant_id": TENANT_ID,
            "project_id": project_steiner["id"],
            "program_id": funding_at["id"],
            "status": "submitted",
            "submitted_at": datetime.now(timezone.utc) - timedelta(days=14),
            "amount_requested": 7500.0,
            "notes": "Antrag eingereicht, Wartezeit ca. 6–8 Wochen.",
            "document_ids": [],
        })

    # ---- 5) Counts
    counts = run_sql(
        "SELECT "
        "(SELECT COUNT(*) FROM documents WHERE tenant_id = " + lit(TENANT_ID) + ") AS documents,"
        "(SELECT COUNT(*) FROM document_positions WHERE tenant_id = " + lit(TENANT_ID) + ") AS positions,"
        "(SELECT COUNT(*) FROM time_entries WHERE tenant_id = " + lit(TENANT_ID) + ") AS time_entries,"
        "(SELECT COUNT(*) FROM assets WHERE tenant_id = " + lit(TENANT_ID) + ") AS assets,"
        "(SELECT COUNT(*) FROM maintenance_contracts WHERE tenant_id = " + lit(TENANT_ID) + ") AS maintenance_contracts,"
        "(SELECT COUNT(*) FROM maintenance_visits WHERE tenant_id = " + lit(TENANT_ID) + ") AS maintenance_visits,"
        "(SELECT COUNT(*) FROM funding_applications WHERE tenant_id = " + lit(TENANT_ID) + ") AS funding_applications"
    )
    print("\nDone — extras seeded:")
    for k, v in counts[0].items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
