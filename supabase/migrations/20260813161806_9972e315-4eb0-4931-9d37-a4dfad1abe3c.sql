-- ENUMS
CREATE TYPE public.app_role AS ENUM ('administrator','organizer','attendee','security_officer');
CREATE TYPE public.event_status AS ENUM ('draft','published','active','completed','cancelled');
CREATE TYPE public.ticket_status AS ENUM ('valid','used','cancelled');
CREATE TYPE public.attendance_status AS ENUM ('active','completed');
CREATE TYPE public.incident_priority AS ENUM ('low','medium','high','critical');
CREATE TYPE public.incident_status AS ENUM ('pending','in_progress','resolved');

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- USER ROLES
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id
    AND role IN ('administrator','organizer','security_officer'))
$$;

-- VENUES
CREATE TABLE public.venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT 'Bauchi',
  state text NOT NULL DEFAULT 'Bauchi State',
  capacity integer NOT NULL CHECK (capacity > 0),
  warning_threshold integer NOT NULL DEFAULT 80 CHECK (warning_threshold BETWEEN 1 AND 100),
  description text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.venues TO authenticated;
GRANT SELECT ON public.venues TO anon;
GRANT ALL ON public.venues TO service_role;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

-- EVENTS
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'General',
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE RESTRICT,
  organizer_id uuid NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  capacity integer NOT NULL CHECK (capacity > 0),
  current_occupancy integer NOT NULL DEFAULT 0,
  status public.event_status NOT NULL DEFAULT 'draft',
  banner_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT SELECT ON public.events TO anon;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- TICKETS
CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  attendee_id uuid NOT NULL,
  qr_code text NOT NULL UNIQUE,
  status public.ticket_status NOT NULL DEFAULT 'valid',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, attendee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- OFFICER ASSIGNMENTS
CREATE TABLE public.event_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  officer_id uuid NOT NULL,
  zone text NOT NULL DEFAULT 'Main Gate',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, officer_id, zone)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_assignments TO authenticated;
GRANT ALL ON public.event_assignments TO service_role;
ALTER TABLE public.event_assignments ENABLE ROW LEVEL SECURITY;

-- ATTENDANCE
CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  attendee_id uuid NOT NULL,
  officer_id uuid,
  zone text,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  checked_out_at timestamptz,
  status public.attendance_status NOT NULL DEFAULT 'active'
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- INCIDENTS
CREATE TABLE public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  reported_by uuid NOT NULL,
  incident_type text NOT NULL,
  location text NOT NULL,
  description text NOT NULL,
  priority public.incident_priority NOT NULL DEFAULT 'medium',
  status public.incident_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incidents TO authenticated;
GRANT ALL ON public.incidents TO service_role;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- ALERTS
CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- POLICIES
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'administrator') OR public.is_staff(auth.uid()));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'administrator'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'administrator'));

CREATE POLICY "roles_select" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "roles_admin_manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator'))
  WITH CHECK (public.has_role(auth.uid(),'administrator'));

CREATE POLICY "venues_select_all" ON public.venues FOR SELECT USING (true);
CREATE POLICY "venues_admin_manage" ON public.venues FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator'))
  WITH CHECK (public.has_role(auth.uid(),'administrator'));

CREATE POLICY "events_public_read" ON public.events FOR SELECT
  USING (status IN ('published','active','completed'));
CREATE POLICY "events_owner_read" ON public.events FOR SELECT TO authenticated
  USING (organizer_id = auth.uid() OR public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'security_officer'));
CREATE POLICY "events_insert" ON public.events FOR INSERT TO authenticated
  WITH CHECK ((organizer_id = auth.uid() AND public.has_role(auth.uid(),'organizer')) OR public.has_role(auth.uid(),'administrator'));
CREATE POLICY "events_update" ON public.events FOR UPDATE TO authenticated
  USING (organizer_id = auth.uid() OR public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'security_officer'))
  WITH CHECK (organizer_id = auth.uid() OR public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'security_officer'));
CREATE POLICY "events_delete" ON public.events FOR DELETE TO authenticated
  USING (organizer_id = auth.uid() OR public.has_role(auth.uid(),'administrator'));

CREATE POLICY "tickets_select" ON public.tickets FOR SELECT TO authenticated
  USING (attendee_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "tickets_insert_own" ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (attendee_id = auth.uid());
CREATE POLICY "tickets_update" ON public.tickets FOR UPDATE TO authenticated
  USING (attendee_id = auth.uid() OR public.is_staff(auth.uid()))
  WITH CHECK (attendee_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE POLICY "assignments_select" ON public.event_assignments FOR SELECT TO authenticated
  USING (officer_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "assignments_manage" ON public.event_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'organizer'))
  WITH CHECK (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'organizer'));

CREATE POLICY "attendance_select" ON public.attendance FOR SELECT TO authenticated
  USING (attendee_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "attendance_insert" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "attendance_update" ON public.attendance FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "incidents_select" ON public.incidents FOR SELECT TO authenticated
  USING (reported_by = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "incidents_insert" ON public.incidents FOR INSERT TO authenticated
  WITH CHECK (reported_by = auth.uid() AND public.is_staff(auth.uid()));
CREATE POLICY "incidents_update" ON public.incidents FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'organizer'))
  WITH CHECK (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'organizer'));

CREATE POLICY "alerts_select" ON public.alerts FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "alerts_insert" ON public.alerts FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "alerts_update" ON public.alerts FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- NEW USER TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  requested text;
  chosen public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    COALESCE(NEW.email,''),
    NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;

  requested := COALESCE(NEW.raw_user_meta_data->>'role','attendee');
  IF requested NOT IN ('administrator','organizer','attendee','security_officer') THEN
    requested := 'attendee';
  END IF;
  chosen := requested::public.app_role;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, chosen)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- OCCUPANCY + ALERT AUTOMATION
CREATE OR REPLACE FUNCTION public.sync_occupancy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ev record;
  occ integer;
  warn integer;
BEGIN
  SELECT e.*, v.warning_threshold INTO ev
  FROM public.events e JOIN public.venues v ON v.id = e.venue_id
  WHERE e.id = COALESCE(NEW.event_id, OLD.event_id);

  SELECT count(*) INTO occ FROM public.attendance
  WHERE event_id = ev.id AND status = 'active';

  UPDATE public.events SET current_occupancy = occ, updated_at = now() WHERE id = ev.id;

  warn := (ev.capacity * ev.warning_threshold) / 100;
  IF occ >= ev.capacity THEN
    INSERT INTO public.alerts (event_id, alert_type, severity, message)
    VALUES (ev.id, 'capacity', 'critical', ev.title || ' has reached full capacity (' || occ || '/' || ev.capacity || '). Entry blocked.');
  ELSIF occ = warn THEN
    INSERT INTO public.alerts (event_id, alert_type, severity, message)
    VALUES (ev.id, 'capacity', 'warning', ev.title || ' reached the warning level (' || occ || '/' || ev.capacity || ').');
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER attendance_occupancy AFTER INSERT OR UPDATE OR DELETE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.sync_occupancy();

CREATE OR REPLACE FUNCTION public.incident_alert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.alerts (event_id, alert_type, severity, message)
  VALUES (NEW.event_id, 'incident',
    CASE WHEN NEW.priority IN ('high','critical') THEN 'critical' ELSE 'warning' END,
    'New ' || NEW.priority || ' incident reported: ' || NEW.incident_type || ' at ' || NEW.location);
  RETURN NEW;
END;
$$;
CREATE TRIGGER incidents_alert AFTER INSERT ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.incident_alert();

-- REALTIME
ALTER TABLE public.events REPLICA IDENTITY FULL;
ALTER TABLE public.attendance REPLICA IDENTITY FULL;
ALTER TABLE public.alerts REPLICA IDENTITY FULL;
ALTER TABLE public.incidents REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;

-- SEED VENUES (Bauchi State, Nigeria)
INSERT INTO public.venues (name, address, city, capacity, warning_threshold, description) VALUES
('Ahmadu Bello International Conference Centre','Ahmadu Bello Way, Bauchi','Bauchi',2000,80,'Bauchi State''s flagship conference centre for large conventions and state events.'),
('Zaranda Hotel Grand Hall','Jos Road, Bauchi','Bauchi',800,80,'Banquet and conference hall at the historic Zaranda Hotel.'),
('Dec Guest House & Conference Center','Yandoka Road, Bauchi','Bauchi',500,80,'Modern conference facility with breakout rooms and event lawn.'),
('Bauchi Township Stadium','Stadium Road, Bauchi','Bauchi',10000,85,'Open-air stadium for large public gatherings and festivals.'),
('Abubakar Tafawa Balewa University Auditorium','ATBU Gubi Campus, Bauchi','Bauchi',1200,80,'University auditorium used for conventions, ceremonies and seminars.');