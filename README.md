# HeatFlow

> Next-Generation Handwerkersoftware für Wärmepumpen-Installationsbetriebe.
> Modular, mobile-first, KI-nativ — und wunderschön designt.

## 📖 Dokumentation

Das vollständige Projekt-Brief, Architektur-Dokument und die Feature-Spezifikation findest du in **[CLAUDE.md](./CLAUDE.md)**.

Diese Datei ist gleichzeitig der **Master-Prompt** für Claude Code / Cursor / Cline. Wenn du das Projekt in VS Code mit einem KI-Coding-Agenten öffnest, wird `CLAUDE.md` automatisch als Kontext geladen.

Wesentliche Architektur-Entscheidungen liegen unter [`docs/decisions/`](./docs/decisions/):
- **[ADR-0001](./docs/decisions/ADR-0001-supabase-as-backend.md)** — Supabase als Postgres- und Storage-Provider (statt selbst-gehostet)
- **[ADR-0002](./docs/decisions/ADR-0002-ids-and-soft-delete.md)** — ULIDs als IDs + Soft-Delete überall

Status-Notizen pro Iteration: [`docs/status/`](./docs/status/).

---

## ⚡ Quickstart

### Voraussetzungen

- **Node.js** ≥ 22.11.0 (`nvm install 22` oder von [nodejs.org](https://nodejs.org/))
- **pnpm** ≥ 9.12.0 (`corepack enable && corepack prepare pnpm@9.12.0 --activate`)
- **Python 3.11+** für die Bootstrap-Scripts (Schema/Seed)
- Optional: Docker (nur falls du Mailpit/Meilisearch lokal willst — Postgres läuft bei Supabase)

### Backend-Setup (Supabase — bereits provisioniert)

Das Schema, Storage-Buckets und Demo-Daten sind **bereits in Supabase vorhanden**, projektref `lkngyjkrhgtxnebpepie` (Region eu-west-1, Postgres 17).

Bestand:
- 49 Tabellen + Storage-RLS
- 4 Storage-Buckets (`contact-files`, `project-files`, `documents` privat; `avatars` public)
- Demo-Tenant „epower GmbH" mit 4 Usern, 6 Kontakten, 4 Projekten, 8 Artikeln, 4 Services, 5 Tasks, 4+ Logbuch-Einträgen, **1 Sample-Angebot mit 10 Positionen**, **7 Zeiteinträgen**, Wartungsvertrag + Anlage (Alpenhotel-Wärmepumpe), eingereichter Förderantrag.

Wenn du Schema oder Daten neu aufsetzen willst:

```bash
pip install argon2-cffi psycopg[binary]   # einmalig

# Env-Vars setzen (kein Hardcoded-Token im Repo, nur in .env.local)
export SUPABASE_MANAGEMENT_TOKEN=sbp_xxx
export DATABASE_URL_POOLED=postgresql://postgres.xxx:PWD@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require

# Schema (idempotent) — nutzt Supabase Management API
python scripts/apply_sql.py packages/db/drizzle/0000_init.sql
python scripts/apply_sql.py packages/db/drizzle/0001_storage_rls.sql
python scripts/apply_sql.py packages/db/drizzle/0002_billing.sql

# Demo-Daten — alle idempotent, Reihenfolge wichtig
python scripts/seed_demo.py             # Tenant + Users + 6 Kontakte + 4 Projekte
python scripts/seed_extras.py           # Sample-Angebot + Wartung + Förderung
python scripts/seed_warehouse.py        # 2 Lager + 10 Stock-Items
python scripts/seed_checklists.py       # 3 Checklist-Templates
python scripts/seed_more.py             # +6 Kontakte, +7 Projekte, +11 Dokumente
```

Nach allen Seeds: 12 Kontakte · 11 Projekte · 11 Dokumente (82 Positionen) · 23 Logbuch-Einträge · 3 Wartungsverträge · 5 Anlagen.

Die Scripts brauchen kein DB-Passwort (gehen via `SUPABASE_MANAGEMENT_TOKEN`).
Der Next.js-Server nutzt das `DATABASE_URL_POOLED` (Transaction-Pooler, Port 6543) für alle Drizzle-Queries.

### App-Setup

```bash
# 1. Dependencies installieren
pnpm install

# 2. .env.local ist schon vollständig befüllt (Supabase + DB-Passwort
#    inklusive). Direkt loslegen.

# 3. Dev-Server starten
pnpm dev
```

Öffne **http://localhost:3000** — Demo-Login: `admin@demo.heatflow.local` / `demo1234`.

Weitere Demo-User: `office@…`, `thomas@…`, `andreas@…` (alle mit Passwort `demo1234`).

### Verifikation

Health-Endpunkt: `http://localhost:3000/api/health` zeigt Postgres-Latenz und Tenant-Count.

| Service | URL |
|---|---|
| App | http://localhost:3000 |
| Login | http://localhost:3000/login |
| Dashboard | http://localhost:3000/dashboard |
| Health | http://localhost:3000/api/health |
| Supabase Studio | https://supabase.com/dashboard/project/lkngyjkrhgtxnebpepie |

---

## 🏗️ Struktur (Monorepo)

```
heatflow/
├── apps/
│   └── web/                  Next.js 15 (Backoffice + Kundenportal später)
├── packages/
│   ├── db/                   Drizzle Schema + Init-SQL + Seed
│   │   ├── drizzle/          0000_init.sql (komplettes Schema, 49 Tabellen)
│   │   └── src/schema/       Drizzle TS-Definitionen
│   ├── api/                  tRPC Router (tenant, contacts, projects, tasks, …)
│   ├── auth/                 Auth.js v5 + argon2id Credentials
│   ├── ui/                   Tailwind v4 + HeatFlow-Komponenten (Button, DataTable, …)
│   ├── schemas/              Zod-Schemas (shared client/server)
│   ├── ai/                   FlowAI: Claude-API-Bindings für M12
│   │   ├── prompts/          Markdown-Spezifikationen (zur Referenz)
│   │   └── src/              TS-Implementierungen + inlined Prompts
│   └── utils/                IDs (ULID), Money, Dates, Storage, Constants
├── scripts/
│   ├── apply_sql.py          Wendet SQL-Files in Supabase via Management API an
│   ├── seed_demo.py          Seed Demo-Tenant „epower GmbH" (Basis)
│   └── seed_extras.py        Sample-Angebot, Zeiteinträge, Wartung, Förderantrag
├── docs/
│   ├── decisions/            ADRs
│   └── status/               Iterations-Notizen
├── .env.local                Supabase-Credentials (gitignored)
└── docker-compose.yml        Optionale lokale Dienste (Meilisearch, Mailpit, …)
```

---

## 🧰 Nützliche Skripte

```bash
pnpm dev                                  # Next.js Dev-Server (Turbopack)
pnpm build                                # Build aller Apps + Packages
pnpm typecheck                            # TypeScript-Check
pnpm db:apply-via-mgmt                    # Schema via Management API anwenden
pnpm db:seed                              # Seed via Drizzle (DB-Passwort nötig)
pnpm db:studio                            # Drizzle Studio (DB-Passwort nötig)

# Schneller Workaround ohne DB-Passwort:
python scripts/apply_sql.py packages/db/drizzle/0000_init.sql
python scripts/seed_demo.py
```

### 🤖 FlowAI (Modul M12) mit oder ohne API-Key

Die 3 FlowAI-UI-Features (`/flowai/photo-to-offer`, `/flowai/mail-to-project`, `/flowai/ocr-receipt`) laufen **out of the box im Demo-Modus** und liefern realistische Mock-Daten, damit der End-to-End-Flow ohne Anthropic-Kosten demoable ist.

Für echte KI-Responses: `ANTHROPIC_API_KEY=sk-ant-...` in `.env.local` setzen und Dev-Server neu starten. Der Router erkennt den Key automatisch und schaltet auf Live — sichtbar am „🟢 Live mit claude-sonnet-4-6"-Badge im `/flowai`-Hub.

---

## ✅ Was steht (Phase 0 + Teil von Phase 1)

- ✅ **Phase 0 — Setup**: Monorepo, Schema (49 Tabellen) live in Supabase, Demo-Tenant geseedet, Auth.js v5 mit argon2id, tRPC v11
- ✅ **CRM-Grundstein**: Kontakte (Liste, Detail, 5-Tab-Anlageformular), Projekte (Liste, Detail mit Tabs, Anlageformular), Aufgaben (Liste), Artikel (Liste)
- ✅ **Dashboard**: KPIs, Pipeline pro Status, eigene Aufgaben, Aktivitäts-Feed (Logbuch)
- ✅ **Logbuch-System**: System-Events (Kontakt/Projekt angelegt, Status geändert) + manuelle Notizen via API
- ✅ **Globale Suche** (Backend): tRPC-Router `search.global` über Kontakte, Projekte, Artikel, Dokumente — mit pg_trgm-GIN-Indexen für Fuzzy-Search
- ✅ **Module-Registry**: feature-flag-aware Procedures (`moduleProcedure(FEATURES.M3_MAINTENANCE)`)
- ✅ **FlowAI (Modul M12)**: 3 Features **live mit UI** — Foto→Angebot (Claude Vision), Mail→Projekt (1-Klick-Create), OCR-Beleg (SKR03/04-Vorschlag). Demo-Modus ohne API-Key out-of-the-box.
- ✅ **Wartung & Anlagen (Modul M3)**: komplette UI — Dashboard, Verträge, Anlagen-Tab auf Kontakt, automatisch rollende Wartungstermine, 8-Punkt-Checkliste
- ✅ **Dokumente (Phase 2)**: A4-PDF, XRechnung-XML (EN 16931), SMTP-Versand, Lock/Finalize, Clone-to-Invoice
- ✅ **Zeiterfassung**: 2-Kacheln-Tagesansicht, Quick-Timer mit Live-Running-Indicator, Projekt-Aggregat
- ✅ **CSV-Import** für Kontakte mit Auto-Column-Mapping (DE+EN Aliases)
- ✅ **Cmd+K Command-Palette** über alle Entitäten
- ✅ **File-Upload** zu Supabase Storage mit signed URLs

## 🚧 Was noch fehlt (siehe [CLAUDE.md Teil N](./CLAUDE.md))

- **Phase 1 fertig**: 5-Tab Kontakt vollständig (Adressen, Personen, Tags), CSV-Import, globales Cmd+K-Modal in der UI
- **Phase 2**: Dokumenten-Editor (Tiptap), PDF-Generierung, ZUGFeRD/XRechnung, E-Mail-Versand, Versionshistorie
- **Phase 3**: Zeiterfassung-Formular + Mobile-App (Capacitor)
- **Phase 4–6**: Module M1, M3, M4, M5, M7, M10, M12-UI, M13, M14
- **Phase 7**: Polish, Onboarding, Billing, Marketing-Site

Alle Module-Tabellen sind im Schema schon angelegt (Wartung, Förderung, Lager, Kanban, Checklisten…), nur die UI-Routen fehlen.

---

## 🔐 Credentials

`.env.local` enthält den **Supabase-Service-Role-Key** und den **Management-Token** im Klartext (für Bootstrap).
Vor Public Push: rotieren! ([Supabase Dashboard → Settings → API](https://supabase.com/dashboard/project/lkngyjkrhgtxnebpepie/settings/api)).

Für Production:
- Service-Role-Key nur im Server (nicht `NEXT_PUBLIC_…`)
- Management-Token komplett aus dem Repo entfernen — Migrations dann via `drizzle-kit push` mit dem DB-Passwort

---

## 📄 Lizenz

Proprietär. © 2026 epower GmbH. Alle Rechte vorbehalten.
