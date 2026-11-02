ALTER TABLE public.coffee_bills
    ADD COLUMN IF NOT EXISTS cashier_id UUID REFERENCES auth.users(id);

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_allowed CHECK (role IN ('cashier', 'manager', 'admin')) NOT VALID;

CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role AND auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Role changes require privileged administration';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_role_change_guard ON public.profiles;
CREATE TRIGGER profiles_role_change_guard
    BEFORE UPDATE OF role ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_role_escalation();

DROP POLICY IF EXISTS "Allow public read active coffee products" ON public.coffee_products;
DROP POLICY IF EXISTS "Allow admin full access to coffee products" ON public.coffee_products;
CREATE POLICY coffee_products_staff_read
    ON public.coffee_products FOR SELECT TO authenticated
    USING (
        status = 'active'
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role IN ('manager', 'admin')
        )
    );
CREATE POLICY coffee_products_admin_write
    ON public.coffee_products FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ));

DROP POLICY IF EXISTS "Allow authenticated read coffee bills" ON public.coffee_bills;
DROP POLICY IF EXISTS "Allow authenticated insert/update/delete coffee bills" ON public.coffee_bills;
CREATE POLICY coffee_bills_staff_read
    ON public.coffee_bills FOR SELECT TO authenticated
    USING (
        cashier_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role IN ('manager', 'admin')
        )
    );
CREATE POLICY coffee_bills_staff_insert
    ON public.coffee_bills FOR INSERT TO authenticated
    WITH CHECK (
        cashier_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role IN ('cashier', 'manager', 'admin')
        )
    );
CREATE POLICY coffee_bills_manager_update
    ON public.coffee_bills FOR UPDATE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role IN ('manager', 'admin')
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role IN ('manager', 'admin')
    ));
CREATE POLICY coffee_bills_manager_delete
    ON public.coffee_bills FOR DELETE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role IN ('manager', 'admin')
    ));

DROP POLICY IF EXISTS "Allow authenticated read coffee bill items" ON public.coffee_bill_items;
DROP POLICY IF EXISTS "Allow authenticated insert/update/delete coffee bill items" ON public.coffee_bill_items;
CREATE POLICY coffee_bill_items_staff_read
    ON public.coffee_bill_items FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.coffee_bills
        WHERE coffee_bills.id = coffee_bill_items.bill_id
    ));
CREATE POLICY coffee_bill_items_staff_insert
    ON public.coffee_bill_items FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.coffee_bills
        WHERE coffee_bills.id = coffee_bill_items.bill_id
          AND (
              coffee_bills.cashier_id = auth.uid()
              OR EXISTS (
                  SELECT 1 FROM public.profiles
                  WHERE profiles.id = auth.uid() AND profiles.role IN ('manager', 'admin')
              )
          )
    ));
CREATE POLICY coffee_bill_items_manager_update
    ON public.coffee_bill_items FOR UPDATE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.coffee_bills
        JOIN public.profiles ON profiles.id = auth.uid()
        WHERE coffee_bills.id = coffee_bill_items.bill_id
          AND profiles.role IN ('manager', 'admin')
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.coffee_bills
        JOIN public.profiles ON profiles.id = auth.uid()
        WHERE coffee_bills.id = coffee_bill_items.bill_id
          AND profiles.role IN ('manager', 'admin')
    ));
CREATE POLICY coffee_bill_items_manager_delete
    ON public.coffee_bill_items FOR DELETE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.coffee_bills
        JOIN public.profiles ON profiles.id = auth.uid()
        WHERE coffee_bills.id = coffee_bill_items.bill_id
          AND profiles.role IN ('manager', 'admin')
    ));

CREATE TABLE IF NOT EXISTS public.security_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    target_id TEXT,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS security_audit_log_created_at_idx
    ON public.security_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS security_audit_log_actor_idx
    ON public.security_audit_log(actor_user_id, created_at DESC);
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.security_audit_log FROM anon, authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON public.security_audit_log FROM service_role;
GRANT SELECT, INSERT ON public.security_audit_log TO service_role;

CREATE TABLE IF NOT EXISTS public.login_throttle_state (
    scope TEXT NOT NULL CHECK (scope IN ('username', 'ip')),
    subject_hash TEXT NOT NULL CHECK (subject_hash ~ '^[0-9a-f]{64}$'),
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    lock_level SMALLINT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (scope, subject_hash)
);
ALTER TABLE public.login_throttle_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.login_throttle_state FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.login_throttle_state TO service_role;

CREATE OR REPLACE FUNCTION public.is_login_throttled(p_username_hash TEXT, p_ip_hash TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.login_throttle_state
        WHERE locked_until > now()
          AND ((scope = 'username' AND subject_hash = p_username_hash)
            OR (scope = 'ip' AND subject_hash = p_ip_hash))
    );
$$;

CREATE OR REPLACE FUNCTION public.record_login_attempt(
    p_username_hash TEXT,
    p_ip_hash TEXT,
    p_succeeded BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    current_scope TEXT;
    current_hash TEXT;
    current_row public.login_throttle_state%ROWTYPE;
    next_attempts INTEGER;
    next_lock_level SMALLINT;
    delay_minutes INTEGER;
BEGIN
    IF p_succeeded THEN
        DELETE FROM public.login_throttle_state
        WHERE scope = 'username' AND subject_hash = p_username_hash;
        RETURN;
    END IF;

    FOR current_scope, current_hash IN
        SELECT scope, subject_hash
        FROM (VALUES ('username', p_username_hash), ('ip', p_ip_hash)) AS subjects(scope, subject_hash)
        ORDER BY scope
    LOOP
        INSERT INTO public.login_throttle_state(scope, subject_hash)
        VALUES (current_scope, current_hash)
        ON CONFLICT DO NOTHING;

        SELECT * INTO current_row
        FROM public.login_throttle_state
        WHERE scope = current_scope AND subject_hash = current_hash
        FOR UPDATE;

        next_attempts := CASE
            WHEN current_row.locked_until IS NOT NULL AND current_row.locked_until <= now() THEN 1
            ELSE current_row.failed_attempts + 1
        END;
        next_lock_level := current_row.lock_level;
        delay_minutes := 0;

        IF next_attempts >= 5 THEN
            delay_minutes := LEAST(15 * (2 ^ LEAST(next_lock_level, 6)), 1440);
            next_attempts := 0;
            next_lock_level := LEAST(next_lock_level + 1, 7);
        END IF;

        UPDATE public.login_throttle_state
        SET failed_attempts = next_attempts,
            lock_level = next_lock_level,
            locked_until = CASE WHEN delay_minutes > 0 THEN now() + make_interval(mins => delay_minutes) ELSE NULL END,
            updated_at = now()
        WHERE scope = current_scope AND subject_hash = current_hash;
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.is_login_throttled(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_login_attempt(TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_login_throttled(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_login_attempt(TEXT, TEXT, BOOLEAN) TO service_role;

CREATE OR REPLACE FUNCTION public.next_coffee_bill_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    last_number BIGINT;
BEGIN
    PERFORM pg_advisory_xact_lock(31415926);
    SELECT MAX(NULLIF(regexp_replace(bill_number, '^COF-', ''), '')::BIGINT)
    INTO last_number
    FROM public.coffee_bills
    WHERE bill_number ~ '^COF-[0-9]+$';
    RETURN 'COF-' || LPAD((GREATEST(COALESCE(last_number, 1000), 1000) + 1)::TEXT, 4, '0');
END;
$$;
REVOKE ALL ON FUNCTION public.next_coffee_bill_number() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_coffee_bill_number() TO authenticated;