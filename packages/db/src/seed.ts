/**
 * Seeds the demo tenant with a realistic Wärmepumpen-Installationsbetrieb.
 *
 * Runs against Supabase via the Management API (no DB password required).
 * Idempotent: deletes existing demo tenant before re-creating.
 */
import "dotenv/config";
import { ulid } from "ulid";

const projectRef = req("SUPABASE_PROJECT_REF");
const token = req("SUPABASE_MANAGEMENT_TOKEN");

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not set in env`);
  return v;
}

async function sql(query: string, params: Record<string, unknown> = {}): Promise<unknown[]> {
  // Inline params with simple substitution since the API endpoint takes only a query string.
  // We DO know the seed values are not user-supplied, so this is safe here.
  let q = query;
  for (const [k, v] of Object.entries(params)) {
    const placeholder = `:${k}`;
    const replacement = formatLiteral(v);
    q = q.split(placeholder).join(replacement);
  }
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: q }),
  });
  if (!res.ok) throw new Error(`SQL failed (${res.status}): ${await res.text()}\n--- query ---\n${q}`);
  return res.json().then((r) => (Array.isArray(r) ? r : [])).catch(() => []);
}

function formatLiteral(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v instanceof Date) return `'${v.toISOString()}'::timestamptz`;
  if (Array.isArray(v) || (typeof v === "object" && v !== null)) {
    return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(v).replace(/'/g, "''")}'`;
}

const id = (prefix: string) => `${prefix}_${ulid()}`;

async function main(): Promise<void> {
  console.log("Seeding demo tenant for HeatFlow…");

  const TENANT_ID = "ten_DEMO_HEATFLOW_AT";
  const SLUG = "demo-heatflow";

  // ---- 1. Wipe existing demo data
  console.log("  · wiping existing demo tenant");
  await sql(`DELETE FROM tenants WHERE id = :id OR slug = :slug`, { id: TENANT_ID, slug: SLUG });

  // ---- 2. Tenant
  console.log("  · creating tenant");
  await sql(
    `INSERT INTO tenants (id, name, legal_name, slug, country, currency, locale, vat_id,
       address_street, address_zip, address_city, address_country, email, phone, website,
       primary_color, settings, created_at, updated_at)
     VALUES (:id, :name, :legal, :slug, 'AT', 'EUR', 'de-AT', :vatId,
       :street, :zip, :city, 'AT', :email, :phone, :website,
       '#1e6fff', :settings, now(), now())`,
    {
      id: TENANT_ID,
      name: "epower GmbH",
      legal: "epower GmbH",
      slug: SLUG,
      vatId: "ATU12345678",
      street: "Energieweg 12",
      zip: "9020",
      city: "Klagenfurt am Wörthersee",
      email: "office@epower-demo.at",
      phone: "+43 463 123456",
      website: "https://www.epower-demo.at",
      settings: { onboarded: true, demo: true },
    },
  );

  // ---- 3. Activate features
  console.log("  · enabling features");
  const features = [
    "core.contacts","core.projects","core.documents","core.articles","core.time",
    "core.e_invoice","core.mobile","core.portal",
    "m1.datanorm","m3.maintenance","m5.calculation","m7.funding","m10.datev","m12.flow_ai",
  ];
  for (const f of features) {
    await sql(
      `INSERT INTO tenant_features (tenant_id, feature_key, active) VALUES (:t, :f, true)
       ON CONFLICT DO NOTHING`,
      { t: TENANT_ID, f },
    );
  }

  // ---- 4. Users (password hashes computed at runtime by argon2 — for seed we use a pre-hashed value)
  console.log("  · creating users");
  // Pre-computed argon2id hash of "demo1234" with default params. Safe to commit (DEMO ONLY).
  const DEMO_PW_HASH =
    "$argon2id$v=19$m=65536,t=3,p=4$8tWZJ3OQ4gPq6Z0X2YQ8Lw$XXuFw6Nf7E6vqr9F0Cmo8VUx9b3l1hG5dVbSWEnp5uA";

  const USER_ADMIN = id("usr");
  const USER_OFFICE = id("usr");
  const USER_TECH = id("usr");
  const USER_PLANNER = id("usr");

  const users = [
    { id: USER_ADMIN, name: "Markus Berger", email: "admin@demo.heatflow.local", role: "owner" },
    { id: USER_OFFICE, name: "Sabine Berger", email: "office@demo.heatflow.local", role: "office" },
    { id: USER_TECH, name: "Thomas Huber", email: "thomas@demo.heatflow.local", role: "technician" },
    { id: USER_PLANNER, name: "Andreas Maier", email: "andreas@demo.heatflow.local", role: "planner" },
  ];
  for (const u of users) {
    await sql(
      `INSERT INTO users (id, tenant_id, email, name, password_hash, role, active)
       VALUES (:id, :t, :email, :name, :hash, :role, true)`,
      { id: u.id, t: TENANT_ID, email: u.email, name: u.name, hash: DEMO_PW_HASH, role: u.role },
    );
  }

  // ---- 5. Tags
  console.log("  · creating tags");
  const TAG_VIP = id("tag");
  const TAG_BAFA = id("tag");
  const TAG_WARTUNG = id("tag");
  for (const [tagId, name, color] of [
    [TAG_VIP, "VIP", "#f59e0b"],
    [TAG_BAFA, "BAFA-Förderung", "#10b981"],
    [TAG_WARTUNG, "Wartungskunde", "#6366f1"],
  ] as const) {
    await sql(
      `INSERT INTO tags (id, tenant_id, name, color) VALUES (:id, :t, :name, :color)`,
      { id: tagId, t: TENANT_ID, name, color },
    );
  }

  // ---- 6. Project types (heat-pump preset)
  console.log("  · creating project types");
  const PT_LWP = id("pty");
  const PT_SWP = id("pty");
  const PT_PV = id("pty");
  const PT_WARTUNG = id("pty");
  const heatPumpStages = [
    "Beratung", "Vor-Ort-Termin", "Heizlast", "Angebot", "Förderung beantragt",
    "Auftrag", "Materialbestellung", "Installation", "Inbetriebnahme", "Abnahme", "Rechnung", "Wartung",
  ];
  for (const [pid, name, color, trade] of [
    [PT_LWP, "Wärmepumpe Luft/Wasser", "#0ea5e9", "SHK"],
    [PT_SWP, "Wärmepumpe Sole/Wasser", "#0284c7", "SHK"],
    [PT_PV, "PV + Wärmepumpe Kombi", "#f59e0b", "Elektro+SHK"],
    [PT_WARTUNG, "Wartung & Service", "#10b981", "SHK"],
  ] as const) {
    await sql(
      `INSERT INTO project_types (id, tenant_id, name, color, trade, default_stages)
       VALUES (:id, :t, :name, :color, :trade, :stages)`,
      { id: pid, t: TENANT_ID, name, color, trade, stages: heatPumpStages },
    );
  }

  // ---- 7. Contacts (customers + supplier)
  console.log("  · creating contacts");
  type CSeed = {
    id: string;
    type: string;
    kind: string;
    customerNumber: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
    email?: string;
    phone?: string;
    mobile?: string;
    street: string;
    zip: string;
    city: string;
    iban?: string;
    notes?: string;
    tagIds?: string[];
  };
  const contactsSeed: CSeed[] = [
    {
      id: id("ctc"),
      type: "customer",
      kind: "person",
      customerNumber: "K-2026-001",
      firstName: "Klaus",
      lastName: "Steiner",
      email: "klaus.steiner@example.at",
      phone: "+43 463 220 110",
      mobile: "+43 664 1234567",
      street: "Seenstraße 5",
      zip: "9081",
      city: "Reifnitz",
      iban: "AT611904300234573201",
      notes: "Möchte Sole/Wasser-Wärmepumpe, hat 220m² Wohnfläche, Baujahr 1995.",
      tagIds: [TAG_VIP, TAG_BAFA],
    },
    {
      id: id("ctc"),
      type: "customer",
      kind: "person",
      customerNumber: "K-2026-002",
      firstName: "Maria",
      lastName: "Hofer",
      email: "maria.hofer@example.at",
      phone: "+43 4242 778899",
      street: "Bergweg 22",
      zip: "9500",
      city: "Villach",
      tagIds: [TAG_BAFA],
    },
    {
      id: id("ctc"),
      type: "customer",
      kind: "company",
      customerNumber: "K-2026-003",
      companyName: "Alpenhotel Bergblick GmbH",
      email: "buchhaltung@alpenhotel-bergblick.at",
      phone: "+43 4827 555000",
      street: "Almweg 1",
      zip: "9546",
      city: "Bad Kleinkirchheim",
      tagIds: [TAG_WARTUNG, TAG_VIP],
    },
    {
      id: id("ctc"),
      type: "customer",
      kind: "person",
      customerNumber: "K-2026-004",
      firstName: "Johann",
      lastName: "Pfeifer",
      email: "j.pfeifer@example.at",
      mobile: "+43 660 9988776",
      street: "Schillerstraße 14",
      zip: "9020",
      city: "Klagenfurt",
      notes: "Anfrage über Webformular, will Vor-Ort-Termin.",
    },
    {
      id: id("ctc"),
      type: "supplier",
      kind: "company",
      customerNumber: "L-001",
      companyName: "Viessmann Österreich GmbH",
      email: "service@viessmann.at",
      phone: "+43 1 4030060",
      street: "Liechtensteinstraße 4",
      zip: "1090",
      city: "Wien",
      notes: "Hauptlieferant Wärmepumpen + Speicher.",
    },
    {
      id: id("ctc"),
      type: "supplier",
      kind: "company",
      customerNumber: "L-002",
      companyName: "Frauenthal Service AG",
      email: "info@frauenthal.at",
      phone: "+43 1 79572-0",
      street: "Hainburger Straße 11",
      zip: "1030",
      city: "Wien",
      notes: "SHK-Großhandel, IDS-Connect-fähig.",
    },
  ];

  const contactIdMap = new Map<string, string>();
  for (const c of contactsSeed) {
    await sql(
      `INSERT INTO contacts (
         id, tenant_id, type, kind, customer_number, first_name, last_name, company_name,
         email, phone, mobile, iban, notes, payment_terms_days, discount_pct, created_by_user_id
       ) VALUES (
         :id, :t, :type, :kind, :cn, :fn, :ln, :co, :em, :ph, :mo, :iban, :no, 14, 0, :uid
       )`,
      {
        id: c.id, t: TENANT_ID, type: c.type, kind: c.kind, cn: c.customerNumber,
        fn: c.firstName ?? null, ln: c.lastName ?? null, co: c.companyName ?? null,
        em: c.email ?? null, ph: c.phone ?? null, mo: c.mobile ?? null, iban: c.iban ?? null,
        no: c.notes ?? null, uid: USER_ADMIN,
      },
    );
    const addrId = id("cad");
    contactIdMap.set(c.customerNumber, c.id);
    await sql(
      `INSERT INTO contact_addresses (id, tenant_id, contact_id, kind, street, zip, city, country)
       VALUES (:id, :t, :cid, 'main', :s, :z, :ci, 'AT')`,
      { id: addrId, t: TENANT_ID, cid: c.id, s: c.street, z: c.zip, ci: c.city },
    );
    if (c.tagIds) {
      for (const tid of c.tagIds) {
        await sql(`INSERT INTO contact_tags (contact_id, tag_id) VALUES (:c, :t)`, { c: c.id, t: tid });
      }
    }
  }

  // ---- 8. Projects
  console.log("  · creating projects");
  const PRJ_1 = id("prj");
  const PRJ_2 = id("prj");
  const PRJ_3 = id("prj");
  const PRJ_4 = id("prj");

  const projects = [
    {
      id: PRJ_1, number: "P-2026-001", title: "Sole/Wasser-WP 12kW Steiner",
      status: "in_progress", typeId: PT_SWP, contactNumber: "K-2026-001",
      potential: 38500, responsible: USER_PLANNER,
      desc: "Komplettsanierung Heizung: Öl raus, Sole/Wasser-WP rein. Pufferspeicher 800L.",
    },
    {
      id: PRJ_2, number: "P-2026-002", title: "Luft/Wasser-WP 8kW Hofer",
      status: "quoted", typeId: PT_LWP, contactNumber: "K-2026-002",
      potential: 22800, responsible: USER_PLANNER,
      desc: "Neubau Einfamilienhaus, FBH bereits vorhanden.",
    },
    {
      id: PRJ_3, number: "P-2026-003", title: "PV 15 kWp + WP 16kW Alpenhotel",
      status: "scheduled", typeId: PT_PV, contactNumber: "K-2026-003",
      potential: 89000, responsible: USER_ADMIN,
      desc: "Großauftrag: PV-Aufdach + zwei Kaskade-WPs für Hotel.",
    },
    {
      id: PRJ_4, number: "P-2026-004", title: "Beratungstermin Pfeifer",
      status: "lead", typeId: PT_LWP, contactNumber: "K-2026-004",
      potential: 18000, responsible: USER_OFFICE, desc: "Erstkontakt aus Webformular.",
    },
  ];
  for (const p of projects) {
    const cid = contactIdMap.get(p.contactNumber)!;
    await sql(
      `INSERT INTO projects (id, tenant_id, number, title, status, contact_id, project_type_id,
         trade, start_date, potential_value, source, description, responsible_user_id)
       VALUES (:id, :t, :n, :ti, :st, :c, :ty, 'SHK', current_date, :pv, 'Webformular', :d, :u)`,
      { id: p.id, t: TENANT_ID, n: p.number, ti: p.title, st: p.status, c: cid, ty: p.typeId,
        pv: p.potential, d: p.desc, u: p.responsible },
    );
  }

  // ---- 9. Articles (Wärmepumpen + Komponenten)
  console.log("  · creating articles");
  const articles = [
    { num: "VI-VIT200-A12", name: "Vitocal 200-A 12kW Luft/Wasser-WP", manu: "Viessmann", price: 9800, ek: 7200 },
    { num: "VI-VIT350-G10", name: "Vitocal 350-G 10kW Sole/Wasser-WP", manu: "Viessmann", price: 12200, ek: 9100 },
    { num: "VI-PUF-800", name: "Vitocell 100-E Pufferspeicher 800L", manu: "Viessmann", price: 1450, ek: 980 },
    { num: "VI-DHW-300", name: "Vitocell 100-V Warmwasserspeicher 300L", manu: "Viessmann", price: 1080, ek: 720 },
    { num: "FT-AUSDEHN-50", name: "Ausdehnungsgefäß 50L", manu: "Reflex", price: 89, ek: 52 },
    { num: "FT-PUMPE-25-6", name: "Hocheffizienzpumpe 25-6", manu: "Grundfos", price: 320, ek: 210 },
    { num: "FT-MISCHER-3W-25", name: "3-Wege-Mischer DN25 mit Stellmotor", manu: "Honeywell", price: 280, ek: 165 },
    { num: "WERKSTOFF-SOLE", name: "Sole-Flüssigkeit 30%, 25L", manu: "Tyfocor", price: 145, ek: 95 },
  ];
  for (const a of articles) {
    await sql(
      `INSERT INTO articles (id, tenant_id, number, name, unit, purchase_price, list_price, sale_price, vat_pct, manufacturer, manufacturer_number)
       VALUES (:id, :t, :n, :nm, 'Stk', :ek, :p, :p, 20, :m, :n)`,
      { id: id("art"), t: TENANT_ID, n: a.num, nm: a.name, ek: a.ek, p: a.price, m: a.manu },
    );
  }

  // ---- 10. Services
  console.log("  · creating services");
  const services = [
    { name: "Montage Wärmepumpe Außeneinheit", price: 980, unit: "Stk" },
    { name: "Hydraulik-Anschluss komplett", price: 1850, unit: "Stk" },
    { name: "Inbetriebnahme + Einweisung", price: 480, unit: "Stk" },
    { name: "Wartung Wärmepumpe (jährlich)", price: 220, unit: "Stk" },
  ];
  for (const s of services) {
    await sql(
      `INSERT INTO services (id, tenant_id, name, sale_price, vat_pct, unit, calculation)
       VALUES (:id, :t, :n, :p, 20, :u, :calc)`,
      { id: id("svc"), t: TENANT_ID, n: s.name, p: s.price, u: s.unit, calc: { material: [], labor: [] } },
    );
  }

  // ---- 11. Time categories + wage groups
  console.log("  · creating time categories + wage groups");
  for (const [name, color, billable] of [
    ["Umsetzung", "#10b981", true],
    ["Fahrzeit", "#f59e0b", true],
    ["Büro", "#6366f1", false],
    ["Wartung", "#0ea5e9", true],
  ] as const) {
    await sql(
      `INSERT INTO time_categories (id, tenant_id, name, color, billable) VALUES (:id, :t, :n, :c, :b)`,
      { id: id("tcat"), t: TENANT_ID, n: name, c: color, b: billable },
    );
  }
  for (const [name, rate, cost] of [
    ["Geselle", 78.0, 28.0],
    ["Meister", 95.0, 38.0],
    ["Lehrling", 42.0, 16.0],
  ] as const) {
    await sql(
      `INSERT INTO wage_groups (id, tenant_id, name, hourly_rate, hourly_cost) VALUES (:id, :t, :n, :r, :c)`,
      { id: id("wgr"), t: TENANT_ID, n: name, r: rate, c: cost },
    );
  }

  // ---- 12. Funding programs (M7)
  console.log("  · seeding funding programs");
  const fundingPrograms = [
    { id: id("fpr"), name: "Raus-aus-Öl-Bonus (Bund AT)", country: "AT", max: 7500, desc: "Bundesförderung für Heizungstausch in AT." },
    { id: id("fpr"), name: "Klimaaktiv Bonus", country: "AT", max: 2000, desc: "Bundesländer-Zusatzförderung." },
    { id: id("fpr"), name: "BAFA BEG EM (Heizung)", country: "DE", max: 30000, desc: "Bundesförderung effiziente Gebäude." },
    { id: id("fpr"), name: "KfW 358/359 (Ergänzungskredit)", country: "DE", max: 120000, desc: "Zinsgünstiger KfW-Kredit." },
  ];
  for (const f of fundingPrograms) {
    await sql(
      `INSERT INTO funding_programs (id, name, country, max_amount, description, active)
       VALUES (:id, :n, :c, :m, :d, true)`,
      { id: f.id, n: f.name, c: f.country, m: f.max, d: f.desc },
    );
  }

  // ---- 13. Tasks
  console.log("  · creating tasks");
  const taskSeed = [
    { proj: PRJ_1, title: "Sole-Bohrung beauftragen", due: dateInDays(3), assigned: USER_ADMIN, prio: "high" },
    { proj: PRJ_1, title: "Pufferspeicher bestellen", due: dateInDays(7), assigned: USER_OFFICE, prio: "normal" },
    { proj: PRJ_2, title: "Heizlastberechnung erstellen", due: dateInDays(2), assigned: USER_PLANNER, prio: "high" },
    { proj: PRJ_3, title: "PV-Anmeldung Netzbetreiber", due: dateInDays(5), assigned: USER_OFFICE, prio: "normal" },
    { proj: PRJ_4, title: "Vor-Ort-Termin vereinbaren", due: dateInDays(1), assigned: USER_OFFICE, prio: "urgent" },
  ];
  for (const t of taskSeed) {
    await sql(
      `INSERT INTO tasks (id, tenant_id, project_id, title, due_date, assigned_user_id, status, priority)
       VALUES (:id, :t, :p, :ti, :d, :u, 'open', :pr)`,
      { id: id("tsk"), t: TENANT_ID, p: t.proj, ti: t.title, d: t.due, u: t.assigned, pr: t.prio },
    );
  }

  // ---- 14. Sample logbook entries
  console.log("  · creating logbook entries");
  for (const e of [
    { p: PRJ_1, msg: "Erstgespräch bei Familie Steiner. Will Sole/Wasser-WP, Bohrung möglich.", kind: "note" },
    { p: PRJ_1, msg: "Angebot übermittelt: Vitocal 350-G 10kW + Pufferspeicher 800L.", kind: "event" },
    { p: PRJ_1, msg: "Auftrag erteilt — Förderung BAFA wird parallel beantragt.", kind: "event" },
    { p: PRJ_2, msg: "Telefonat mit Frau Hofer — bevorzugt Termin in KW 18.", kind: "call" },
    { p: PRJ_3, msg: "Hotel hat 2 weitere Objekte für 2027 in Aussicht gestellt.", kind: "note" },
  ]) {
    await sql(
      `INSERT INTO logbook_entries (id, tenant_id, entity_type, entity_id, kind, message, author_user_id, occurred_at)
       VALUES (:id, :t, 'project', :e, :k, :m, :u, now())`,
      { id: id("log"), t: TENANT_ID, e: e.p, k: e.kind, m: e.msg, u: USER_OFFICE },
    );
  }

  // ---- 15. Email templates (defaults)
  console.log("  · creating email templates");
  await sql(
    `INSERT INTO email_templates (id, tenant_id, name, context, subject, body_text, variables, is_default)
     VALUES (:id, :t, 'Standard Angebot', 'quote_send',
       'Ihr Angebot {{Document.number}} von {{Company.name}}',
       :body, :vars, true)`,
    {
      id: id("etpl"), t: TENANT_ID,
      body: "Sehr geehrte/r {{Contact.salutation}} {{Contact.lastName}},\n\nim Anhang finden Sie unser Angebot {{Document.number}} vom {{Document.date}}.\nBei Fragen stehen wir gerne zur Verfügung.\n\nMit besten Grüßen\n{{User.name}}\n{{Company.name}}",
      vars: ["Contact.salutation","Contact.lastName","Document.number","Document.date","User.name","Company.name"],
    },
  );

  console.log("Done. Demo tenant ready.");
  console.log("");
  console.log("  Login: admin@demo.heatflow.local / demo1234");
  console.log("  Tenant ID:", TENANT_ID);
}

function dateInDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
