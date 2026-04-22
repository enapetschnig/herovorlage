"""Seed default checklist templates for the demo tenant."""
import json, os, secrets, time, urllib.request

PROJECT_REF = "lkngyjkrhgtxnebpepie"
TOKEN = os.environ["SUPABASE_MANAGEMENT_TOKEN"]
TENANT = "ten_DEMO_HEATFLOW_AT"

_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
def ulid():
    ts = int(time.time() * 1000)
    out = ""
    for _ in range(10): out = _ALPHABET[ts & 0x1F] + out; ts >>= 5
    return out + "".join(secrets.choice(_ALPHABET) for _ in range(16))


def sql(q):
    body = json.dumps({"query": q}).encode("utf-8")
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query",
        data=body,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json", "User-Agent": "heatflow-seed/0.1"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode()


def lit(v):
    if v is None: return "NULL"
    if isinstance(v, (int, float)): return str(v)
    if isinstance(v, bool): return "true" if v else "false"
    if isinstance(v, (list, dict)):
        return "'" + json.dumps(v, ensure_ascii=False).replace("'", "''") + "'::jsonb"
    return "'" + str(v).replace("'", "''") + "'"


print("Seeding M13 checklist templates ...")

# Cleanup prior seed
sql(f"DELETE FROM checklist_templates WHERE tenant_id = {lit(TENANT)} AND id LIKE 'ctpl_SEED_%'")

templates = [
    {
        "id": "ctpl_SEED_VOR_ORT",
        "name": "Vor-Ort-Termin Wärmepumpe",
        "entityType": "project",
        "items": [
            {"id": "v1", "label": "Heizungsraum besichtigt", "required": True, "group": "Bestand"},
            {"id": "v2", "label": "Bestandsanlage fotografiert", "required": True, "group": "Bestand"},
            {"id": "v3", "label": "Vorlauf-/Rücklauftemperaturen geprüft", "group": "Bestand"},
            {"id": "v4", "label": "Heizflächen erfasst (Heizkörper / FBH)", "group": "Bestand"},
            {"id": "v5", "label": "Strom-Anschluss-Querschnitt geprüft", "group": "Elektrik"},
            {"id": "v6", "label": "Zähler-Foto gemacht", "group": "Elektrik"},
            {"id": "v7", "label": "Standort Außeneinheit besprochen", "group": "Außeneinheit"},
            {"id": "v8", "label": "Schallschutz-Abstand geprüft (NÖ-BauO)", "required": True, "group": "Außeneinheit"},
            {"id": "v9", "label": "Nachbar-Situation besprochen", "group": "Außeneinheit"},
            {"id": "v10", "label": "Förderungs-Vorprüfung mit Kunde", "group": "Förderung"},
            {"id": "v11", "label": "Termin für Angebot vereinbart", "required": True, "group": "Abschluss"},
        ],
    },
    {
        "id": "ctpl_SEED_ABNAHME",
        "name": "Abnahme-Protokoll Wärmepumpen-Installation",
        "entityType": "project",
        "items": [
            {"id": "a1", "label": "Inbetriebnahme erfolgreich (Heizbetrieb stabil)", "required": True, "group": "Funktion"},
            {"id": "a2", "label": "Heizkurve eingestellt", "required": True, "group": "Funktion"},
            {"id": "a3", "label": "Warmwasserbereitung getestet", "required": True, "group": "Funktion"},
            {"id": "a4", "label": "Druckprüfung Heizkreis OK", "required": True, "group": "Hydraulik"},
            {"id": "a5", "label": "Sole-Dichtigkeit geprüft (bei Sole/Wasser-WP)", "group": "Hydraulik"},
            {"id": "a6", "label": "Pufferspeicher gefüllt + entlüftet", "group": "Hydraulik"},
            {"id": "a7", "label": "Sicherheitsventile geprüft", "required": True, "group": "Hydraulik"},
            {"id": "a8", "label": "Außeneinheit verankert + nivelliert", "group": "Außeneinheit"},
            {"id": "a9", "label": "Schwingungsdämpfer montiert", "group": "Außeneinheit"},
            {"id": "a10", "label": "Verkabelung nach ÖVE/E-8001-1", "required": True, "group": "Elektrik"},
            {"id": "a11", "label": "FI-Schalter funktioniert", "required": True, "group": "Elektrik"},
            {"id": "a12", "label": "Kunde eingeschult (Bedienung App + Display)", "required": True, "group": "Übergabe"},
            {"id": "a13", "label": "Konformitätserklärung übergeben", "required": True, "group": "Übergabe"},
            {"id": "a14", "label": "Garantieschein + Wartungsvertrag besprochen", "group": "Übergabe"},
            {"id": "a15", "label": "Unterschrift Kunde eingeholt", "required": True, "group": "Übergabe"},
        ],
    },
    {
        "id": "ctpl_SEED_SICHERHEIT",
        "name": "Baustellen-Sicherheits-Check",
        "entityType": "project",
        "items": [
            {"id": "s1", "label": "PSA aller Mitarbeiter vorhanden (Helm, Schuhe, Brille)", "required": True},
            {"id": "s2", "label": "Erste-Hilfe-Kasten vor Ort"},
            {"id": "s3", "label": "Stromabschaltung mit Kunde geklärt", "required": True},
            {"id": "s4", "label": "Absturzsicherung bei Arbeit über 2m"},
            {"id": "s5", "label": "Brandschutz-Decken bei Lötarbeiten in der Nähe"},
            {"id": "s6", "label": "Kältemittel-Handling — F-Gase-Schein vorhanden", "required": True, "group": "Kältetechnik"},
            {"id": "s7", "label": "Werkzeug-Funktion geprüft (Schweißgerät, Bohrer, …)"},
        ],
    },
]

for t in templates:
    sql(f"""INSERT INTO checklist_templates (id, tenant_id, name, entity_type, items)
            VALUES ({lit(t['id'])}, {lit(TENANT)}, {lit(t['name'])}, {lit(t['entityType'])}, {lit(t['items'])})""")

print(f"Done — {len(templates)} templates seeded:")
for t in templates:
    n = len(t["items"])
    req = sum(1 for i in t["items"] if i.get("required"))
    print(f"  • {t['name']} — {n} items ({req} required)")
