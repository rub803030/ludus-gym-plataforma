-- Ludus GYM · Esquema relacional completo (Fase 1)
-- PostgreSQL 15+ / Supabase. UUIDv7, soft delete, RLS y cifrado en reposo.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- uuid_generate_v7: monotonicidad por tiempo. Se usa como DEFAULT en todas las PK.
CREATE OR REPLACE FUNCTION uuid_generate_v7()
RETURNS uuid LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  unix_ts_ms bigint;
  rand_a int;
  rand_b bigint;
  bytes bytea;
BEGIN
  unix_ts_ms := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
  rand_a := (random() * 4096)::int;
  rand_b := (random() * 9223372036854775807)::bigint;
  bytes := decode(
    lpad(to_hex(unix_ts_ms), 12, '0') ||
    lpad(to_hex(4096 + rand_a), 4, '0') ||
    lpad(to_hex(6148914691236517205 + (rand_b & 4611686018427387903)), 16, '0'),
    'hex'
  );
  RETURN encode(set_byte(set_byte(bytes, 6, (get_byte(bytes, 6) & 15) | 80), 8, (get_byte(bytes, 8) & 63) | 128), 'hex')::uuid;
END;
$$;

-- updated_at automático
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TYPE staff_role AS ENUM ('OWNER', 'MANAGER', 'STAFF');
CREATE TYPE member_status AS ENUM ('ACTIVE', 'PENDING', 'EXPIRED', 'SUSPENDED');
CREATE TYPE payment_method AS ENUM ('cash', 'card', 'transfer');
CREATE TYPE payment_status AS ENUM ('PENDING', 'PAID', 'REFUNDED', 'VOID');
CREATE TYPE access_result AS ENUM ('GRANTED', 'DENIED_EXPIRED', 'DENIED_QR', 'DENIED_CAPACITY', 'OFFLINE_GRANTED');
CREATE TYPE session_status AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE class_booking_status AS ENUM ('BOOKED', 'CANCELLED', 'ATTENDED', 'NO_SHOW');

-- ---------------------------------------------------------------------------
-- Gimnasio (single-tenant hoy, preparado para multi-tenant)
-- ---------------------------------------------------------------------------
CREATE TABLE gyms (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  timezone text NOT NULL DEFAULT 'America/Mexico_City',
  capacity integer NOT NULL CHECK (capacity > 0),
  currency text NOT NULL DEFAULT 'MXN',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE TRIGGER gyms_updated BEFORE UPDATE ON gyms FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Identidad y licencias de equipo
-- ---------------------------------------------------------------------------
CREATE TABLE staff_users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  gym_id uuid NOT NULL REFERENCES gyms(id),
  email citext NOT NULL,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  role staff_role NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  suspended_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT staff_email_per_gym UNIQUE (gym_id, email)
);
CREATE TRIGGER staff_updated BEFORE UPDATE ON staff_users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_staff_gym_role ON staff_users (gym_id, role) WHERE deleted_at IS NULL;

-- Refresh tokens rotativos con detección de reuso
CREATE TABLE refresh_tokens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  staff_id uuid NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  jti uuid NOT NULL UNIQUE DEFAULT uuid_generate_v7(),
  token_hash text NOT NULL,
  family_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_family ON refresh_tokens (family_id, expires_at);

CREATE TABLE member_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  member_id uuid NOT NULL,
  jti uuid NOT NULL UNIQUE DEFAULT uuid_generate_v7(),
  token_hash text NOT NULL,
  device_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Socios
-- ---------------------------------------------------------------------------
CREATE TABLE members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  gym_id uuid NOT NULL REFERENCES gyms(id),
  code text NOT NULL CHECK (code ~ '^LUD-[0-9]{6}$'),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email citext NOT NULL,
  phone text NOT NULL,
  document_type text NOT NULL DEFAULT 'INE',
  document_number text NOT NULL,
  birth_date date NOT NULL,
  -- Datos médicos cifrados con AES-256-GCM a nivel de aplicación (pgcrypto como respaldo)
  medical_notes_cipher bytea,
  allergies_cipher bytea,
  conditions_cipher bytea,
  emergency_contact jsonb NOT NULL DEFAULT '{}'::jsonb,
  status member_status NOT NULL DEFAULT 'PENDING',
  avatar_url text,
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES staff_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT member_code_per_gym UNIQUE (gym_id, code),
  CONSTRAINT member_doc_per_gym UNIQUE (gym_id, document_number),
  CONSTRAINT member_email_per_gym UNIQUE (gym_id, email)
);
CREATE TRIGGER members_updated BEFORE UPDATE ON members FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_members_gym_status ON members (gym_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_members_name_trgm ON members USING gin (to_tsvector('spanish', first_name || ' ' || last_name));

-- ---------------------------------------------------------------------------
-- Planes y memberships
-- ---------------------------------------------------------------------------
CREATE TABLE plans (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  gym_id uuid NOT NULL REFERENCES gyms(id),
  name text NOT NULL,
  description text,
  duration_days integer NOT NULL CHECK (duration_days > 0),
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  currency text NOT NULL DEFAULT 'MXN',
  includes_classes boolean NOT NULL DEFAULT false,
  includes_nutrition boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT plan_name_per_gym UNIQUE (gym_id, name)
);
CREATE TRIGGER plans_updated BEFORE UPDATE ON plans FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE memberships (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES plans(id),
  status member_status NOT NULL DEFAULT 'PENDING',
  start_date date,
  end_date date,
  auto_renew boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_period CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date)
);
CREATE TRIGGER memberships_updated BEFORE UPDATE ON memberships FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE UNIQUE INDEX idx_one_active_membership ON memberships (member_id) WHERE status = 'ACTIVE';
CREATE INDEX idx_memberships_expiring ON memberships (end_date) WHERE status = 'ACTIVE';

-- ---------------------------------------------------------------------------
-- Caja, cobros y recibos
-- ---------------------------------------------------------------------------
CREATE TABLE cash_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  gym_id uuid NOT NULL REFERENCES gyms(id),
  opened_by uuid NOT NULL REFERENCES staff_users(id),
  closed_by uuid REFERENCES staff_users(id),
  status session_status NOT NULL DEFAULT 'OPEN',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opening_amount_cents integer NOT NULL DEFAULT 0,
  closing_amount_cents integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_one_open_cash_session ON cash_sessions (gym_id) WHERE status = 'OPEN';

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  gym_id uuid NOT NULL REFERENCES gyms(id),
  member_id uuid NOT NULL REFERENCES members(id),
  membership_id uuid REFERENCES memberships(id),
  cash_session_id uuid REFERENCES cash_sessions(id),
  plan_id uuid NOT NULL REFERENCES plans(id),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'MXN',
  method payment_method NOT NULL,
  status payment_status NOT NULL DEFAULT 'PENDING',
  idempotency_key text NOT NULL,
  external_reference text,
  receipt_number text NOT NULL,
  receipt_url text,
  created_by uuid NOT NULL REFERENCES staff_users(id),
  refunded_by uuid REFERENCES staff_users(id),
  refunded_at timestamptz,
  refund_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_idempotency UNIQUE (gym_id, idempotency_key),
  CONSTRAINT receipt_per_gym UNIQUE (gym_id, receipt_number)
);
CREATE INDEX idx_payments_member ON payments (member_id, created_at DESC);
CREATE INDEX idx_payments_session ON payments (cash_session_id, created_at DESC) WHERE status = 'PAID';

-- Asientos inmutables: todo movimiento de caja queda registrado
CREATE TABLE cash_movements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  cash_session_id uuid NOT NULL REFERENCES cash_sessions(id),
  payment_id uuid REFERENCES payments(id),
  kind text NOT NULL CHECK (kind IN ('INCOME', 'REFUND', 'EXPENSE', 'ADJUSTMENT')),
  amount_cents integer NOT NULL,
  concept text NOT NULL,
  created_by uuid NOT NULL REFERENCES staff_users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cash_movements_session ON cash_movements (cash_session_id, created_at);

-- ---------------------------------------------------------------------------
-- Control de acceso
-- ---------------------------------------------------------------------------
CREATE TABLE access_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  gym_id uuid NOT NULL REFERENCES gyms(id),
  member_id uuid NOT NULL REFERENCES members(id),
  qr_bucket bigint NOT NULL,
  result access_result NOT NULL,
  offline_synced boolean NOT NULL DEFAULT false,
  device_id text,
  checked_by uuid REFERENCES staff_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT access_event_dedupe UNIQUE (member_id, qr_bucket, result)
);
CREATE INDEX idx_access_member_recent ON access_events (member_id, created_at DESC);
CREATE INDEX idx_access_gym_today ON access_events (gym_id, created_at DESC);

CREATE TABLE occupancy_snapshots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  gym_id uuid NOT NULL REFERENCES gyms(id),
  count integer NOT NULL CHECK (count >= 0),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_occupancy_gym_time ON occupancy_snapshots (gym_id, recorded_at DESC);

-- ---------------------------------------------------------------------------
-- Entrenamiento y nutrición
-- ---------------------------------------------------------------------------
CREATE TABLE routines (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  gym_id uuid NOT NULL REFERENCES gyms(id),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  title text NOT NULL,
  notes text,
  assigned_by uuid REFERENCES staff_users(id),
  week_start date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE TRIGGER routines_updated BEFORE UPDATE ON routines FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE routine_exercises (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  routine_id uuid NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  name text NOT NULL,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  sets integer NOT NULL CHECK (sets > 0),
  reps integer NOT NULL CHECK (reps > 0),
  rest_seconds integer NOT NULL DEFAULT 60,
  notes text,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE INDEX idx_exercises_routine_day ON routine_exercises (routine_id, day_of_week, sort_order);

CREATE TABLE workout_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES routine_exercises(id) ON DELETE CASCADE,
  weight_kg numeric(6,2) CHECK (weight_kg >= 0),
  reps_done integer CHECK (reps_done >= 0),
  rpe smallint CHECK (rpe BETWEEN 1 AND 10),
  performed_at timestamptz NOT NULL DEFAULT now(),
  synced_from_device boolean NOT NULL DEFAULT false
);
CREATE INDEX idx_workout_member_time ON workout_logs (member_id, performed_at DESC);

CREATE TABLE nutrition_plans (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  gym_id uuid NOT NULL REFERENCES gyms(id),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  title text NOT NULL,
  calories integer NOT NULL CHECK (calories > 0),
  protein_g integer NOT NULL CHECK (protein_g >= 0),
  carbs_g integer NOT NULL CHECK (carbs_g >= 0),
  fat_g integer NOT NULL CHECK (fat_g >= 0),
  assigned_by uuid REFERENCES staff_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE TRIGGER nutrition_updated BEFORE UPDATE ON nutrition_plans FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE meals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  plan_id uuid NOT NULL REFERENCES nutrition_plans(id) ON DELETE CASCADE,
  name text NOT NULL,
  meal_time text NOT NULL CHECK (meal_time IN ('breakfast','lunch','dinner','snack')),
  calories integer NOT NULL CHECK (calories >= 0),
  protein_g integer NOT NULL DEFAULT 0,
  carbs_g integer NOT NULL DEFAULT 0,
  fat_g integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- Clases (Hyrox) y reservas
-- ---------------------------------------------------------------------------
CREATE TABLE classes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  gym_id uuid NOT NULL REFERENCES gyms(id),
  title text NOT NULL,
  coach_id uuid REFERENCES staff_users(id),
  starts_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  capacity integer NOT NULL CHECK (capacity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_classes_upcoming ON classes (gym_id, starts_at);

CREATE TABLE class_bookings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  status class_booking_status NOT NULL DEFAULT 'BOOKED',
  booked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_once UNIQUE (class_id, member_id)
);

-- ---------------------------------------------------------------------------
-- Inventario y almacenamiento
-- ---------------------------------------------------------------------------
CREATE TABLE inventory_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  gym_id uuid NOT NULL REFERENCES gyms(id),
  sku text NOT NULL,
  name text NOT NULL,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit_cost_cents integer NOT NULL DEFAULT 0,
  reorder_level integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT sku_per_gym UNIQUE (gym_id, sku)
);

CREATE TABLE uploads (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  gym_id uuid NOT NULL REFERENCES gyms(id),
  uploaded_by uuid NOT NULL REFERENCES staff_users(id),
  object_key text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes > 0),
  sha256 text NOT NULL,
  purpose text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Auditoría
-- ---------------------------------------------------------------------------
CREATE TABLE audit_logs (
  id bigserial NOT NULL,
  gym_id uuid NOT NULL REFERENCES gyms(id),
  actor_id uuid,
  actor_role text,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  before jsonb,
  after jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_logs_2026_q1 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');
CREATE TABLE audit_logs_2026_q2 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-04-01') TO ('2026-07-01');
CREATE TABLE audit_logs_2026_q3 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-07-01') TO ('2026-10-01');
CREATE TABLE audit_logs_2026_q4 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-10-01') TO ('2027-01-01');
CREATE INDEX idx_audit_id ON audit_logs (id);
CREATE INDEX idx_audit_gym_time ON audit_logs (gym_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_logs (entity, entity_id);

-- ---------------------------------------------------------------------------
-- Row Level Security: defensa en profundidad además del RBAC de aplicación
-- ---------------------------------------------------------------------------
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY members_by_gym ON members
  USING (gym_id = current_setting('app.gym_id', true)::uuid);
CREATE POLICY payments_by_gym ON payments
  USING (gym_id = current_setting('app.gym_id', true)::uuid);
CREATE POLICY access_by_gym ON access_events
  USING (gym_id = current_setting('app.gym_id', true)::uuid);
