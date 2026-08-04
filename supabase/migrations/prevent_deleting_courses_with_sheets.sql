-- Migración: impedir la eliminación de cursos con planchas asociadas.
--
-- La función bloquea el curso durante la validación para evitar que
-- se registre una plancha entre la comprobación y la eliminación.
--
-- Los cursos con planchas deben ocultarse mediante is_hidden,
-- evitando dejar archivos huérfanos en Supabase Storage.

begin;

create or replace function public.delete_empty_course(
  p_course_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_course_id is null or p_course_id <= 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_id',
      'error', 'ID de curso inválido'
    );
  end if;

  /*
   * Bloquear el curso durante toda la operación.
   *
   * Esto impide que otra transacción registre una plancha asociada
   * después de comprobar que el curso está vacío.
   */
  perform 1
  from public.courses
  where id = p_course_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'not_found',
      'error', 'Curso no encontrado'
    );
  end if;

  /*
   * No eliminar cursos con planchas, porque ON DELETE CASCADE
   * eliminaría sus registros en la base de datos, pero no sus
   * archivos de los buckets de Supabase Storage.
   */
  if exists (
    select 1
    from public.sheets
    where course_id = p_course_id
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'course_has_sheets',
      'error',
      'No se puede eliminar un curso con planchas asociadas. Ocúltalo en su lugar.'
    );
  end if;

  delete from public.courses
  where id = p_course_id;

  return jsonb_build_object(
    'ok', true
  );
end;
$function$;

comment on function public.delete_empty_course(bigint) is
'Elimina un curso solo cuando no tiene planchas asociadas, evitando archivos huérfanos en Storage.';

revoke all
on function public.delete_empty_course(bigint)
from public;

revoke all
on function public.delete_empty_course(bigint)
from anon;

revoke all
on function public.delete_empty_course(bigint)
from authenticated;

grant execute
on function public.delete_empty_course(bigint)
to service_role;

commit;

notify pgrst, 'reload schema';