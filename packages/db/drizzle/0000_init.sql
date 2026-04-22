-- =============================================================================
-- HeatFlow — Initial schema (matches packages/db/src/schema/*.ts)
-- Generated for Supabase Postgres 17. Idempotent on first run.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- TENANTS / USERS / SESSIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  legal_name      text,
  slug            text NOT NULL,
  country         text NOT NULL DEFAULT 'AT',
  currency        text NOT NULL DEFAULT 'EUR',
  locale          text NOT NULL DEFAULT 'de-AT',
  vat_id          text,
  address_street  text,
  address_zip     text,
  address_city    text,
  address_country text DEFAULT 'AT',
  email           text,
  phone           text,
  website         text,
  iban            text,
  bic             text,
  bank_name       text,
  logo_url        text,
  primary_color   text DEFAULT '#1e6fff',
  settings        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_idx ON tenants(slug);

CREATE TABLE IF NOT EXISTS users (
  id                 text PRIMARY KEY,
  tenant_id          text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email              text NOT NULL,
  name               text NOT NULL,
  password_hash      text,
  role               text NOT NULL DEFAULT 'technician',
  avatar_url         text,
  phone              text,
  active             boolean NOT NULL DEFAULT true,
  two_factor_secret  text,
  last_login_at      timestamptz,
  settings           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);
CREATE INDEX IF NOT EXISTS users_tenant_idx ON users(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_uq ON users(email);

CREATE TABLE IF NOT EXISTS tenant_features (
  tenant_id      text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  feature_key    text NOT NULL,
  active         boolean NOT NULL DEFAULT true,
  valid_until    timestamptz,
  price_monthly  numeric(10,2),
  activated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, feature_key)
);

CREATE TABLE IF NOT EXISTS sessions (
  id             text PRIMARY KEY,
  user_id        text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token  text NOT NULL,
  expires_at     timestamptz NOT NULL,
  user_agent     text,
  ip             text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_uq ON sessions(session_token);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier  text NOT NULL,
  token       text NOT NULL,
  expires     timestamptz NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- ----------------------------------------------------------------------------
-- TAGS / CONTACTS / ADDRESSES / PERSONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tags (
  id          text PRIMARY KEY,
  tenant_id   text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  color       text DEFAULT '#6366f1',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
CREATE INDEX IF NOT EXISTS tags_tenant_idx ON tags(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS tags_tenant_name_uq ON tags(tenant_id, name);

CREATE TABLE IF NOT EXISTS contacts (
  id                    text PRIMARY KEY,
  tenant_id             text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type                  text NOT NULL DEFAULT 'customer',
  kind                  text NOT NULL DEFAULT 'person',
  customer_number       text,
  salutation            text,
  title                 text,
  first_name            text,
  last_name             text,
  company_name          text,
  email                 text,
  phone                 text,
  mobile                text,
  fax                   text,
  website               text,
  birthday              date,
  category              text,
  source                text,
  payment_terms_days    integer NOT NULL DEFAULT 14,
  discount_pct          numeric(5,2) NOT NULL DEFAULT 0,
  skonto_pct            numeric(5,2) NOT NULL DEFAULT 0,
  skonto_days           integer NOT NULL DEFAULT 0,
  iban                  text,
  bic                   text,
  bank_name             text,
  vat_id                text,
  leitweg_id            text,
  debitor_account       text,
  creditor_account      text,
  is_invoice_recipient  boolean DEFAULT true,
  notes                 text,
  custom_fields         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id    text REFERENCES users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);
CREATE INDEX IF NOT EXISTS contacts_tenant_idx ON contacts(tenant_id);
CREATE INDEX IF NOT EXISTS contacts_type_idx ON contacts(tenant_id, type);
CREATE INDEX IF NOT EXISTS contacts_name_idx ON contacts(tenant_id, last_name, company_name);
CREATE UNIQUE INDEX IF NOT EXISTS contacts_customer_number_uq ON contacts(tenant_id, customer_number);

CREATE TABLE IF NOT EXISTS contact_addresses (
  id          text PRIMARY KEY,
  tenant_id   text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id  text NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  kind        text NOT NULL DEFAULT 'main',
  label       text,
  street      text,
  zip         text,
  city        text,
  country     text DEFAULT 'AT',
  lat         numeric(10,7),
  lng         numeric(10,7),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
CREATE INDEX IF NOT EXISTS contact_addresses_contact_idx ON contact_addresses(contact_id);

CREATE TABLE IF NOT EXISTS contact_persons (
  id          text PRIMARY KEY,
  tenant_id   text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id  text NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  salutation  text,
  first_name  text,
  last_name   text,
  position    text,
  email       text,
  phone       text,
  mobile      text,
  is_primary  boolean DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
CREATE INDEX IF NOT EXISTS contact_persons_contact_idx ON contact_persons(contact_id);

CREATE TABLE IF NOT EXISTS contact_tags (
  contact_id  text NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tag_id      text NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, tag_id)
);

-- ----------------------------------------------------------------------------
-- ARTICLES / SERVICES / PRICE LISTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS article_groups (
  id          text PRIMARY KEY,
  tenant_id   text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  parent_id   text,
  name        text NOT NULL,
  order_num   integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
CREATE INDEX IF NOT EXISTS article_groups_tenant_idx ON article_groups(tenant_id);

CREATE TABLE IF NOT EXISTS articles (
  id                    text PRIMARY KEY,
  tenant_id             text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id           text REFERENCES contacts(id) ON DELETE SET NULL,
  group_id              text REFERENCES article_groups(id) ON DELETE SET NULL,
  number                text,
  ean                   text,
  name                  text NOT NULL,
  short_text            text,
  long_text             text,
  unit                  text NOT NULL DEFAULT 'Stk',
  purchase_price        numeric(12,4) NOT NULL DEFAULT 0,
  list_price            numeric(12,4) NOT NULL DEFAULT 0,
  sale_price            numeric(12,4) NOT NULL DEFAULT 0,
  vat_pct               numeric(5,2) NOT NULL DEFAULT 20,
  manufacturer          text,
  manufacturer_number   text,
  stock                 numeric(12,3) NOT NULL DEFAULT 0,
  min_order_qty         numeric(12,3),
  delivery_days         integer,
  image_url             text,
  is_imported           boolean NOT NULL DEFAULT false,
  import_source         text,
  matchcode             text,
  custom_fields         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);
CREATE INDEX IF NOT EXISTS articles_tenant_idx ON articles(tenant_id);
CREATE INDEX IF NOT EXISTS articles_number_idx ON articles(tenant_id, number);
CREATE INDEX IF NOT EXISTS articles_name_idx ON articles(tenant_id, name);

CREATE TABLE IF NOT EXISTS services (
  id              text PRIMARY KEY,
  tenant_id       text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  number          text,
  name            text NOT NULL,
  description     text,
  calculation     jsonb NOT NULL DEFAULT '{}'::jsonb,
  purchase_cost   numeric(12,4) NOT NULL DEFAULT 0,
  sale_price      numeric(12,4) NOT NULL DEFAULT 0,
  vat_pct         numeric(5,2) NOT NULL DEFAULT 20,
  unit            text DEFAULT 'Stk',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS services_tenant_idx ON services(tenant_id);

CREATE TABLE IF NOT EXISTS price_lists (
  id           text PRIMARY KEY,
  tenant_id    text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         text NOT NULL,
  is_default   boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);
CREATE INDEX IF NOT EXISTS price_lists_tenant_idx ON price_lists(tenant_id);

CREATE TABLE IF NOT EXISTS price_list_items (
  price_list_id  text NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
  article_id     text NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  price          numeric(12,4) NOT NULL,
  valid_from     text,
  PRIMARY KEY (price_list_id, article_id)
);

-- ----------------------------------------------------------------------------
-- PROJECTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_types (
  id              text PRIMARY KEY,
  tenant_id       text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            text NOT NULL,
  color           text DEFAULT '#3b82f6',
  trade           text,
  default_stages  jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS project_types_tenant_idx ON project_types(tenant_id);

CREATE TABLE IF NOT EXISTS projects (
  id                    text PRIMARY KEY,
  tenant_id             text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  number                text NOT NULL,
  title                 text NOT NULL,
  status                text NOT NULL DEFAULT 'lead',
  contact_id            text NOT NULL REFERENCES contacts(id),
  address_id            text REFERENCES contact_addresses(id),
  project_type_id       text REFERENCES project_types(id),
  trade                 text,
  branch_id             text,
  start_date            date,
  end_date              date,
  potential_value       numeric(12,2),
  actual_value          numeric(12,2),
  source                text,
  description           text,
  responsible_user_id   text REFERENCES users(id) ON DELETE SET NULL,
  reminder_at           timestamptz,
  custom_fields         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);
CREATE INDEX IF NOT EXISTS projects_tenant_idx ON projects(tenant_id);
CREATE INDEX IF NOT EXISTS projects_status_idx ON projects(tenant_id, status);
CREATE INDEX IF NOT EXISTS projects_contact_idx ON projects(contact_id);

CREATE TABLE IF NOT EXISTS project_stages (
  id          text PRIMARY KEY,
  project_id  text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        text NOT NULL,
  order_num   integer NOT NULL DEFAULT 0,
  status      text NOT NULL DEFAULT 'pending',
  entered_at  timestamptz,
  left_at     timestamptz
);
CREATE INDEX IF NOT EXISTS project_stages_project_idx ON project_stages(project_id);

CREATE TABLE IF NOT EXISTS project_participants (
  project_id  text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'member',
  PRIMARY KEY (project_id, user_id)
);

-- ----------------------------------------------------------------------------
-- DOCUMENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
  id                       text PRIMARY KEY,
  tenant_id                text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type                     text NOT NULL,
  number                   text NOT NULL,
  title                    text,
  contact_id               text NOT NULL REFERENCES contacts(id),
  address_id               text REFERENCES contact_addresses(id),
  project_id               text REFERENCES projects(id) ON DELETE SET NULL,
  reference_document_id    text,
  document_date            date NOT NULL,
  due_date                 date,
  sent_at                  timestamptz,
  status                   text NOT NULL DEFAULT 'draft',
  currency                 text NOT NULL DEFAULT 'EUR',
  intro_text               text,
  closing_text             text,
  total_net                numeric(12,2) NOT NULL DEFAULT 0,
  total_vat                numeric(12,2) NOT NULL DEFAULT 0,
  total_gross              numeric(12,2) NOT NULL DEFAULT 0,
  locked                   boolean NOT NULL DEFAULT false,
  locked_at                timestamptz,
  locked_by_user_id        text REFERENCES users(id) ON DELETE SET NULL,
  pdf_storage_key          text,
  custom_fields            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id       text REFERENCES users(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  deleted_at               timestamptz
);
CREATE INDEX IF NOT EXISTS documents_tenant_idx ON documents(tenant_id);
CREATE INDEX IF NOT EXISTS documents_type_status_idx ON documents(tenant_id, type, status);
CREATE INDEX IF NOT EXISTS documents_contact_idx ON documents(contact_id);
CREATE INDEX IF NOT EXISTS documents_project_idx ON documents(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS documents_number_uq ON documents(tenant_id, number);

CREATE TABLE IF NOT EXISTS document_positions (
  id                   text PRIMARY KEY,
  tenant_id            text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_id          text NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  parent_position_id   text,
  order_num            integer NOT NULL DEFAULT 0,
  kind                 text NOT NULL DEFAULT 'article',
  article_id           text REFERENCES articles(id) ON DELETE SET NULL,
  service_id           text REFERENCES services(id) ON DELETE SET NULL,
  position_number      text,
  description          text NOT NULL DEFAULT '',
  quantity             numeric(12,3) NOT NULL DEFAULT 1,
  unit                 text NOT NULL DEFAULT 'Stk',
  unit_price           numeric(12,4) NOT NULL DEFAULT 0,
  discount_pct         numeric(5,2) NOT NULL DEFAULT 0,
  vat_pct              numeric(5,2) NOT NULL DEFAULT 20,
  total_net            numeric(12,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS document_positions_document_idx ON document_positions(document_id);
CREATE INDEX IF NOT EXISTS document_positions_order_idx ON document_positions(document_id, order_num);

CREATE TABLE IF NOT EXISTS document_versions (
  id                   text PRIMARY KEY,
  tenant_id            text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_id          text NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version              integer NOT NULL,
  snapshot             jsonb NOT NULL,
  created_by_user_id   text REFERENCES users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS document_versions_document_idx ON document_versions(document_id);

CREATE TABLE IF NOT EXISTS document_templates (
  id            text PRIMARY KEY,
  tenant_id     text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          text NOT NULL,
  type          text,
  intro_text    text,
  closing_text  text,
  layout        jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE INDEX IF NOT EXISTS document_templates_tenant_idx ON document_templates(tenant_id);

-- ----------------------------------------------------------------------------
-- TIME TRACKING
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS time_categories (
  id          text PRIMARY KEY,
  tenant_id   text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  color       text DEFAULT '#10b981',
  billable    boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
CREATE INDEX IF NOT EXISTS time_categories_tenant_idx ON time_categories(tenant_id);

CREATE TABLE IF NOT EXISTS wage_groups (
  id           text PRIMARY KEY,
  tenant_id    text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         text NOT NULL,
  hourly_rate  numeric(12,2) NOT NULL DEFAULT 0,
  hourly_cost  numeric(12,2) NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);
CREATE INDEX IF NOT EXISTS wage_groups_tenant_idx ON wage_groups(tenant_id);

CREATE TABLE IF NOT EXISTS time_entries (
  id                    text PRIMARY KEY,
  tenant_id             text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id               text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id            text REFERENCES projects(id) ON DELETE SET NULL,
  task_id               text,
  activity_type         text NOT NULL DEFAULT 'work',
  category_id           text REFERENCES time_categories(id) ON DELETE SET NULL,
  started_at            timestamptz NOT NULL,
  ended_at              timestamptz,
  break_minutes         integer NOT NULL DEFAULT 0,
  duration_minutes      integer,
  billable              boolean NOT NULL DEFAULT true,
  comment               text,
  approved_by_user_id   text REFERENCES users(id) ON DELETE SET NULL,
  approved_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);
CREATE INDEX IF NOT EXISTS time_entries_tenant_idx ON time_entries(tenant_id);
CREATE INDEX IF NOT EXISTS time_entries_user_idx ON time_entries(tenant_id, user_id, started_at);
CREATE INDEX IF NOT EXISTS time_entries_project_idx ON time_entries(project_id);

CREATE TABLE IF NOT EXISTS absences (
  id                    text PRIMARY KEY,
  tenant_id             text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id               text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind                  text NOT NULL,
  from_date             date NOT NULL,
  to_date               date NOT NULL,
  note                  text,
  approved_by_user_id   text REFERENCES users(id) ON DELETE SET NULL,
  approved_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);
CREATE INDEX IF NOT EXISTS absences_user_idx ON absences(user_id);

-- ----------------------------------------------------------------------------
-- TASKS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id                  text PRIMARY KEY,
  tenant_id           text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id          text REFERENCES projects(id) ON DELETE CASCADE,
  contact_id          text REFERENCES contacts(id) ON DELETE SET NULL,
  parent_task_id      text,
  title               text NOT NULL,
  description         text,
  due_date            date,
  assigned_user_id    text REFERENCES users(id) ON DELETE SET NULL,
  status              text NOT NULL DEFAULT 'open',
  priority            text NOT NULL DEFAULT 'normal',
  order_num           integer DEFAULT 0,
  completed_at        text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);
CREATE INDEX IF NOT EXISTS tasks_tenant_idx ON tasks(tenant_id);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(tenant_id, status);
CREATE INDEX IF NOT EXISTS tasks_project_idx ON tasks(project_id);
CREATE INDEX IF NOT EXISTS tasks_assigned_idx ON tasks(assigned_user_id);

CREATE TABLE IF NOT EXISTS task_templates (
  id                  text PRIMARY KEY,
  tenant_id           text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                text NOT NULL,
  description         text,
  default_due_days    integer DEFAULT 7,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);
CREATE INDEX IF NOT EXISTS task_templates_tenant_idx ON task_templates(tenant_id);

-- ----------------------------------------------------------------------------
-- FILES / FOLDERS / LOGBOOK
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS folders (
  id            text PRIMARY KEY,
  tenant_id     text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  parent_id     text,
  name          text NOT NULL,
  entity_type   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE INDEX IF NOT EXISTS folders_tenant_idx ON folders(tenant_id);

CREATE TABLE IF NOT EXISTS files (
  id                     text PRIMARY KEY,
  tenant_id              text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id             text REFERENCES projects(id) ON DELETE CASCADE,
  contact_id             text REFERENCES contacts(id) ON DELETE CASCADE,
  folder_id              text REFERENCES folders(id) ON DELETE SET NULL,
  filename               text NOT NULL,
  mime_type              text NOT NULL,
  size                   integer NOT NULL DEFAULT 0,
  storage_bucket         text NOT NULL,
  storage_key            text NOT NULL,
  uploaded_by_user_id    text REFERENCES users(id) ON DELETE SET NULL,
  label                  text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  deleted_at             timestamptz
);
CREATE INDEX IF NOT EXISTS files_tenant_idx ON files(tenant_id);
CREATE INDEX IF NOT EXISTS files_project_idx ON files(project_id);
CREATE INDEX IF NOT EXISTS files_contact_idx ON files(contact_id);

CREATE TABLE IF NOT EXISTS logbook_entries (
  id                  text PRIMARY KEY,
  tenant_id           text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type         text NOT NULL,
  entity_id           text NOT NULL,
  kind                text NOT NULL DEFAULT 'note',
  message             text NOT NULL,
  payload             jsonb NOT NULL DEFAULT '{}'::jsonb,
  author_user_id      text REFERENCES users(id) ON DELETE SET NULL,
  visibility_roles    jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_system_event     boolean NOT NULL DEFAULT false,
  occurred_at         timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);
CREATE INDEX IF NOT EXISTS logbook_tenant_idx ON logbook_entries(tenant_id);
CREATE INDEX IF NOT EXISTS logbook_entity_idx ON logbook_entries(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS logbook_occurred_at_idx ON logbook_entries(occurred_at);

-- ----------------------------------------------------------------------------
-- MODULE: M3 — Wartung & Anlagen
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assets (
  id                     text PRIMARY KEY,
  tenant_id              text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id             text REFERENCES contacts(id) ON DELETE CASCADE,
  project_id             text REFERENCES projects(id) ON DELETE SET NULL,
  asset_type             text NOT NULL,
  brand                  text,
  model                  text,
  serial_number          text,
  installation_date      date,
  warranty_until         date,
  location_description   text,
  power_kw               numeric(8,2),
  cop                    numeric(4,2),
  refrigerant            text,
  sound_level_db         numeric(5,1),
  custom_fields          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  deleted_at             timestamptz
);
CREATE INDEX IF NOT EXISTS assets_contact_idx ON assets(contact_id);
CREATE INDEX IF NOT EXISTS assets_serial_idx ON assets(tenant_id, serial_number);

CREATE TABLE IF NOT EXISTS maintenance_contracts (
  id                text PRIMARY KEY,
  tenant_id         text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id        text NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  asset_id          text REFERENCES assets(id) ON DELETE SET NULL,
  name              text NOT NULL,
  interval_months   integer NOT NULL DEFAULT 12,
  next_due_date     date,
  price             numeric(12,2) NOT NULL DEFAULT 0,
  start_date        date,
  end_date          date,
  auto_renewal      boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);
CREATE INDEX IF NOT EXISTS maintenance_contact_idx ON maintenance_contracts(contact_id);
CREATE INDEX IF NOT EXISTS maintenance_next_due_idx ON maintenance_contracts(next_due_date);

CREATE TABLE IF NOT EXISTS maintenance_visits (
  id                       text PRIMARY KEY,
  tenant_id                text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contract_id              text NOT NULL REFERENCES maintenance_contracts(id) ON DELETE CASCADE,
  scheduled_at             timestamptz NOT NULL,
  completed_at             timestamptz,
  technician_user_id       text REFERENCES users(id) ON DELETE SET NULL,
  protocol                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  issues_found             text,
  follow_up_required       boolean NOT NULL DEFAULT false,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  deleted_at               timestamptz
);
CREATE INDEX IF NOT EXISTS maintenance_visits_contract_idx ON maintenance_visits(contract_id);

-- ----------------------------------------------------------------------------
-- MODULE: M5 — Projekt-Kalkulation
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_calculations (
  project_id              text PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id               text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  planned_hours           numeric(10,2) NOT NULL DEFAULT 0,
  planned_material_cost   numeric(12,2) NOT NULL DEFAULT 0,
  planned_total_cost      numeric(12,2) NOT NULL DEFAULT 0,
  planned_revenue         numeric(12,2) NOT NULL DEFAULT 0,
  actual_hours            numeric(10,2) NOT NULL DEFAULT 0,
  actual_material_cost    numeric(12,2) NOT NULL DEFAULT 0,
  actual_total_cost       numeric(12,2) NOT NULL DEFAULT 0,
  actual_revenue          numeric(12,2) NOT NULL DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  deleted_at              timestamptz
);

-- ----------------------------------------------------------------------------
-- MODULE: M6 — Lager
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS warehouses (
  id          text PRIMARY KEY,
  tenant_id   text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  address     text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
CREATE INDEX IF NOT EXISTS warehouses_tenant_idx ON warehouses(tenant_id);

CREATE TABLE IF NOT EXISTS stock_items (
  id              text PRIMARY KEY,
  tenant_id       text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  warehouse_id    text NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  article_id      text NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  quantity        numeric(12,3) NOT NULL DEFAULT 0,
  reserved        numeric(12,3) NOT NULL DEFAULT 0,
  min_stock       numeric(12,3),
  location_code   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS stock_items_warehouse_idx ON stock_items(warehouse_id);

CREATE TABLE IF NOT EXISTS stock_movements (
  id              text PRIMARY KEY,
  tenant_id       text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stock_item_id   text NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  kind            text NOT NULL,
  quantity        numeric(12,3) NOT NULL,
  reference_doc   text,
  user_id         text REFERENCES users(id) ON DELETE SET NULL,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stock_movements_item_idx ON stock_movements(stock_item_id);

-- ----------------------------------------------------------------------------
-- MODULE: M7 — Förderung
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS funding_programs (
  id            text PRIMARY KEY,
  name          text NOT NULL,
  country       text NOT NULL,
  region        text,
  description   text,
  max_amount    numeric(12,2),
  requirements  jsonb NOT NULL DEFAULT '{}'::jsonb,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

CREATE TABLE IF NOT EXISTS funding_applications (
  id                  text PRIMARY KEY,
  tenant_id           text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id          text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  program_id          text NOT NULL REFERENCES funding_programs(id),
  status              text NOT NULL DEFAULT 'draft',
  submitted_at        timestamptz,
  approved_at         timestamptz,
  paid_at             timestamptz,
  amount_requested    numeric(12,2),
  amount_approved     numeric(12,2),
  document_ids        jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);
CREATE INDEX IF NOT EXISTS funding_applications_project_idx ON funding_applications(project_id);

-- ----------------------------------------------------------------------------
-- MODULE: M13 — Checklisten
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS checklist_templates (
  id            text PRIMARY KEY,
  tenant_id     text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          text NOT NULL,
  entity_type   text NOT NULL,
  items         jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE INDEX IF NOT EXISTS checklist_templates_tenant_idx ON checklist_templates(tenant_id);

CREATE TABLE IF NOT EXISTS checklist_instances (
  id                       text PRIMARY KEY,
  tenant_id                text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id              text NOT NULL REFERENCES checklist_templates(id),
  entity_type              text NOT NULL,
  entity_id                text NOT NULL,
  items_state              jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at             timestamptz,
  completed_by_user_id     text REFERENCES users(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  deleted_at               timestamptz
);

-- ----------------------------------------------------------------------------
-- MODULE: M14 — Kanban + Projekt-Chat
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kanban_boards (
  id          text PRIMARY KEY,
  tenant_id   text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  columns     jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE TABLE IF NOT EXISTS project_messages (
  id              text PRIMARY KEY,
  tenant_id       text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id      text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id         text REFERENCES users(id) ON DELETE SET NULL,
  external_email  text,
  message         text NOT NULL,
  attachments     jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_messages_project_idx ON project_messages(project_id);

-- ----------------------------------------------------------------------------
-- AUDIT / NOTIFICATIONS / EMAIL
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id            text PRIMARY KEY,
  tenant_id     text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       text REFERENCES users(id) ON DELETE SET NULL,
  entity_type   text NOT NULL,
  entity_id     text NOT NULL,
  action        text NOT NULL,
  before        jsonb,
  after         jsonb,
  ip            text,
  user_agent    text,
  at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_tenant_idx ON audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_log_at_idx ON audit_log(at);

CREATE TABLE IF NOT EXISTS notifications (
  id            text PRIMARY KEY,
  tenant_id     text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind          text NOT NULL,
  title         text NOT NULL,
  body          text,
  entity_type   text,
  entity_id     text,
  read_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, read_at);

CREATE TABLE IF NOT EXISTS email_templates (
  id           text PRIMARY KEY,
  tenant_id    text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         text NOT NULL,
  context      text,
  subject      text NOT NULL,
  body_html    text,
  body_text    text,
  variables    jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default   boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);
CREATE INDEX IF NOT EXISTS email_templates_tenant_idx ON email_templates(tenant_id);

CREATE TABLE IF NOT EXISTS email_outbox (
  id              text PRIMARY KEY,
  tenant_id       text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  to_address      text NOT NULL,
  from_address    text NOT NULL,
  subject         text NOT NULL,
  body            text NOT NULL,
  status          text NOT NULL DEFAULT 'pending',
  sent_at         timestamptz,
  attempts        integer NOT NULL DEFAULT 0,
  error           text,
  message_id      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_outbox_status_idx ON email_outbox(status);

-- ----------------------------------------------------------------------------
-- pg_trgm for fast fuzzy search (Postgres extension, free)
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS contacts_search_trgm
  ON contacts USING gin ((coalesce(company_name,'') || ' ' || coalesce(first_name,'') || ' ' || coalesce(last_name,'') || ' ' || coalesce(email,'')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS articles_search_trgm
  ON articles USING gin ((coalesce(name,'') || ' ' || coalesce(number,'') || ' ' || coalesce(manufacturer_number,'')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS projects_search_trgm
  ON projects USING gin ((coalesce(title,'') || ' ' || coalesce(number,'')) gin_trgm_ops);
