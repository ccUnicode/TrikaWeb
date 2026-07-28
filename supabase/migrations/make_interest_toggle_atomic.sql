-- Migración: convertir el toggle de interés en una operación atómica.
--
-- El bloqueo de la fila evita que dos solicitudes simultáneas
-- consulten el mismo estado y provoquen una violación de la
-- restricción única (sheet_id, device_id).

begin;

-- Se crea función atómica para el toggle

create or replace function public.toggle_sheet_interest(
  p_sheet_id bigint,
  p_device_id uuid,
  p_ip_hash text
)
returns table (
  status text,
  interested boolean,
  interest_count bigint
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_course_id bigint;
  v_sheet_hidden boolean;
  v_course_visible boolean;
  v_has_solution boolean;
  v_deleted_interest_id bigint;
  v_final_count bigint;
begin
  -- Validaciones defensivas. El endpoint también valida estos datos
  -- antes de invocar la función.
  if p_sheet_id is null or p_sheet_id <= 0 then
    raise exception 'sheet_id inválido'
      using errcode = '22023';
  end if;

  if p_device_id is null then
    raise exception 'device_id inválido'
      using errcode = '22023';
  end if;

  if p_ip_hash is null or btrim(p_ip_hash) = '' then
    raise exception 'ip_hash inválido'
      using errcode = '22023';
  end if;

  /*
   * Bloquear la fila de sheets antes de consultar o modificar
   * sheet_interests.
   *
   * Las solicitudes simultáneas sobre la misma plancha deberán esperar
   * y, cuando continúen, observarán el estado confirmado por la
   * solicitud anterior.
   *
   * Este bloqueo también sincroniza el toggle con el reinicio
   * administrativo creado en reset_sheet_interest().
   */
  select
    s.course_id,
    s.is_hidden,
    (
      nullif(
        btrim(coalesce(s.solution_kind::text, '')),
        ''
      ) is not null
      or nullif(
        btrim(coalesce(s.solution_storage_path, '')),
        ''
      ) is not null
      or nullif(
        btrim(coalesce(s.solution_video_url, '')),
        ''
      ) is not null
    )
  into
    v_course_id,
    v_sheet_hidden,
    v_has_solution
  from public.sheets as s
  where s.id = p_sheet_id
  for update;

  if not found then
    return query
    select
      'not_found'::text,
      null::boolean,
      null::bigint;

    return;
  end if;

  select exists (
    select 1
    from public.courses as c
    where c.id = v_course_id
      and c.is_hidden = false
  )
  into v_course_visible;

  if coalesce(v_sheet_hidden, true)
     or not coalesce(v_course_visible, false) then
    return query
    select
      'unavailable'::text,
      null::boolean,
      null::bigint;

    return;
  end if;

  /*
   * Intentar eliminar directamente el interés.
   *
   * No se hace un SELECT previo. Si el registro existe, se elimina
   * y el toggle termina en estado interested = false.
   */
  delete from public.sheet_interests
  where sheet_id = p_sheet_id
    and device_id = p_device_id
  returning id into v_deleted_interest_id;

  if v_deleted_interest_id is not null then
    -- El trigger ya actualizó sheets.interest_count dentro de esta
    -- misma transacción.
    select s.interest_count
    into v_final_count
    from public.sheets as s
    where s.id = p_sheet_id;

    return query
    select
      'ok'::text,
      false,
      coalesce(v_final_count, 0);

    return;
  end if;

  /*
   * Si no existía interés, solo se permite insertar uno nuevo cuando
   * la plancha todavía no cuenta con solucionario.
   *
   * Se mantiene el comportamiento anterior: un interés ya existente
   * puede eliminarse aunque posteriormente se haya subido solucionario.
   */
  if v_has_solution then
    select s.interest_count
    into v_final_count
    from public.sheets as s
    where s.id = p_sheet_id;

    return query
    select
      'solution_available'::text,
      false,
      coalesce(v_final_count, 0);

    return;
  end if;

  insert into public.sheet_interests (
    sheet_id,
    device_id,
    ip_hash
  )
  values (
    p_sheet_id,
    p_device_id,
    p_ip_hash
  );

  -- El trigger asociado al INSERT ya incrementó interest_count.
  select s.interest_count
  into v_final_count
  from public.sheets as s
  where s.id = p_sheet_id;

  return query
  select
    'ok'::text,
    true,
    coalesce(v_final_count, 0);
end;
$function$;


comment on function public.toggle_sheet_interest(bigint, uuid, text) is
'Alterna atómicamente el interés de un dispositivo y devuelve el estado y contador finales.';

-- El toggle debe ejecutarse exclusivamente desde el backend,
-- utilizando el cliente configurado con service_role.
revoke all
on function public.toggle_sheet_interest(bigint, uuid, text)
from public;

revoke all
on function public.toggle_sheet_interest(bigint, uuid, text)
from anon;

revoke all
on function public.toggle_sheet_interest(bigint, uuid, text)
from authenticated;

grant execute
on function public.toggle_sheet_interest(bigint, uuid, text)
to service_role;


commit;