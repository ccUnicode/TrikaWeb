-- Migración 27
-- Asegurar límites de escritura por IP
-- Reserva write_limits para el backend y evita que clientes alteren el rate limit.
-- Diseñada para ejecutarse sobre el schema original entregado al equipo.

begin;


alter table public.write_limits enable row level security;

-- Sin políticas públicas: contiene hashes de IP y controla límites del endpoint.
revoke all privileges on table public.write_limits
  from public, anon, authenticated;
grant all privileges on table public.write_limits to service_role;

commit;
