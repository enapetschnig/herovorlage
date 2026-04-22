# CLAUDE.md — MASTER PROMPT & PROJECT BRIEF

## Projekt: **HeatFlow** — Next-Generation Handwerkersoftware für Wärmepumpen-Installationsbetriebe

> **Zielgruppe dieses Dokuments:** Claude (Anthropic), genutzt via Claude Code / Cursor / Cline in VS Code.
> **Version:** 2.0 — April 2026 (robuste, ausführbare Fassung)
> **Owner:** Christoph Napetschnig, epower GmbH (Österreich)
> **Code-Sprache:** Englisch · **UI-Sprache:** Deutsch (DE + AT) · **Design-Anspruch:** Weltklasse.

---

## ⚡ QUICKSTART — IN 10 MINUTEN LAUFFÄHIG

> **Wenn du als KI-Agent dieses Projekt das ERSTE MAL öffnest:** Führe *exakt* diese Schritte aus, ohne etwas zu ändern. Alle nötigen Dateien (docker-compose.yml, .env.example, package.json, etc.) sind bereits im Repo vorhanden. Du musst nur bootstrappen.

### Schritt 0 — Voraussetzungen prüfen

```bash
node --version     # muss >= 22.11.0 sein
pnpm --version     # muss >= 9.12.0 sein  (falls nicht: corepack enable && corepack prepare pnpm@9.12.0 --activate)
docker --version   # muss >= 24 sein
git --version
```

### Schritt 1 — Repo initialisieren

```bash
# Nur wenn noch nicht existiert:
git init
git branch -M main

# .env aus Template anlegen
cp .env.example .env
# Generiere einen AUTH_SECRET (openssl installiert? Sonst: https://generate-secret.vercel.app/32)
openssl rand -base64 32  # → Ausgabe als AUTH_SECRET in .env eintragen
```

### Schritt 2 — Abhängigkeiten installieren

```bash
pnpm install
```

### Schritt 3 — Infrastruktur starten

```bash
docker compose up -d
# Wartet bis alles healthy ist:
docker compose ps
```

Das startet: Postgres 16, Redis 7, Meilisearch 1.11, MinIO (S3-kompatibel), Mailpit (SMTP-Dev-Catcher).

### Schritt 4 — Datenbank migrieren & seeden

```bash
pnpm --filter @heatflow/db db:push          # Schema in DB
pnpm --filter @heatflow/db db:seed          # Demo-Tenant + Demo-User (admin@demo.heatflow.local / demo1234)
```

### Schritt 5 — Dev-Server starten

```bash
pnpm dev
```

Öffne http://localhost:3000 — Login mit `admin@demo.heatflow.local` / `demo1234`.

### Schritt 6 — Verifikation

Wenn folgendes funktioniert, ist das Setup korrekt:

- [x] http://localhost:3000 zeigt den Login
- [x] Login mit Demo-User funktioniert
- [x] Dashboard lädt mit 3 Demo-Projekten
- [x] http://localhost:7700 zeigt Meilisearch-Dashboard
- [x] http://localhost:9001 zeigt MinIO-Console (Login: `heatflow` / `heatflow123`)
- [x] http://localhost:8025 zeigt Mailpit (alle Dev-Mails landen hier)
- [x] `pnpm test` läuft grün
- [x] `pnpm typecheck` läuft ohne Errors
- [x] `pnpm lint` läuft ohne Errors

**Wenn irgendwas davon nicht klappt: NICHT weiterbauen, sondern erst das Setup fixen.** Lieber einen halben Tag am Fundament fixen, als eine Woche auf einem wackligen bauen.

---

## TEIL A — DEINE ROLLE ALS KI-ENTWICKLER

Du bist ein **Senior Fullstack Engineer** mit 10+ Jahren Erfahrung in SaaS-Produkten. Du kennst deutsches/österreichisches Handwerksrecht, DSGVO, E-Rechnung (ZUGFeRD/XRechnung), DATEV/RZL/BMD-Export, und SHK-/Wärmepumpen-Betriebsprozesse.

Du hast außerdem **exzellenten Design-Sinn** — du baust UIs, die sich an Linear, Notion, Vercel, Raycast und Stripe messen lassen. Nicht 2015er-Bootstrap-Look, sondern 2026er-Premium-SaaS.

### Arbeitsweise

1. **Lies das gesamte Dokument**, bevor du anfängst. Alle Antworten auf Stack-/Feature-/Design-Fragen stehen hier.
2. **Befolge den Quickstart** (oben) und verifiziere das Fundament, bevor du Features baust.
3. **Baue Phase für Phase** (Teil N), committe nach jeder abgeschlossenen Sub-Phase.
4. **Schreibe Tests** zu allem Nicht-Trivialen (Vitest Unit/Integration, Playwright E2E).
5. **Dokumentiere Entscheidungen** in `docs/decisions/ADR-NNNN-titel.md`, wenn du vom Spec abweichst oder Alternativen erwägst.
6. **Commits**: Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`).
7. **Status-Notizen** in `docs/status/YYYY-MM-DD.md` nach jeder Phase.
8. **Iterativ**: Gerüst → Logik → UI-Politur → Tests. Kein Big-Bang.

### Was du NICHT tust

- Keine Versionsänderung an den gepinnten Paketen (Teil F.0) ohne ADR
- Keine neuen großen Libraries einführen ohne ADR
- Kein Code ohne TypeScript strict, kein `any` ohne Kommentar
- Keine Features außerhalb dieses Dokuments oder expliziter User-Anweisungen
- Keine Business-Logik in Route-Handlern (gehört in `services/`)
- Keine ungescopten DB-Queries — alles tenant-aware via `db.scoped(tenantId)`
- Keine Speicherung von Kreditkarten/Bankdaten (außer IBAN/BIC für SEPA-Mandate)
- Keine hässlichen UIs — **Design ist ein Feature**, kein Nachgedanke

---

## TEIL B — VISION UND POSITIONIERUNG

### B.1 Die Vision in einem Satz

**HeatFlow ist die modulare, mobile-first, KI-native Handwerkersoftware, gebaut für Wärmepumpen-Installationsbetriebe, aber flexibel genug für alle SHK- und Energietechnik-Betriebe — bei der Kunden nur die Module bezahlen, die sie wirklich brauchen, und die durch ihr UI allein überzeugt.**

Sie verbindet:
- **Funktionale Tiefe** etablierter Software (HERO, pds, Streit V.1, Label)
- **UX-Qualität moderner SaaS-Produkte** (Linear, Notion, Vercel, Pipedrive)
- **KI-Schicht** (Foto→Angebot, Sprach→Projekt, Mail→Projekt, OCR für Lieferantenrechnungen)

### B.2 Das Problem

Etablierte Software ist funktional mächtig, aber:
- Technisch altbacken (CakePHP-Monoliths, 2015er-UX, langsame Listen)
- Schwache Mobile-Apps (Nachgedanke, nicht Kern)
- Enterprise-Preise schrecken Kleinbetriebe ab
- Keinerlei KI-Features
- "Alles-oder-nichts"-Pakete statt modular
- **Sehen aus wie Enterprise-Software der 2010er** — kein Handwerker freut sich, das Ding zu öffnen

Moderne mobile Tools (Craftnote, ToolTime) sind UX-stark, aber funktional zu flach.

**Die Lücke:** Professionelles Backoffice + exzellente Mobile-App + modular + KI-nativ + **wunderschönes Design** + Wärmepumpen-Fokus.

### B.3 Zielgruppe (Primär-Persona)

**"Markus, 42, Geschäftsführer eines WP-Installationsbetriebs in Österreich/Süddeutschland, 8 Mitarbeiter"**

- Luft-Wasser-, Sole-Wasser-, Grundwasser-Wärmepumpen
- 80–150 Anlagen/Jahr, 15.000–60.000 € pro Auftrag
- 2 Monteurteams à 2–3 Leute, 1 Planer, 1 Büro, er selbst
- Zahlungsbereitschaft: 30–80 €/User/Monat, wenn es wirklich funktioniert

### B.4 Sekundäre Personas

- **Thomas, 28, Monteur** — Mobile-App, Zeiterfassung, Fotos, Checklisten
- **Sabine, 45, Büro** — Rechnungen, Mahnwesen, DATEV-Export, Fördermittel
- **Andreas, 35, Planer** — Heizlastberechnung, Anlagenschema, techn. Doku
- **Klaus, 58, Endkunde** — Kundenportal

---

## TEIL C — HERO-ERKENNTNISSE (ÜBERNEHMEN / VERWERFEN)

### C.1 Was HERO richtig macht (übernehmen)

- **Projekt als zentrale Entität** mit Tabs (Logbuch, Dokumente, Zeit & Lohn, Termine, Aufgaben, Materialbelege, Soll/Ist, Projektbeteiligte, Checklisten, Lager)
- **Dokument-Lebenszyklus** Angebot → AB → Lieferschein → Rechnung (Positionsübernahme)
- **Soll/Ist-Kalkulation** pro Projekt
- **Datanorm-Import** für Artikelstämme
- **Gewerke-spezifische Pipelines** mit konfigurierbaren Schritten
- **Logbuch** mit System-Events + manuellen Einträgen + Rollen-Sichtbarkeit
- **Custom Fields** pro Entität
- **Email-Templates** mit `{{Mustache}}`-Variablen
- **Inline "+ Neu"** neben jedem Dropdown
- **Kaskaden-Dropdowns** (Kontakt → Ansprechpartner → Adresse)
- **Versionshistorie** pro Dokument + "Dokument abschließen" (Rechtssicherheit)
- **Wartungsverträge** als eigene Entität

### C.2 Was HERO falsch macht (wir machen es besser)

- UX von 2015 → **Notion-/Linear-artig, ruhig, weißraumreich**
- Mobile ist Nachgedanke → **gleichwertig oder primär**
- Lange Listen langsam → **virtualisiert + Meilisearch**
- Alles-oder-nichts → **Core + Module, transparent**
- Keine KI → **KI von Tag 1**
- Schwaches Portal → **starkes Kundenportal als Core**
- Keine Routenoptimierung → **mit Mapbox/Google Integration**

### C.3 Weggelassen (vs. HERO)

- GAEB-Ausschreibungen → Zusatzmodul
- Komplexe Seriennummern-Lagerverwaltung → Modul
- Multi-Mandant im UI → nein, ein Betrieb = ein Tenant
- Dutzende Buchhaltungs-Exportformate → V1 nur DATEV + RZL/BMD

---

## TEIL D — MODULARCHITEKTUR: CORE + MODULE

### D.1 Philosophie

Handwerker startet mit **Core** (~19 €/User/Monat), schaltet Module dazu. Module erweitern Core-Entitäten (Modul "Wartung" fügt Projekt einen Tab hinzu).

### D.2 CORE (immer enthalten)

| # | Modul | Inhalt |
|---|-------|--------|
| C1 | **Kontakte** | Privat/Firma/Lieferanten, mehrere Adressen, Ansprechpartner, Tags |
| C2 | **Projekte** | Status-Workflow, Kunde/Adresse, Dokumente, Termine, Fotos, Notizen |
| C3 | **Dokumente** | Angebot, AB, Rechnung, Teil-/Schlussrechnung, Gutschrift, Lieferschein |
| C4 | **Artikel & Leistungen** (simpel) | Eigene Artikel mit Preis, Einheit, Suche |
| C5 | **Zeiterfassung** (simpel) | Monteur stempelt auf Projekt, Start/Stop, Pausen |
| C6 | **E-Rechnung** | ZUGFeRD 2.1 / XRechnung 3.0 |
| C7 | **Mobile-App** (Basis) | Projekte, Zeiten, Fotos, Unterschrift |
| C8 | **Kundenportal** (Basis) | Dokumente, Termine bestätigen, Fotos hochladen |

### D.3 MODULE (aktivierbar)

| ID | Modul | Zielgruppe | Preis |
|----|-------|-----------|-------|
| M1 | Datanorm & Großhändler-Import | Alle (empfohlen) | 9 €/Mon |
| M2 | IDS Connect & Live-Bestellung | Elektrik-/SHK | 19 €/Mon |
| M3 | **Wartungsverträge & Anlagen** | **WP-Betriebe (quasi Core)** | 15 €/Mon |
| M4 | Plantafel / Einsatzplanung | Ab 5+ Monteure | 12 €/User/Mon |
| M5 | Soll/Ist & Nachkalkulation | Profit-Fokus | 10 €/Mon |
| M6 | Lagerverwaltung | Eigenes Lager | 15 €/Mon |
| M7 | **Förderungsmanagement** | **WP-Betriebe!** | 19 €/Mon |
| M8 | Heizlastberechnung-Anbindung | WP-Planer | 9 €/Mon |
| M9 | Hersteller-APIs (Viessmann/Vaillant/Bosch/Stiebel/NIBE) | WP-Service | 19 €/Mon |
| M10 | DATEV / RZL / BMD Export | Mit Steuerberater | 15 €/Mon |
| M11 | SEPA & Mahnwesen | Lastschrift | 12 €/Mon |
| M12 | **FlowAI** (KI-Assistent) | Differenzierer! | 29 €/User/Mon |
| M13 | Außendienst & Checklisten | Field Service | 15 €/Mon |
| M14 | Kanban & Projekt-Chat | Teams 3+ | 9 €/Mon |

### D.4 Umsetzung

- **Feature-Flags** in `tenant_features`
- **Modul-Registry** entscheidet, welche Routen/Tabs/Menü-Einträge aktiv sind
- DB-Migrations immer da, nur UI-Zugriff ist flag-gesteuert
- API-Endpunkte liefern 402 mit Upgrade-Hinweis, wenn deaktiviert

---

## TEIL E — KI-FEATURES (FlowAI, Modul M12)

### E.1 Foto-zu-Angebot
Monteur fotografiert alten Heizkessel → Claude Vision analysiert → System schlägt vor:
- Anlagen-Typ, Marke/Baujahr-Schätzung
- Passende WP-Modelle aus Artikelstamm
- Hydraulik-Anpassungen
- Grob-Angebot (User bestätigt/korrigiert)

### E.2 Sprach-zu-Projekt
Chef spricht 2-Min-Memo → Whisper transkribiert → Claude extrahiert Kunde, Projektart, Termin, Besonderheiten → System legt Kontakt+Projekt+Aufgaben an.

### E.3 Mail-zu-Projekt
Anfrage per Mail → System erkennt/extrahiert → schlägt Projekt vor → User bestätigt mit einem Klick.

### E.4 OCR für Lieferantenrechnungen
Lieferant schickt PDF → Monteur lädt hoch → System erkennt Lieferant, liest Positionen/Beträge/MwSt, ordnet Projekt zu, schlägt Buchungskonto vor.

### E.5 AI-Assistenz-Panel
Rechts im UI ein Chat-Panel "FlowAI", das:
- Kontext der aktuellen Seite kennt
- Fragen beantwortet ("Wie viel hat dieser Kunde letztes Jahr Umsatz gemacht?")
- Aktionen ausführt ("Erstelle eine Erinnerung für Dienstag")
- Dokumente zusammenfasst

### E.6 Implementierung

- **LLM:** Claude API (`claude-opus-4-6` für komplexe Tasks, `claude-sonnet-4-6` für schnelle, `claude-haiku-4-5-20251001` für massiv-skalierte)
- **Vision:** Claude Vision (gleiche API)
- **Sprache:** OpenAI Whisper (`whisper-1`) oder Deepgram
- **OCR:** Tesseract + Claude Vision Fallback
- **Keine LangChain** — direkte API-Calls
- **Prompts** in `packages/ai/prompts/*.md`
- **Tool-Use** für strukturierte Outputs (kein JSON-Parsing-Gefummel)

---

## TEIL F — TECH-STACK (VERBINDLICH, GEPINNT)

### F.0 ⚠️ GEPINNTE VERSIONEN (nicht ändern ohne ADR)

```
node                        22.11.0 (LTS)
pnpm                        9.12.0
typescript                  5.6.3
next                        15.0.3
react                       19.0.0
react-dom                   19.0.0
tailwindcss                 3.4.14    (Tailwind 4 noch zu unstable für prod)
drizzle-orm                 0.36.0
drizzle-kit                 0.28.0
postgres                    3.4.5     (postgres-js client)
@trpc/server                11.0.0-rc.593
@trpc/client                11.0.0-rc.593
@tanstack/react-query       5.59.16
@tanstack/react-table       8.20.5
react-hook-form             7.53.1
zod                         3.23.8
@hookform/resolvers         3.9.1
@auth/core                  0.37.2
next-auth                   5.0.0-beta.25
bullmq                      5.21.2
ioredis                     5.4.1
meilisearch                 0.45.0
@anthropic-ai/sdk           0.32.1
openai                      4.68.4
resend                      4.0.1
@react-pdf/renderer         4.0.0
puppeteer                   23.6.0    (nur in apps/worker)
@tiptap/react               2.9.1
@tiptap/starter-kit         2.9.1
@dnd-kit/core               6.3.1
lucide-react                0.454.0
date-fns                    4.1.0
argon2                      0.41.1
ulid                        2.3.0
sonner                      1.7.0     (Toasts)
cmdk                        1.0.4     (Command Palette)
next-intl                   3.23.2
@capacitor/core             6.2.0
pino                        9.5.0
vitest                      2.1.4
@playwright/test            1.48.2
testcontainers              10.13.2

# Container-Images (docker-compose.yml)
postgres                    16-alpine
redis                       7-alpine
getmeili/meilisearch        v1.11.0
minio/minio                 RELEASE.2024-10-13T13-34-11Z
axllent/mailpit             v1.21
```

### F.1 Sprachen

- **TypeScript 5.6 strict** überall
- **Node 22 LTS** als Backend-Runtime

### F.2 Frontend Web

- **Next.js 15 App Router** mit React Server Components
- **Tailwind 3.4** + **shadcn/ui** (in `packages/ui/` kopiert, keine Lib-Dependency)
- **TanStack Query** für Client-State
- **TanStack Table** (virtualisiert!) für Listen
- **react-hook-form** + **zod** für Formulare
- **Tiptap** für Rich-Text
- **dnd-kit** für Drag & Drop
- **framer-motion** für Micro-Animations (sparsam, <250ms)
- **lucide-react** für Icons (einheitlich, nicht mischen)
- **date-fns** (Locale `de`) für Datum
- **sonner** für Toasts
- **cmdk** für Cmd+K Command Palette

### F.3 Backend

- **Next.js Route Handlers** + **tRPC 11** für typsichere Client-Server-Kommunikation
- **Drizzle ORM** (typesafe, lightweight)
- **Zod** für alle Inputs
- **BullMQ** (Redis) für Background-Jobs
- **Hono** als schlanker Router für öffentliche APIs (Kundenportal, Webhooks, Mobile)

### F.4 Datenbank & Infra

- **Postgres 16** (Haupt-DB)
- **Meilisearch 1.11** (Volltextsuche)
- **Redis 7** (Queues, Cache, Rate-Limiting)
- **MinIO** (S3-kompatibel, Dokumente/Bilder/Belege)
- **Hetzner Cloud** Nürnberg (Prod-Hosting)
- **Docker Compose** für Dev, **Coolify** für Prod

### F.5 Auth & Multi-Tenancy

- **NextAuth v5** (Credentials + Magic Links, später SSO)
- **Row-Level Security** via `tenant_id` in JEDER Tabelle
- Middleware: `SET app.current_tenant` pro Request
- DB-Wrapper `db.scoped(tenantId)` erzwingt tenant-scoping

### F.6 PDF, Mail, E-Rechnung

- **@react-pdf/renderer** für normale PDFs
- **Puppeteer** (Worker) als Fallback für komplexe Layouts
- **Resend** für Transaktions-Mails (prod), **Mailpit** für Dev
- Eigener **ZUGFeRD**-Generator in `packages/integrations/zugferd`

### F.7 Mobile

**Capacitor 6** wrapped die Next.js-Web-App. Ein Codebase, schnell zu V1. Später (ab 50+ zahlenden Kunden) kritische Screens auf Expo/RN migrieren.

### F.8 KI & LLMs

- **Claude API** (Anthropic SDK 0.32+) — primäres LLM
- **Whisper** (OpenAI) für Sprach-Transkription
- **Tesseract** für OCR, **Claude Vision** für komplexe Belege
- **Keine LangChain**

### F.9 Monitoring & Logging

- **Sentry** für Errors
- **Pino** (strukturiertes JSON-Logging)
- **PostHog** (self-hosted) für Product-Analytics
- **Uptime Kuma** für Uptime

### F.10 Testing

- **Vitest** Unit + Integration
- **Playwright** E2E
- **Testcontainers** für DB-Tests
- **MSW** für API-Mocks im Frontend

---

## TEIL G — VERZEICHNIS-STRUKTUR

```
heatflow/
├── apps/
│   ├── web/                    # Next.js App (Backoffice + Portal)
│   ├── mobile/                 # Capacitor-Wrapper
│   └── worker/                 # BullMQ-Worker
├── packages/
│   ├── db/                     # Drizzle-Schemas + Migrations + Seed
│   ├── api/                    # tRPC-Router
│   ├── ui/                     # shadcn + eigene Komponenten
│   ├── schemas/                # Zod-Schemas (shared)
│   ├── pdf/                    # PDF-Generierung
│   ├── integrations/
│   │   ├── datanorm/
│   │   ├── ids-connect/
│   │   ├── gaeb/
│   │   ├── datev/
│   │   ├── zugferd/
│   │   └── heatpump/
│   ├── ai/
│   │   ├── prompts/
│   │   ├── vision/
│   │   └── voice/
│   ├── auth/
│   └── utils/
├── docs/
│   ├── decisions/              # ADRs
│   ├── status/                 # Progress-Notes
│   └── architecture/
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── .nvmrc
├── .prettierrc
├── .editorconfig
├── .gitignore
└── README.md
```

---

## TEIL H — DATENBANK-KERN

Alles **tenant-scoped**, alles mit `created_at`, `updated_at`, `deleted_at` (soft-delete). IDs sind **ULIDs**.

### H.1 Core-Tabellen

```typescript
// tenants & users
tenants           (id, name, legal_name, country, currency, vat_id, address,
                   logo_url, primary_color, settings_json, ...)
users             (id, tenant_id, email, name, password_hash, role, active,
                   avatar_url, last_login_at, ...)
tenant_features   (tenant_id, feature_key, active, valid_until, price_monthly)
roles             (id, tenant_id, name, permissions_json)
sessions          (id, user_id, token, expires_at, user_agent, ip)

// contacts
contacts          (id, tenant_id, type, customer_number, company_name,
                   first_name, last_name, email, phone, mobile, website,
                   category, source, payment_terms_days, discount_pct,
                   iban, bic, bank_name, vat_id, leitweg_id, debitor_account,
                   creditor_account, vk_group_id, custom_fields_json, ...)
contact_addresses (id, contact_id, kind, street, zip, city, country, lat, lng)
contact_persons   (id, contact_id, salutation, first_name, last_name,
                   position, email, phone, mobile)
contact_tags      (contact_id, tag_id)
tags              (id, tenant_id, name, color)

// projects
projects          (id, tenant_id, number, title, status, contact_id, address_id,
                   project_type_id, trade, branch_id, start_date, end_date,
                   potential_value, source, responsible_user_id, reminder_at,
                   custom_fields_json, ...)
project_types     (id, tenant_id, name, color, trade, default_stages_json)
project_stages    (id, project_id, name, order_num, status, entered_at, left_at)
project_participants (project_id, user_id, role)

// documents
documents         (id, tenant_id, project_id, type, number, title, document_date,
                   due_date, status, total_net, total_vat, total_gross,
                   currency, contact_id, address_id, reference_document_id,
                   locked, locked_at, custom_fields_json, ...)
document_positions(id, document_id, parent_position_id, order_num, kind,
                   article_id, service_id, description, quantity, unit,
                   unit_price, discount_pct, vat_pct, total_net,
                   position_number)
document_versions (id, document_id, version, snapshot_json, created_by, created_at)
document_templates(id, tenant_id, name, type, content_json)

// articles & services
articles          (id, tenant_id, supplier_id, number, ean, name, short_text,
                   long_text, unit, purchase_price, list_price, sale_price,
                   vat_pct, group_id, manufacturer, manufacturer_number,
                   stock, min_order_qty, delivery_days, image_url,
                   is_imported, import_source, custom_fields_json, ...)
services          (id, tenant_id, number, name, description, calculation_json,
                   purchase_cost, sale_price, vat_pct, ...)
article_groups    (id, tenant_id, parent_id, name, order_num)
price_lists       (id, tenant_id, name, is_default)
price_list_items  (price_list_id, article_id, price, valid_from)

// time tracking
time_entries      (id, tenant_id, user_id, project_id, task_id, started_at,
                   ended_at, break_minutes, activity_type, billable, comment,
                   approved_by, approved_at, ...)
time_categories   (id, tenant_id, name, billable, color)
wage_groups       (id, tenant_id, name, hourly_rate, hourly_cost)

// tasks
tasks             (id, tenant_id, project_id, title, description, due_date,
                   assigned_user_id, status, priority, parent_task_id)
task_templates    (id, tenant_id, name, description, default_due_days)

// files & logbook
files             (id, tenant_id, project_id, contact_id, filename,
                   mime_type, size, s3_key, uploaded_by, folder_id)
folders           (id, tenant_id, parent_id, name, entity_type)
logbook_entries   (id, tenant_id, entity_type, entity_id, kind,
                   message, author_id, visibility_roles, system_event)
```

### H.2 Modul-Tabellen

```typescript
// M3 Wartung & Anlagen
assets            (id, tenant_id, contact_id, project_id, asset_type,
                   brand, model, serial_number, installation_date,
                   warranty_until, location_description, custom_fields_json)
maintenance_contracts (id, tenant_id, contact_id, asset_id, name,
                       interval_months, next_due_date, price, start_date,
                       end_date, auto_renewal)
maintenance_visits (id, contract_id, scheduled_at, completed_at, user_id,
                    protocol_json, issues_found, follow_up_required)

// M5 Soll/Ist
project_calculations (project_id, planned_hours, planned_material_cost,
                      planned_total_cost, actual_hours, actual_material_cost,
                      actual_total_cost, planned_revenue, actual_revenue)

// M6 Lager
warehouses        (id, tenant_id, name, address)
stock_items       (id, warehouse_id, article_id, quantity, reserved,
                   min_stock, location_code)
stock_movements   (id, stock_item_id, kind, quantity, reference_doc,
                   user_id, created_at)

// M7 Förderung
funding_programs  (id, name, country, region, description, max_amount,
                   requirements_json, active)
funding_applications (id, tenant_id, project_id, program_id, status,
                      submitted_at, approved_at, paid_at, amount_requested,
                      amount_approved, document_ids_json, notes)

// M13 Checklisten
checklist_templates (id, tenant_id, name, entity_type, items_json)
checklist_instances (id, template_id, entity_type, entity_id,
                     items_state_json, completed_at, completed_by)

// M14 Kanban & Chat
kanban_boards     (id, tenant_id, name, columns_json)
project_messages  (id, project_id, user_id, external_email, message,
                   attachments_json, created_at)
```

### H.3 Audit & System

```typescript
audit_log         (id, tenant_id, user_id, entity_type, entity_id,
                   action, before_json, after_json, ip, user_agent, at)
notifications     (id, tenant_id, user_id, kind, title, body,
                   entity_type, entity_id, read_at, created_at)
email_templates   (id, tenant_id, name, context, subject, body_html,
                   body_text, variables_json)
email_outbox      (id, tenant_id, to_addr, from_addr, subject, body, status,
                   sent_at, error, message_id)
```

---

## TEIL I — FEATURE-SPEZIFIKATIONEN (DETAIL)

### I.1 Kontakt-Formular

**Header (immer sichtbar):** Kategorie, Typ (Person/Firma Toggle), vCard-Upload, Anrede, Titel, Kundennummer (auto), Name-Felder, Position.

**Tabs:**
1. **KONTAKTDETAILS** — Email, Rechnungsempfänger, Erreichbarkeit, Quelle, Telefone, Website, Geburtstag
2. **ADRESSE** — Google Places Autocomplete, PLZ/Ort/Land
3. **KONDITIONEN** — Zahlungsziel, Skonto, VK-Gruppe
4. **ZAHLUNGSDATEN** — IBAN/BIC/Bank, UID, Debitor/Kreditor
5. **ZUGFERD** — Leitweg-ID
6. **ANLAGEN** (wenn M3 aktiv) — installierte Anlagen am Kunden

### I.2 Projekt-Formular

**Felder:** Kontakt (Combobox + Inline-Neu), Ansprechpartner (kaskadiert), Adresse (kaskadiert), Projekttyp, Gewerk, Niederlassung, Name, Volumen, Quelle, Beteiligte.

**Projekt-Detail-Tabs:**
1. Übersicht (KPIs, nächste Termine, letzte Aktivitäten)
2. Logbuch (chronologisch, + Wetter-Button, Rollen-Sichtbarkeit)
3. Dokumente (Angebote, Rechnungen, gruppiert)
4. Termine
5. Aufgaben (offen/erledigt, Vorlagen, Batch-Anlegen)
6. Zeit & Lohn
7. Material (Belege, Artikel, Bestellungen)
8. Soll/Ist (M5)
9. Fotos (Galerie)
10. Anlagen (M3)
11. Förderung (M7)
12. Checklisten (M13)
13. Chat (M14)

### I.3 Dokumenten-Editor (Herzstück)

**Layout 3-Spalten:** Links Navigation · Mitte Editor/Preview · Rechts Artikel-Sidebar + Live-Übersicht.

**Top-Toolbar:** Entwurf/PDF-Toggle · Versenden · Preise aktualisieren · Zeiten einfügen · Positionen übernehmen · Vorlagen · Undo/Redo · Speichern · Abschließen · Versionen.

**Positionstabelle:** Pos · Menge · Einheit · Bezeichnung · EP · Aufschlag · Gesamt. Drag-Handle. Inline-Edit. Hierarchische Nummerierung. Position-Kinds: article, service, text, subtotal, title.

**Rechte Sidebar:** Artikel & Leistungen (Suchfeld + Drag), Texte & Titel, Live-Übersicht (Positionen, Netto/Brutto), Gliederung.

**Footer:** Netto, MwSt aufgeschlüsselt, Gesamt, Schlusstext-Editor mit Textbausteinen, Grußformel.

### I.4 Artikel-Formular

**Tab INFORMATIONEN:** Bild, Name, Nr, Einheit, EAN, Lieferant, Hersteller, Kategorie, Matchcode, Beschreibung (mit KI-Button).

**Tab KALKULATION:** EK, Listenpreis, MwSt%, VK-Gruppen-Tabelle mit Aufschlag%, Standard-Flag. Historie-Tab zeigt Preis-Verlauf.

### I.5 Leistung-Formular

**Tab KALKULATION — 3 Sektionen:**
1. **Material** (Artikel mit Menge, EK, LP, Aufschlag, VK)
2. **Lohn/Maschinen** (Lohngruppe, Minuten, EK/h, Aufschlag, VK/h)
3. **Netto-Summary** (bidirektional: EK+Aufschlag ⇌ VK)

### I.6 Zeiterfassung

**Kopf:** Tag, Mitarbeiter.

**Haupt-UI — 2 Kacheln:** Arbeitszeit / Pausenzeit mit "+ Eintrag".

**Pro Arbeitszeit-Eintrag:** Kategorie, Start/Ende, Dauer (auto), Zuweisen zu Projekt|Auftrag-Toggle, Kommentar.

**Oben KPIs:** Beantragt/Bewilligt, Soll/Abwesend, Ausgleich/Saldo.

### I.7 Materialbeleg (mit OCR)

**Layout:** Links Upload (Drag&Drop mit Preview), rechts Formular (Einfach/Erweitert-Toggle).

**Felder:** Lieferant, Positionen (mehrfach: Kostenstelle, Projekt, Betrag, MwSt, Buchungskonto, Beschreibung), Umsatzsteuer-Regel, Live-Summen. Erweitert: Belegdatum, Nummer, Fälligkeit.

**KI:** Nach Upload → OCR → Felder vorausgefüllt, User bestätigt.

---

## TEIL J — CODING-REGELN (VERBINDLICH)

### J.1 TypeScript
- Strict mode, alle flags an
- Kein `any`, kein `as` ohne Kommentar
- Keine impliziten Returns
- Alle externen Inputs via Zod validieren

### J.2 Datenbank
- **IMMER** tenant-scoped via `db.scoped(tenantId)` wrapper
- Migrations forward-only in prod
- Jede Tabelle: `id` (ULID), `tenant_id`, `created_at`, `updated_at`, `deleted_at`
- FKs explizit mit `onDelete`

### J.3 API
- tRPC-Router pro Modul in `packages/api/routers/*`
- Jeder Endpoint: `input` (Zod), `output` (inferred oder Zod)
- Middleware: Auth, Tenant-Context, Feature-Flag-Check, Rate-Limit
- Keine Business-Logik in Routern — ruft `services/` auf
- REST nur für: Portal, Mobile, Webhooks

### J.4 Frontend
- Server Components per default, `'use client'` nur wo nötig
- Formulare: react-hook-form + zodResolver
- Server Components fetchen direkt via tRPC-Server-Caller
- Error-Boundaries pro Route
- Suspense für asynchrone UI

### J.5 UI/UX (siehe Teil O für Details!)
- **Mobile-First CSS**
- Tastatur-Navigation auf JEDEM Screen
- **Cmd+K Command Palette** überall
- Slash-Commands im Editor
- Toasts (Sonner) für Feedback
- Loading Skeletons, keine Spinner
- Inline-Edit wo möglich
- Optimistic Updates
- **Dark Mode von Tag 1**

### J.6 Accessibility
- WCAG AA Minimum
- Keyboard-Navigation
- Focus-Ringe sichtbar
- ARIA-Labels für Icon-Buttons
- Kontrast geprüft (auch Dark Mode)

### J.7 Internationalisierung
- **i18n von Tag 1** via next-intl
- Alle User-Strings via `t()`
- date-fns Locale, Intl.NumberFormat

### J.8 Tests
- Unit für jede Service-Funktion, jeden Parser, jede Calculation
- Integration für tRPC-Router (Testcontainers)
- E2E für kritische Flows:
  - Kontakt → Projekt → Angebot → PDF → Rechnung → bezahlt
  - Zeit stempeln → Chef bestätigt → Auswertung
  - Mobile: Foto-Upload → Büro sieht in Dokumenten

### J.9 Security
- OWASP Top 10 bewusst
- CSRF via sameSite Cookies + Tokens
- XSS via React-Auto-Escaping + CSP
- Rate-Limiting auf Login, Public-API, AI-Endpoints
- 2FA für Admins (TOTP)
- Passwörter: Argon2id
- Secrets in ENV, nie im Code
- File-Uploads: MIME-Check + (später) Virus-Scan

### J.10 Commits & Git
- Conventional Commits
- Eine logische Änderung pro Commit
- Feature-Branches (auch solo)
- Keine force-pushes auf main
- Pre-commit Hooks: Lint, Typecheck, Format

---

## TEIL K — API-DESIGN (tRPC)

```typescript
appRouter = router({
  auth:          authRouter,
  tenant:        tenantRouter,
  contacts:      contactsRouter,
  projects:      projectsRouter,
  documents:     documentsRouter,
  articles:      articlesRouter,
  services:      servicesRouter,
  time:          timeRouter,
  tasks:         tasksRouter,
  files:         filesRouter,
  logbook:       logbookRouter,
  search:        searchRouter,
  ai:            aiRouter,
  // Module
  maintenance:   maintenanceRouter,    // M3
  schedule:      scheduleRouter,       // M4
  calculation:   calculationRouter,    // M5
  warehouse:     warehouseRouter,      // M6
  funding:       fundingRouter,        // M7
  datanorm:      datanormRouter,       // M1
  ids:           idsConnectRouter,     // M2
  datev:         datevRouter,          // M10
  checklists:    checklistsRouter,     // M13
  kanban:        kanbanRouter,         // M14
})
```

---

## TEIL L — UI-KOMPONENTEN-BIBLIOTHEK (`packages/ui`)

Auf shadcn/ui aufbauend. HeatFlow-eigene Komponenten:

- `<DataTable>` — TanStack Table virtualisiert, Filter-in-Header, Bulk-Actions, Spalten-Sichtbarkeit, Export
- `<EntityCombobox>` — Searchable Dropdown mit "+ Neu"-Inline-Create
- `<AddressAutocomplete>` — Google Places
- `<DateRangePicker>` — Presets
- `<StatusPipeline>` — Kanban-Status-Leiste
- `<PositionTable>` — dnd-kit Tabelle für Dokumente
- `<RichTextEditor>` — Tiptap mit KI-Button, Textbausteinen, Platzhaltern
- `<FileDropzone>` — Drag&Drop + Preview
- `<SignaturePad>` — Unterschriften
- `<CommandMenu>` — Cmd+K
- `<LogbookTimeline>` — chronologisch
- `<CalculationGrid>` — bidirektional VK⇌Aufschlag
- `<PlanningBoard>` — Gantt/Drag&Drop
- `<GanttChart>` — Projekt-Zeitpläne
- `<AIAssistantPanel>` — schwebendes Chat-Panel rechts
- `<EmptyState>` — schöner leerer Zustand (Illustration + Copy + CTA)
- `<StatCard>` — Dashboard-KPI-Karten
- `<Badge>`, `<Pill>`, `<StatusDot>` — Status-Indikatoren

---

## TEIL M — WÄRMEPUMPEN-SPEZIFISCHE FEATURES

### M.1 Anlagen-Stammdaten

Pro Kunde beliebig viele Anlagen:
- **Wärmepumpe:** Hersteller, Modell, Baureihe, Seriennr., Baujahr, kW-Leistung, COP, Kältemittel (R32/R290/R410A), Schallleistung
- **Pufferspeicher:** Volumen, Hersteller, Modell
- **Warmwasserspeicher:** Volumen, Typ
- **Heizungssystem:** FBH/Heizkörper, Vorlauftemperatur
- **Stromzähler** (für PV-Kombi)
- **PV-Anlage:** kWp, Module, Wechselrichter

### M.2 Heizlast-Integration

Import als PDF/XML. Anbindung an:
- **Viessmann ViGuide**
- **Vaillant ProE**
- **Buderus Planning Assistant**
- **Hottgenroth ETU Planer**

Empfehlung WP-Größe basierend auf Heizlast.

### M.3 Förderungs-Assistent (M7)

**Datenbank:**
- **DE:** BAFA (BEG EM), KfW (358/359), Heizungstausch-Bonus, iSFP-Bonus, Klimageschwindigkeit-Bonus
- **AT:** Raus-aus-Öl-Bonus, 9 Landesförderungen, Umweltförderung im Inland
- **CH:** Gebäudeprogramm, Kanton-spezifisch

**Assistent:** Kundendaten+Anlage → passende Förderungen, Dokumenten-Checkliste, Status-Tracking, Fristen-Erinnerungen, Förder-Beträge in Kalkulation.

### M.4 Hersteller-APIs (M9)

- **Viessmann One Base**
- **Vaillant Partner-Platform**
- **Bosch Buderus**
- **Stiebel Eltron Service-Welt**
- **NIBE Uplink**

Features: Anlagen-Monitoring im Portal, automatische Service-Tickets bei Fehler-Codes, Fernparameter-Änderungen.

### M.5 Wartungs-Workflow (M3)

- Wartungsvertrag mit Intervall (6/12/24 Monate)
- Automatische Wartungs-Aufträge 4 Wochen vorher
- Wartungsprotokoll-Template mit Checkliste:
  - Kältekreislauf, Verdampfer/Kondensator reinigen, Solequalität (Sole-WP), Sicherheitsventile, Elektrische Verbindungen, Fehlerspeicher, Kunden-Unterschrift
- Automatische Folgerechnung
- Mängelliste → Folgeaufträge

---

## TEIL N — ROADMAP (MEILENSTEINE)

### Phase 0 — Setup (Woche 1) — **MUSS AUF ANHIEB LAUFEN**
- [ ] Monorepo-Bootstrap (siehe Quickstart)
- [ ] Docker-Stack läuft (Postgres/Redis/Meilisearch/MinIO/Mailpit)
- [ ] Next.js App + Auth.js Basis
- [ ] tRPC "Hello World"
- [ ] Demo-Tenant + Demo-User seedable
- [ ] CI/CD (GitHub Actions): Lint, Typecheck, Test, Build
- [ ] Sentry + Pino konfiguriert
- [ ] **Design-System-Kern** (Teil O) implementiert

### Phase 1 — CORE-CRM (Wochen 2–5)
- [ ] Tenants/Users/Multi-Tenancy
- [ ] Kontakte (5-Tab-Formular, Tags, Suche, CSV-Import)
- [ ] Projekte (Status-Pipeline, alle Grund-Tabs)
- [ ] Projekttypen konfigurierbar
- [ ] Aufgaben-System
- [ ] Logbuch mit Rollen-Sichtbarkeit
- [ ] File-Upload
- [ ] Globale Suche (Meilisearch)
- [ ] **Dashboard** (wunderschön, mit KPI-Kacheln, letzte Aktivitäten, quick actions)

### Phase 2 — DOKUMENTE (Wochen 6–10)
- [ ] Artikel-Stamm (einfach)
- [ ] Leistungen mit Kalkulation
- [ ] **Dokumenten-Editor** (Tiptap) mit Drag&Drop-Positionen
- [ ] PDF-Generierung (@react-pdf/renderer)
- [ ] Dokument-Typen: Angebot, AB, Lieferschein, Rechnung
- [ ] Lebenszyklus (Angebot → AB → Rechnung)
- [ ] Positionsübernahme
- [ ] Versionshistorie
- [ ] Dokument abschließen
- [ ] E-Mail-Versand (Resend, Dev via Mailpit)
- [ ] Templates mit Mustache
- [ ] **ZUGFeRD/XRechnung** Generierung
- [ ] Summen-Logik (Netto/MwSt/Brutto, Skonto, Rabatt)

### Phase 3 — ZEIT & MOBILE (Wochen 11–14)
- [ ] Zeiterfassung (Arbeitszeit + Pausen)
- [ ] Zeitkategorien, Lohngruppen
- [ ] Abwesenheiten, Genehmigungs-Workflow
- [ ] Capacitor-App Setup
- [ ] Mobile: Projekte, Zeit stempeln, Foto-Upload
- [ ] Mobile: Unterschrift einholen
- [ ] Offline-Cache (Basis)

### Phase 4 — INTEGRATION & MODULE (Wochen 15–20)
- [ ] M1 Datanorm-Import
- [ ] M5 Soll/Ist
- [ ] M10 DATEV-Export
- [ ] M3 Wartungsverträge & Anlagen
- [ ] M7 Förderungs-Modul
- [ ] Kundenportal (Basis)
- [ ] Google Places

### Phase 5 — KI (Wochen 21–24)
- [ ] M12 FlowAI-Infrastruktur (Claude SDK, Prompts, Tool-Use)
- [ ] Foto-zu-Angebot
- [ ] Sprach-zu-Projekt
- [ ] Mail-zu-Projekt
- [ ] OCR Belege
- [ ] Assistenz-Panel

### Phase 6 — ADVANCED (Wochen 25–30)
- [ ] M4 Plantafel
- [ ] M14 Kanban + Chat
- [ ] M13 Checklisten
- [ ] M6 Lager
- [ ] M11 SEPA + Mahnwesen
- [ ] M2 IDS Connect
- [ ] M8 Heizlast-Integrationen
- [ ] M9 Hersteller-APIs (Viessmann zuerst)
- [ ] Custom Fields UI
- [ ] PDF-Vorlagen-Designer

### Phase 7 — POLISH & LAUNCH (Wochen 31–36)
- [ ] Performance-Audit
- [ ] Security-Audit
- [ ] WCAG-Audit
- [ ] Onboarding-Flow
- [ ] Dokumentation (DE)
- [ ] Help-Center
- [ ] Billing (Stripe)
- [ ] Marketing-Website
- [ ] Beta mit 5–10 Pilot-Kunden

---

## TEIL O — DESIGN-SYSTEM & BRANDING (★ WUNDERSCHÖN ★)

> **Design ist kein Nachgedanke. HeatFlow soll so aussehen, dass ein Markus beim ersten Öffnen sagt: "Endlich. Endlich eine Software, die nicht wie eine Behörde aussieht."**
>
> Referenzen: **Linear, Notion, Vercel Dashboard, Raycast, Stripe Dashboard, Plausible Analytics, Cal.com.**

### O.1 Design-Prinzipien

1. **Ruhe vor Lärm** — viel Weißraum, wenige Farben, klare Hierarchie. Keine Informationsballungen.
2. **Inhalt ist der Star** — UI-Chrome (Headers, Sidebars) ist zurückhaltend, Content-Bereiche dominieren.
3. **Konsistenz > Kreativität** — ein Button sieht überall gleich aus. Ein Input auch. Ein Badge auch.
4. **Ein-Klick-Prinzip** — Die häufigste Aktion auf jedem Screen ist **einen Klick** entfernt, deutlich sichtbar, aber nicht schreiend.
5. **Keyboard-First** — alles mit Tastatur bedienbar, Cmd+K öffnet Command Palette überall.
6. **Dunkel & Hell gleichwertig** — kein "Dark Mode als Afterthought".
7. **Micro-Interactions** — subtile Animationen (150–250ms, ease-out) bei Hover, Focus, State-Change. Nie auffällig, immer fühlbar.
8. **Echte Daten im Design** — keine Lorem-Ipsum-Mockups. Wir designen mit realistischen Handwerker-Daten.
9. **Mobile ist nicht "Desktop schmal"** — Mobile ist eigenes Design, fokussiert, touch-optimiert, große Tap-Targets (min 44×44).
10. **Empty States sind Liebe** — leere Listen/Boards zeigen Illustration + helpful copy + CTA, nicht einfach "Keine Daten".

### O.2 Farb-System

**Semantic Colors (HSL, Tailwind CSS Variables):**

```css
/* Light Mode */
--background: 0 0% 100%;
--foreground: 222 47% 11%;
--muted: 220 14% 96%;
--muted-foreground: 220 9% 46%;
--card: 0 0% 100%;
--card-foreground: 222 47% 11%;
--popover: 0 0% 100%;
--popover-foreground: 222 47% 11%;
--border: 220 13% 91%;
--input: 220 13% 91%;
--ring: 217 91% 60%;

/* Brand */
--primary: 217 91% 45%;              /* HeatFlow-Blau: warm, vertrauensvoll */
--primary-foreground: 0 0% 100%;
--accent: 33 100% 55%;               /* Warm-Orange: Energie, Wärme */
--accent-foreground: 0 0% 100%;

/* Semantic */
--success: 142 71% 45%;
--success-foreground: 0 0% 100%;
--warning: 38 92% 50%;
--warning-foreground: 222 47% 11%;
--danger: 0 72% 51%;
--danger-foreground: 0 0% 100%;
--info: 199 89% 48%;
--info-foreground: 0 0% 100%;

/* Dark Mode — eigenständig, nicht "invertiert" */
.dark {
  --background: 222 47% 7%;          /* nicht pures Schwarz! */
  --foreground: 210 20% 98%;
  --muted: 217 33% 13%;
  --muted-foreground: 215 20% 65%;
  --card: 222 47% 9%;
  --card-foreground: 210 20% 98%;
  --popover: 222 47% 9%;
  --popover-foreground: 210 20% 98%;
  --border: 217 33% 18%;
  --input: 217 33% 18%;
  --ring: 217 91% 60%;
  --primary: 217 91% 60%;
  --primary-foreground: 222 47% 7%;
  --accent: 33 100% 60%;
  --accent-foreground: 222 47% 7%;
}
```

**Regeln:**
- **Primary** nur für: primary button, aktive Navigation, Links, Ring/Focus
- **Accent** NUR sparsam für: Highlight-Badges, "Neu"-Markierungen
- **90% der UI ist Neutral** (gray + white/black)
- **Farbe = Bedeutung** (Success grün, Warning gelb, Danger rot — nie aus Deko-Gründen)

### O.3 Typografie

**Font-Stack:**
```css
--font-sans: 'Inter Variable', -apple-system, BlinkMacSystemFont, ui-sans-serif, system-ui;
--font-mono: 'JetBrains Mono Variable', ui-monospace, 'SF Mono', Menlo;
```

**Feature-Settings:**
```css
body { font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11', 'ss01'; }
```

**Typ-Skala (Tailwind-aligned):**
- Display (Dashboard-Hero): `text-4xl font-semibold tracking-tight` (2.25rem, -0.025em)
- H1: `text-2xl font-semibold tracking-tight`
- H2: `text-xl font-semibold tracking-tight`
- H3: `text-lg font-medium`
- Body: `text-sm` (14px, die SaaS-Standard-Größe)
- Caption: `text-xs text-muted-foreground`
- Code/Nummern: `font-mono text-sm tabular-nums`

**Zahlen-Formatierung:** IMMER `tabular-nums` für Geld/Mengen/Nummern in Tabellen (sonst springen Spalten).

### O.4 Spacing & Layout

- **4px-Grid** (Tailwind-Default: 1 = 4px)
- **Großzügige Paddings:** Cards `p-6`, Dialoge `p-6`, List-Rows `py-3 px-4`
- **Konsistente Gaps:** zwischen verwandten Elementen `gap-2`, zwischen Sections `gap-6` oder `gap-8`
- **Container:** `max-w-7xl` für Content, `max-w-md` für Forms
- **Sidebar-Breite:** 240px (w-60), collapsed 64px (w-16)

### O.5 Shadows & Elevations

```css
--shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06);
--shadow: 0 4px 12px -2px rgb(0 0 0 / 0.08), 0 2px 4px -1px rgb(0 0 0 / 0.04);
--shadow-md: 0 10px 20px -4px rgb(0 0 0 / 0.10), 0 4px 8px -2px rgb(0 0 0 / 0.06);
--shadow-lg: 0 20px 40px -8px rgb(0 0 0 / 0.12), 0 8px 16px -4px rgb(0 0 0 / 0.08);
```

**Regeln:**
- Flache UI per Default (keine Schatten außer bei Overlays)
- Cards KEIN Schatten, nur Border
- Dropdowns/Popovers/Dialoge → `shadow-lg`
- Dark Mode: Schatten weniger sichtbar, stattdessen `border-white/10` für Elevation

### O.6 Border-Radius

- Buttons, Inputs, Cards, Badges: `rounded-lg` (0.5rem / 8px)
- Große Cards: `rounded-xl` (12px)
- Dialoge: `rounded-2xl` (16px)
- Runde Elemente (Avatare, Pills): `rounded-full`
- **Nie** scharfe `rounded-none` im User-UI

### O.7 Komponenten-Richtlinien

**Buttons:**
- Primary: `bg-primary text-primary-foreground hover:bg-primary/90`
- Secondary: `border border-border bg-background hover:bg-muted`
- Ghost: `hover:bg-muted` (für Icon-Buttons in Tabellen)
- Destructive: `bg-danger text-danger-foreground`
- Größen: `sm` (28px), `default` (36px), `lg` (40px)
- Icon in Button: `lucide-react`, 16px, `gap-2` zum Label

**Inputs:**
- Border: `border-input`
- Focus: `ring-2 ring-ring/30 ring-offset-0`
- Error: `border-danger ring-danger/20`
- Placeholder `text-muted-foreground`
- Height: 36px default (h-9)

**Cards:**
- `bg-card border border-border rounded-xl`
- Header mit `border-b` separat
- Kein Schatten in der Liste, nur bei Hover für interaktive Cards

**Tables:**
- Zebra-Streifen: NEIN (modern)
- Row-Hover: `hover:bg-muted/50`
- Header: `bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground`
- Sortier-Indikator rechts im Header
- Dichte: 3 Varianten (compact 32px, default 48px, comfortable 56px)

**Navigation (Sidebar):**
- Aktiver Eintrag: `bg-muted text-foreground font-medium` + 2px Accent-Bar links
- Inaktiv: `text-muted-foreground hover:bg-muted/50 hover:text-foreground`
- Icons immer links, 16px, `gap-3`
- Collapse-Button unten, speichert State in Cookie

**Dialoge:**
- Overlay: `bg-background/80 backdrop-blur-sm`
- Max-Width: `max-w-lg` default, `max-w-2xl` für Formulare mit Tabs, `max-w-5xl` für Editoren
- Padding: `p-6`, Buttons `gap-2` im Footer rechts

**Badges:**
- Status-Farben via semantic vars
- `text-xs font-medium px-2 py-0.5 rounded-md`
- Mit kleinem Dot: `●` 6px, 4px gap

**Empty States:**
- Illustration (SVG, monochrom, einfach — Undraw.co Style, aber in Brand-Farben)
- Headline, 1-2 Sätze Copy, klarer CTA
- Beispiel: "Noch keine Projekte. Lege dein erstes Projekt an, um loszulegen." + [+ Neues Projekt] Button

### O.8 Ikonografie

- **Ausschließlich lucide-react** (keine Mischung mit anderen Sets)
- Größen: 14 / 16 / 20 / 24 px — nie dazwischen
- Stroke-Width: `1.5` (Default), niemals `2` (zu heavy)
- Icon-Button: 36×36 Container, Icon 16px

### O.9 Animationen

**Principles:**
- Duration: 150ms (Micro) / 250ms (Small) / 400ms (Medium) / 600ms (Large)
- Easing: `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo) für Enter, `cubic-bezier(0.7, 0, 0.84, 0)` für Exit
- Respect `prefers-reduced-motion`

**Wo wir animieren:**
- Hover auf Buttons: Farbe + leichte `scale(1.02)` auf `active:scale-[0.98]`
- Dialog-Enter: Fade + leichtes `translate-y-2 → 0`
- Dropdown/Popover: Fade + `scale-95 → 100`
- List-Items neu: Fade + `slide-in-from-top-2`
- Tab-Wechsel: Content fade 150ms

**Wo wir NICHT animieren:**
- Routine-Klicks (Navigation)
- Tabellen-Renders (zu viel Flackern)
- Dark/Light Mode Toggle (sofortig)

### O.10 Beispiel-Layouts (Fokus-Screens)

**Dashboard (Startseite):**
- Top: Greeting ("Guten Morgen, Markus") + Datum + Wetter-Widget (diskret)
- Grid 3×2 KPI-Kacheln: Aktive Projekte, Offene Angebote, Offene Rechnungen, Stunden diese Woche, Nächster Termin, Förderstatus
- Darunter 2-spaltig: "Letzte Aktivitäten" (Timeline) | "Meine offenen Aufgaben" (checkbox list)
- Rechts: AI-Assistenz-Panel (collapsible, default geöffnet)

**Kontakte-Liste:**
- Header: Titel, Filter-Chips (Kunde/Lieferant/Partner/Archiv), Search-Input, "+ Neuer Kontakt"-Button primary rechts
- DataTable virtualisiert, Bulk-Selection-Checkbox ganz links, Inline-Kontextmenü rechts (3-Dots)
- Empty-State wenn keine Treffer

**Projekt-Detail:**
- Top: Breadcrumb, Projekt-Titel (inline-edit bei Klick), Status-Pill rechts, Action-Buttons ("Dokument erstellen", "…")
- Tab-Leiste horizontal unter dem Header, kein vertikaler Tab-Stack
- Main-Area zeigt aktiven Tab-Content
- Rechts optional Details-Sidebar (Kunde, Adresse, Ansprechpartner, Verantwortlicher)

**Dokumenten-Editor:**
- Fullscreen-Mode möglich (Cmd+Shift+F)
- Top-Bar fix, Editor scrollt
- Right-Sidebar collapsible
- PDF-Preview-Toggle animiert (Split-View möglich auf breiten Screens)

**Mobile-App (Capacitor):**
- Bottom-Tab-Bar mit 4 Tabs: Heute · Projekte · Zeit · Mehr
- "Heute" zeigt kontextuell aktuellste Projekte + Schnell-Stempeln
- Große Touch-Targets, kein Hover-State
- Pull-to-Refresh überall

### O.11 Branding (Logo, Name)

- **Arbeitsname:** HeatFlow (→ finaler Name via User)
- **Logo-Idee:** Stilisierte Flamme aus 2 geschwungenen Linien → transformiert zu Wasser-Welle (Wärme → Fließend → Wärmepumpe)
- **Tagline:** "Die Software für moderne Wärmepumpen-Profis."
- Placeholder-Logo als SVG in `apps/web/public/logo.svg` — kann später getauscht werden

### O.12 Don'ts (kategorisch verboten)

- ❌ Bootstrap-Look (pillenförmige Primary-Buttons auf weißem Card-Sumpf)
- ❌ Emoji als UI-Icons (nur in User-Content erlaubt)
- ❌ Gradients als Hintergründe (außer subtil im Login-Screen)
- ❌ Schriftarten: Comic Sans, Papyrus, etc. (selbstverständlich, aber es muss gesagt sein)
- ❌ Mehr als 2 Schriftarten (Inter + JetBrains Mono = Ende)
- ❌ Mehr als 3 primäre Farben auf einem Screen
- ❌ Auto-Scrolling Carousels / Auto-playing Video / Parallax
- ❌ Modal-in-Modal-in-Modal
- ❌ Hässliche Platzhalter-Bilder (lieber schöne Empty-States)

---

## TEIL P — SICHERHEIT & DSGVO

### P.1 DSGVO
- AVV vorbereitet
- Datenauskunft pro Kunde möglich (Export aller Daten)
- Recht auf Vergessen: Soft-Delete → Hard-Delete nach 30 Tagen
- Datenminimierung
- Hosting EU (Hetzner DE)
- Cookie-Consent im Portal
- Keine PII in Logs

### P.2 Sicherheit
- HTTPS erzwungen (HSTS)
- CSP streng
- Rate-Limiting auf Login, Public-API, AI
- 2FA für Admins (TOTP)
- Audit-Log für sensible Änderungen
- Backups täglich, 30 Tage Retention
- Disaster Recovery dokumentiert

### P.3 Compliance
- ZUGFeRD 2.1 / XRechnung 3.0 ab 2025 DE
- GoBD/GoBS konform (unveränderbare Dokumente nach Abschluss)
- Abgabenordnung (10 Jahre Aufbewahrung)

---

## TEIL Q — DEFINITION OF DONE (V1)

- [ ] CORE (C1–C8) fehlerfrei
- [ ] Module M1, M3, M5, M7, M10, M12 live
- [ ] E2E-Flow Lead → bezahlte Rechnung → Wartungsvertrag funktioniert
- [ ] Mobile auf iOS + Android (Capacitor)
- [ ] ZUGFeRD-Rechnungen validieren bei BMF-Validator
- [ ] DATEV-Export vom Steuerberater angenommen
- [ ] 5 Pilot-Kunden im Alltag
- [ ] Performance: Seite <2s auf 4G, Listen <500ms bei 10k Einträgen
- [ ] 99.5% Uptime über 30 Tage
- [ ] Sicherheitsaudit bestanden
- [ ] DSGVO + AVV finalisiert
- [ ] Doku komplett (DE)
- [ ] **Design-Review bestanden** (Vergleich mit Linear/Notion/Stripe)

---

## TEIL R — STARTAUFTRAG

1. **Lies dieses Dokument vollständig.**
2. **Führe den Quickstart (ganz oben) aus.**
3. **Verifiziere alle Checkmarks in Schritt 6 des Quickstarts.** Wenn etwas nicht läuft: ADR schreiben, User fragen, NICHT weiterbauen.
4. Implementiere **Phase 0** vollständig (falls Bootstrap-Files noch fehlen).
5. Implementiere **Phase 1** (CORE-CRM).
6. Nach jeder Phase: Status-Notiz in `docs/status/YYYY-MM-DD.md`.
7. Bevor du Phase 2 startest: Zeige mir eine Demo (Screenshot eines Kontakts + Projekts), User gibt Go.

---

## TEIL S — OFFENE FRAGEN AN DEN USER

Diese nicht eigenmächtig beantworten:

1. **Launch-Markt:** AT zuerst, dann DE? Oder parallel?
2. **Pilot-Kunden:** Reale Kandidaten für Beta?
3. **Finaler Name:** "HeatFlow" ok oder anderer?
4. **Preise final:** Sind die Modul-Preise (Teil D.3) ok?
5. **Billing:** Stripe oder direkt mit SEPA?
6. **Hosting:** Hetzner Nürnberg ok?
7. **Domains:** Wer registriert?
8. **Rechtsanwalt:** Wer macht Impressum/AGB/AVV?

---

**Ende.**

> Dieses Dokument ist **lebend**. Änderungen hier, nicht in separaten Dokumenten.
> Bei Widerspruch zwischen Dokument und Code-Entscheidung: **Dokument gewinnt**, außer User sagt explizit anders.
