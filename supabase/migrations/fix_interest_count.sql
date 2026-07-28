-- Migración: corregir la sincronización del contador de intereses
-- y convertir el reinicio administrativo en una operación atómica.


begin;

-- Ambos triggers modificaban interest_count para los mismos eventos,
-- lo que podía provocar incrementos, decrementos o recálculos duplicados.
drop trigger if exists t_sheet_interests_stats
  on public.sheet_interests;

drop trigger if exists trg_sheet_interest_count
  on public.sheet_interests;

-- Estas funciones dejan de utilizarse después de eliminar sus triggers.
drop function if exists public.refresh_interest_count();
drop function if exists public.update_sheet_interest_count();

-- Mantiene interest_count actualizado mediante operaciones atómicas.
--
-- INSERT:
--   incrementa el contador de la plancha.
--
-- DELETE:
--   disminuye el contador sin permitir valores negativos.
--
-- UPDATE de sheet_id:
--   disminuye el contador de la plancha anterior e incrementa
--   el contador de la nueva plancha.
create or replace function public.sync_sheet_interest_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    update public.sheets
    set interest_count = interest_count + 1
    where id = new.sheet_id;

  elsif tg_op = 'DELETE' then
    update public.sheets
    set interest_count = greatest(interest_count - 1, 0)
    where id = old.sheet_id;

  elsif tg_op = 'UPDATE'
        and old.sheet_id is distinct from new.sheet_id then

    -- Bloquear ambas planchas en un orden determinista para reducir
    -- el riesgo de bloqueos mutuos en actualizaciones simultáneas.
    perform 1
    from public.sheets
    where id in (old.sheet_id, new.sheet_id)
    order by id
    for update;

    update public.sheets
    set interest_count = greatest(interest_count - 1, 0)
    where id = old.sheet_id;

    update public.sheets
    set interest_count = interest_count + 1
    where id = new.sheet_id;
  end if;

  return null;
end;
$function$;

comment on function public.sync_sheet_interest_count() is
'Mantiene sheets.interest_count sincronizado mediante incrementos y decrementos atómicos al modificar sheet_interests.';


-- Impedir que la función de trigger sea invocada directamente
-- por los roles públicos de la aplicación.
revoke all
on function public.sync_sheet_interest_count()
from public;

revoke all
on function public.sync_sheet_interest_count()
from anon;

revoke all
on function public.sync_sheet_interest_count()
from authenticated;

-- Se crea el único trigger

create trigger t_sheet_interests_stats
after insert or delete or update of sheet_id
on public.sheet_interests
for each row
execute function public.sync_sheet_interest_count();

-- Los triggers anteriores pudieron dejar valores duplicados o
-- desactualizados. Se reemplaza cada contador por la cantidad real
-- de registros existentes en sheet_interests.
update public.sheets as s
set interest_count = (
  select count(*)::bigint
  from public.sheet_interests as si
  where si.sheet_id = s.id
);

-- Reinicia todos los intereses de una plancha dentro de una sola
-- transacción de PostgreSQL.
--
-- El bloqueo FOR UPDATE evita que una operación simultánea deje
-- registros existentes mientras interest_count permanece en cero.
create or replace function public.reset_sheet_interest(
  p_sheet_id bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_sheet_id is null or p_sheet_id <= 0 then
    raise exception 'sheet_id inválido'
      using errcode = '22023';
  end if;

  -- Bloquear la fila de la plancha durante todo el reinicio.
  perform 1
  from public.sheets
  where id = p_sheet_id
  for update;

  -- La función devuelve false cuando la plancha no existe.
  if not found then
    return false;
  end if;

  -- Los DELETE activan el único trigger de sincronización.
  delete from public.sheet_interests
  where sheet_id = p_sheet_id;

  -- Recálculo defensivo:
  -- garantiza que el contador termine exactamente con la cantidad
  -- real de registros, incluso si previamente estaba desactualizado
  -- o no había registros que eliminar.
  update public.sheets
  set interest_count = (
    select count(*)::bigint
    from public.sheet_interests
    where sheet_id = p_sheet_id
  )
  where id = p_sheet_id;

  return true;
end;
$function$;

comment on function public.reset_sheet_interest(bigint) is
'Reinicia atómicamente los intereses de una plancha, bloqueando sheets y recalculando interest_count dentro de la misma transacción.';

-- La función solo debe ejecutarse desde el endpoint administrativo,
-- utilizando el cliente de Supabase configurado con service_role.
revoke all
on function public.reset_sheet_interest(bigint)
from public;

revoke all
on function public.reset_sheet_interest(bigint)
from anon;

revoke all
on function public.reset_sheet_interest(bigint)
from authenticated;

grant execute
on function public.reset_sheet_interest(bigint)
to service_role;


commit;