CREATE TABLE IF NOT EXISTS public.pos_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  capacity integer NOT NULL DEFAULT 2,
  status text NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  phone text NOT NULL,
  party_size integer NOT NULL CHECK (party_size > 0),
  reserved_for timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 90 CHECK (duration_minutes > 0),
  table_id uuid REFERENCES public.pos_tables(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','arrived','completed','cancelled','no_show')),
  source text NOT NULL DEFAULT 'staff' CHECK (source IN ('staff','phone','online','walk_in')),
  special_requests text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.table_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.pos_tables(id) ON DELETE RESTRICT,
  customer_name text NOT NULL DEFAULT 'Walk-in',
  phone text,
  guest_count integer NOT NULL CHECK (guest_count > 0),
  seated_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','bill_requested','closed')),
  notes text NOT NULL DEFAULT '',
  bill_requested_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.session_tables (
  session_id uuid NOT NULL REFERENCES public.table_sessions(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES public.pos_tables(id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, table_id)
);

CREATE TABLE IF NOT EXISTS public.table_session_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.table_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reservations_reserved_for_idx ON public.reservations (reserved_for);
CREATE INDEX IF NOT EXISTS reservations_table_status_idx ON public.reservations (table_id, status);
CREATE INDEX IF NOT EXISTS table_sessions_table_status_idx ON public.table_sessions (table_id, status);

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_session_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reservations_staff_all ON public.reservations;
CREATE POLICY reservations_staff_all ON public.reservations FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('cashier','manager','admin'))) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('cashier','manager','admin')));
DROP POLICY IF EXISTS table_sessions_staff_all ON public.table_sessions;
CREATE POLICY table_sessions_staff_all ON public.table_sessions FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('cashier','manager','admin'))) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('cashier','manager','admin')));
DROP POLICY IF EXISTS session_tables_staff_all ON public.session_tables;
CREATE POLICY session_tables_staff_all ON public.session_tables FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('cashier','manager','admin'))) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('cashier','manager','admin')));
DROP POLICY IF EXISTS table_session_events_staff_all ON public.table_session_events;
CREATE POLICY table_session_events_staff_all ON public.table_session_events FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('cashier','manager','admin'))) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('cashier','manager','admin')));

DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['pos_tables', 'reservations', 'table_sessions'] LOOP
      IF to_regclass('public.' || t) IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;

COMMENT ON TABLE public.reservations IS 'Staff-managed guest reservations for POS floor operations.';
COMMENT ON TABLE public.table_sessions IS 'Open and recently closed guest sessions attached to POS tables.';
COMMENT ON TABLE public.session_tables IS 'Table assignments for a guest session.';
COMMENT ON TABLE public.table_session_events IS 'Audit trail for table session lifecycle events.';

