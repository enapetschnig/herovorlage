"""Adds a demo warehouse with stock + movements so M6 UI shows real data."""
import json, os, secrets, time, urllib.request

PROJECT_REF = "lkngyjkrhgtxnebpepie"
TOKEN = os.environ["SUPABASE_MANAGEMENT_TOKEN"]
TENANT = "ten_DEMO_HEATFLOW_AT"

_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
def ulid():
    ts = int(time.time() * 1000)
    ts_part = ""
    for _ in range(10):
        ts_part = _ALPHABET[ts & 0x1F] + ts_part
        ts >>= 5
    return ts_part + "".join(secrets.choice(_ALPHABET) for _ in range(16))


def sql(query):
    body = json.dumps({"query": query}).encode("utf-8")
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query",
        data=body,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json", "User-Agent": "heatflow-seed/0.1"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        text = resp.read().decode()
        return json.loads(text) if text else []


def lit(v):
    if v is None: return "NULL"
    if isinstance(v, (int, float)): return str(v)
    if isinstance(v, bool): return "true" if v else "false"
    return "'" + str(v).replace("'", "''") + "'"


print("Seeding M6 warehouse demo data ...")

# Cleanup any prior seed
sql(f"DELETE FROM stock_movements WHERE tenant_id = {lit(TENANT)} AND reference_doc LIKE 'SEED-%'")
sql(f"DELETE FROM stock_items WHERE tenant_id = {lit(TENANT)} AND id LIKE 'si_SEED_%'")
sql(f"DELETE FROM warehouses WHERE tenant_id = {lit(TENANT)} AND id LIKE 'wh_SEED_%'")

# Two warehouses
WH1 = "wh_SEED_KLAGENFURT"
WH2 = "wh_SEED_VAN1"
sql(f"""INSERT INTO warehouses (id, tenant_id, name, address)
        VALUES ({lit(WH1)}, {lit(TENANT)}, 'Werkstatt Klagenfurt', 'Energieweg 12, 9020 Klagenfurt'),
               ({lit(WH2)}, {lit(TENANT)}, 'Servicewagen Thomas', 'mobil — VW Crafter')""")

# Pull article IDs
arts = sql(f"SELECT id, number FROM articles WHERE tenant_id = {lit(TENANT)} ORDER BY number")
art_by_num = {r["number"]: r["id"] for r in arts}

# Seed stock items
plan = [
    # warehouse, article-number, qty, min_stock, location
    (WH1, "VI-VIT350-G10",   2,  1, "A-1-1"),
    (WH1, "VI-VIT200-A12",   1,  1, "A-1-2"),
    (WH1, "VI-PUF-800",      3,  2, "A-2-1"),
    (WH1, "VI-DHW-300",      4,  2, "A-2-2"),
    (WH1, "FT-AUSDEHN-50",   12, 5, "B-1"),
    (WH1, "FT-PUMPE-25-6",   3,  4, "B-2"),  # under min
    (WH1, "FT-MISCHER-3W-25",6,  3, "B-3"),
    (WH1, "WERKSTOFF-SOLE",  8,  10,"C-1"),  # under min
    (WH2, "FT-AUSDEHN-50",   2,  None, None),
    (WH2, "FT-PUMPE-25-6",   1,  None, None),
]

for wh, num, qty, min_s, loc in plan:
    art_id = art_by_num.get(num)
    if not art_id: continue
    si_id = "si_SEED_" + ulid()[-12:]
    sql(f"""INSERT INTO stock_items (id, tenant_id, warehouse_id, article_id, quantity, reserved, min_stock, location_code)
            VALUES ({lit(si_id)}, {lit(TENANT)}, {lit(wh)}, {lit(art_id)}, {qty}, 0, {lit(min_s)}, {lit(loc)})""")
    # Add an "in" movement as audit
    sm_id = "sm_SEED_" + ulid()[-12:]
    sql(f"""INSERT INTO stock_movements (id, tenant_id, stock_item_id, kind, quantity, reference_doc, note)
            VALUES ({lit(sm_id)}, {lit(TENANT)}, {lit(si_id)}, 'in', {qty}, 'SEED-Initialer Bestand', 'Erfasst beim Stichtag-Inventur')""")

print(f"Done — {len(plan)} stock items in 2 warehouses, with initial 'in' movements.")
print("Two items below min stock (FT-PUMPE-25-6 @ Werkstatt = 3<4, WERKSTOFF-SOLE @ Werkstatt = 8<10)")
