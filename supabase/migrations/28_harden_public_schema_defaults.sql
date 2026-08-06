-- Migración 28
-- Endurecer privilegios predeterminados del esquema public
-- Evita que objetos nuevos queden accesibles por defecto desde roles cliente.
-- Diseñada para ejecutarse sobre el schema original entregado al equipo.

begin;


-- Los clientes pueden usar el esquema, pero no crear objetos dentro de él.
revoke create on schema public from public, anon, authenticated;
revoke usage on schema public from public;
grant usage on schema public to anon, authenticated, service_role;

-- Tablas y secuencias futuras no reciben privilegios de cliente implícitos.
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated;

-- PostgreSQL concede EXECUTE a PUBLIC en funciones nuevas; se elimina.
alter default privileges for role postgres
  revoke execute on functions from public;

alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

-- El backend opera mediante supabaseAdmin/service_role.
alter default privileges for role postgres in schema public
  grant all on tables to service_role;

alter default privileges for role postgres in schema public
  grant all on sequences to service_role;

alter default privileges for role postgres in schema public
  grant execute on functions to service_role;

commit;
