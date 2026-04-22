# ADR-0002 — ULIDs als Primary Keys, Soft-Delete überall

- **Status:** Akzeptiert
- **Datum:** 2026-04-22

## Kontext
CLAUDE.md Teil H: "IDs sind **ULIDs** (nicht Auto-Increments)". Teil J.2: "Jede Tabelle hat `id`, `tenant_id`, `created_at`, `updated_at`, `deleted_at`".

## Entscheidung

- **Primary Keys:** ULID als `TEXT NOT NULL PRIMARY KEY`, generiert clientseitig mit `ulid` npm-Package. Kein `uuid_generate_v4()` in Postgres, damit Client und Server dieselbe ID vor Insert kennen (wichtig für optimistic UI updates).
- **Soft-Delete:** Jede tenant-scoped Tabelle hat `deleted_at TIMESTAMPTZ`. Queries filtern default `IS NULL`. Hard-Delete erfolgt erst per Cleanup-Job nach 30 Tagen (DSGVO Teil P.1 "Recht auf Vergessen").
- **Timestamps:** `created_at` und `updated_at` mit `DEFAULT now()`. `updated_at` via Drizzle `$onUpdate`.
- **Tenant-Scoping:** `tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE` auf jeder tenant-scoped Tabelle, Index auf `tenant_id` überall.

## Rationale
- ULIDs sind lexikografisch sortierbar → `ORDER BY id` gibt chronologische Reihenfolge ohne separate `created_at`-Indizes.
- 26 Zeichen, URL-safe, keine Dashes → saubere URLs.
- Kein Collision-Risiko wie bei Auto-Increments beim Merge von Test/Dev-Datensätzen.
