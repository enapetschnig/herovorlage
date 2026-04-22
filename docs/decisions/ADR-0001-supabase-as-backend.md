# ADR-0001 — Supabase als Postgres- und Storage-Provider

- **Status:** Akzeptiert
- **Datum:** 2026-04-22
- **Beteiligte:** Christoph Napetschnig (Owner), Claude (KI-Entwickler)

## Kontext

CLAUDE.md Teil F spezifiziert selbst-gehostetes Postgres 16 + Redis + Meilisearch + MinIO auf Hetzner Cloud. Für den Start hat der Owner explizit **Supabase** als Backend-Infrastruktur bereitgestellt
(`https://lkngyjkrhgtxnebpepie.supabase.co`, Region `eu-west-1`, Postgres 17.6, DSGVO-konform durch EU-Hosting).

## Entscheidung

Wir verwenden Supabase als **Backing-Store** für Dev und V1-Launch. Tech-Stack-Änderungen ggü. CLAUDE.md Teil F:

| CLAUDE.md (Original)              | Ersatz (diese ADR)                                         |
|-----------------------------------|------------------------------------------------------------|
| Postgres 16 selbstgehostet        | Supabase Postgres 17 (eu-west-1)                           |
| S3-kompatibel (Hetzner / MinIO)   | Supabase Storage (S3-kompatibel)                           |
| Hetzner Hosting für DB            | Supabase (Fly/AWS in EU)                                   |

**Unverändert** bleiben:
- **Drizzle ORM** als Query-Layer (Supabase Postgres ist Standard-Postgres, Drizzle spricht es nativ).
- **Auth.js v5** mit **Credentials-Provider** + Drizzle-Adapter. Wir nutzen *nicht* Supabase Auth, weil CLAUDE.md Teil F.5 Auth.js vorschreibt und wir Multi-Tenancy / Rollen feingranular in unserem eigenen Schema brauchen.
- **Row-Level-Security** per `tenant_id` — wir enforcen das in der Applikation über einen `db.scoped(tenantId)` Wrapper (Teil J.2). Supabase's RLS-Policies nutzen wir zusätzlich für die Storage-Buckets.
- **Redis / Meilisearch** bleiben lokal via Docker für Dev. In Prod später: Upstash Redis + Meilisearch Cloud (oder selbst-gehostet).

## Konsequenzen

### Positiv
- Kein eigenes DB-Ops. Backups, Point-in-Time-Recovery, Monitoring, TLS ab Tag 1.
- Edge-Funktionen & Storage out-of-the-box.
- Gleicher Postgres-Dialekt → wir können jederzeit zu selbst-gehostet migrieren (nur `DATABASE_URL` tauschen).

### Negativ / Risiken
- Vendor-Lock bei Storage-API (`@supabase/supabase-js`). Wir kapseln Zugriff in `packages/utils/storage.ts`, damit ein Wechsel zu S3 später lokal eingrenzbar ist.
- Kosten skalieren anders als ein Hetzner-Server. Ab ~10 zahlenden Tenants monitoren wir das; Migration zu Hetzner ist dann 1-Tag-Arbeit (DB-Dump + Connection-String-Wechsel).
- Connection-Pooler (pgbouncer) bei Supabase — wir nutzen den Transaction-Pooler auf Port 6543 für API-Requests und die Direct-Connection (Port 5432) nur für Migrations.

## Migration zurück zu Hetzner (wenn nötig)
1. Hetzner Postgres 16+ aufsetzen
2. `pg_dump` aus Supabase, `pg_restore` nach Hetzner
3. `DATABASE_URL` in Prod-Env umstellen
4. Storage: MinIO aufsetzen, Dateien per `rclone` migrieren, Storage-Client-Konfig tauschen

Aufwand: ~1 Personentag.
