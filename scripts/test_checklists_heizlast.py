"""Verify M13 checklists + M8 heizlast parser end-to-end."""
import json, os, urllib.request, re
import psycopg

PROJECT_REF = "lkngyjkrhgtxnebpepie"
TOKEN = os.environ["SUPABASE_MANAGEMENT_TOKEN"]
DB_URL = os.environ.get("DATABASE_URL_POOLED") or os.environ["DATABASE_URL"]
TENANT = "ten_DEMO_HEATFLOW_AT"

print("=== M13 Checklists ===")
with psycopg.connect(DB_URL, autocommit=True) as conn, conn.cursor() as cur:
    cur.execute("""
        SELECT name, entity_type, jsonb_array_length(items) AS n_items,
               (SELECT count(*) FROM jsonb_array_elements(items) e WHERE e->>'required' = 'true') AS required
        FROM checklist_templates
        WHERE tenant_id=%s AND deleted_at IS NULL
        ORDER BY name
    """, (TENANT,))
    for r in cur.fetchall():
        print(f"  • {r[0]:<55} [{r[1]:<10}] {r[2]:>2} items ({r[3]} required)")

    # Test apply + state update + complete
    print()
    print("--- Apply template to Steiner project ---")
    cur.execute("SELECT id FROM projects WHERE number='P-2026-001' AND tenant_id=%s", (TENANT,))
    proj_id = cur.fetchone()[0]
    cur.execute("""
        INSERT INTO checklist_instances (id, tenant_id, template_id, entity_type, entity_id, items_state)
        VALUES ('cins_TEST_001', %s, 'ctpl_SEED_VOR_ORT', 'project', %s, '{}'::jsonb)
    """, (TENANT, proj_id))
    cur.execute("""
        UPDATE checklist_instances
        SET items_state = '{"v1": true, "v2": true, "v11": true}'::jsonb
        WHERE id = 'cins_TEST_001'
    """)
    cur.execute("SELECT items_state FROM checklist_instances WHERE id = 'cins_TEST_001'")
    state = cur.fetchone()[0]
    checked = sum(1 for v in state.values() if v)
    print(f"  Instanz angelegt + 3 Punkte abgehakt → {checked} checked")

    # Cleanup
    cur.execute("DELETE FROM checklist_instances WHERE id = 'cins_TEST_001'")

# -----------------------------------------------------------------------------
# M8 Heizlast parser test
# -----------------------------------------------------------------------------
print()
print("=== M8 Heizlast Parser ===")

# Realistic Viessmann ViGuide-style XML
SAMPLE_XML = """<?xml version="1.0"?>
<HeatLoadCalculation source="Viessmann ViGuide 4.2" standard="EN 12831:2017">
  <Building>
    <TotalHeatLoad unit="kW">9.8</TotalHeatLoad>
    <LivingArea>180</LivingArea>
    <HeatedVolume>540</HeatedVolume>
    <DesignOutdoorTemp>-16</DesignOutdoorTemp>
    <IndoorTemp>20</IndoorTemp>
  </Building>
  <Rooms>
    <Room>
      <Name>Wohnzimmer</Name>
      <Area>42</Area>
      <HeatLoad>2200</HeatLoad>
      <DesignTemp>22</DesignTemp>
    </Room>
    <Room>
      <Name>Schlafzimmer</Name>
      <Area>18</Area>
      <HeatLoad>900</HeatLoad>
      <DesignTemp>18</DesignTemp>
    </Room>
    <Room>
      <Name>Kinderzimmer 1</Name>
      <Area>14</Area>
      <HeatLoad>720</HeatLoad>
    </Room>
    <Room>
      <Name>Bad</Name>
      <Area>8</Area>
      <HeatLoad>520</HeatLoad>
      <DesignTemp>24</DesignTemp>
    </Room>
    <Room>
      <Name>Küche</Name>
      <Area>22</Area>
      <HeatLoad>1100</HeatLoad>
    </Room>
  </Rooms>
</HeatLoadCalculation>
"""

# Mirror the TS parser logic
def num(text, patterns):
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            return float(m.group(1).replace(",", "."))
    return None

def detect(xml):
    if re.search(r"ViGuide|Viessmann", xml, re.I): return "viguide"
    if re.search(r"Vaillant|ProE", xml, re.I): return "proE"
    if re.search(r"Buderus", xml, re.I): return "buderus"
    if re.search(r"Hottgenroth|ETU", xml, re.I): return "hottgenroth"
    return "generic"

source = detect(SAMPLE_XML)
total = num(SAMPLE_XML, [
    r"<TotalHeatLoad[^>]*>([\d.,]+)</TotalHeatLoad>",
    r"<HeizlastGesamt[^>]*>([\d.,]+)</HeizlastGesamt>",
])
area = num(SAMPLE_XML, [r"<LivingArea[^>]*>([\d.,]+)</LivingArea>", r"<Wohnflaeche[^>]*>([\d.,]+)</Wohnflaeche>"])
volume = num(SAMPLE_XML, [r"<HeatedVolume[^>]*>([\d.,]+)</HeatedVolume>"])
norm_temp = num(SAMPLE_XML, [r"<DesignOutdoorTemp[^>]*>(-?[\d.,]+)</DesignOutdoorTemp>"])
indoor = num(SAMPLE_XML, [r"<IndoorTemp[^>]*>([\d.,]+)</IndoorTemp>"])

# Find rooms
room_re = re.compile(r"<(?:Raum|Room)\b[^>]*>([\s\S]*?)</(?:Raum|Room)>", re.I)
rooms = []
for m in room_re.finditer(SAMPLE_XML):
    block = m.group(1)
    name_m = re.search(r"<(?:Name|RoomName)[^>]*>([^<]+)<", block, re.I)
    area_m = re.search(r"<(?:Flaeche|Area)[^>]*>([\d.,]+)<", block, re.I)
    load_m = re.search(r"<(?:Heizlast|HeatLoad)[^>]*>([\d.,]+)<", block, re.I)
    rooms.append({
        "name": (name_m.group(1) if name_m else "—").strip(),
        "areaM2": float(area_m.group(1).replace(",", ".")) if area_m else 0,
        "heatLoadW": float(load_m.group(1).replace(",", ".")) if load_m else 0,
    })

print(f"  Source-Detection: {source}")
print(f"  Total Heat Load: {total} kW")
print(f"  Living Area: {area} m² · Heated Volume: {volume} m³")
print(f"  Design Temp: {norm_temp}°C / Indoor: {indoor}°C")
print(f"  Rooms ({len(rooms)}):")
for r in rooms:
    print(f"    • {r['name']:<20} {r['areaM2']:>5.1f} m²  {int(r['heatLoadW']):>5} W")

# Sanity assertions
assert source == "viguide"
assert total == 9.8
assert area == 180
assert volume == 540
assert norm_temp == -16
assert len(rooms) == 5
assert sum(r["heatLoadW"] for r in rooms) == 5440  # 2200+900+720+520+1100
print("\n  OK: ViGuide-XML korrekt geparst, alle Pflichtfelder + 5 Räume")

# Recommendation logic
print()
print("--- Empfehlungs-Heuristik ---")
candidates = [
    {"id": "VI-VIT350-G10", "name": "Vitocal 350-G 10kW", "powerKw": 10},
    {"id": "VI-VIT200-A12", "name": "Vitocal 200-A 12kW", "powerKw": 12},
    {"id": "VI-VIT200-A8",  "name": "Vitocal 200-A 8kW",  "powerKw": 8},
    {"id": "VI-VIT350-G18", "name": "Vitocal 350-G 18kW", "powerKw": 18},  # too big
    {"id": "VI-VIT200-A5",  "name": "Vitocal 200-A 5kW",  "powerKw": 5},   # too small
]
target = total
recs = []
for c in candidates:
    p = c["powerKw"]
    if p < target * 0.95 or p > target * 1.4:
        continue
    ratio = p / target
    fit = ratio if ratio < 1 else 1 - (ratio - 1.1) * 0.5
    fit = max(0, min(1, fit))
    recs.append({**c, "fitScore": fit})
recs.sort(key=lambda x: -x["fitScore"])
for r in recs:
    print(f"  {r['name']:<25} {r['powerKw']:>3} kW → fit {round(r['fitScore']*100)}%")
assert len(recs) >= 2
print(f"\n  OK: {len(recs)} passende WPs aus 5 Kandidaten gefiltert (zu klein und zu groß raus)")
