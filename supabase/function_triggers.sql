--Función para recalcular la dificultad promedio y el número de votaciones
create or replace function refresh_sheet_stats() returns trigger as $$
begin
  update sheets s set
    avg_difficulty = coalesce(sub.avg, 0),
    rating_count   = coalesce(sub.cnt, 0)
  from (
    select sheet_id, avg(score)::numeric(3,2) as avg, count(*) as cnt
    from sheet_ratings
    where sheet_id = coalesce(new.sheet_id, old.sheet_id)
    group by sheet_id
  ) sub
  where s.id = sub.sheet_id;
  return null;
end; $$ language plpgsql;

--Trigger para ejecutar la función despues de hacer cambios  
create trigger t_sheet_ratings_stats
after insert or update or delete on sheet_ratings
for each row execute function refresh_sheet_stats();

--Función para actualizar la cantidad de vistas
create or replace function refresh_view_count() returns trigger as $$
begin
  update sheets s
  set view_count = (select count(*) from sheet_views where sheet_id = s.id)
  where s.id = new.sheet_id;
  return null;
end; $$ language plpgsql;

--Trigger para hacer la función
create trigger t_sheet_views_stats
after insert on sheet_views
for each row execute function refresh_view_count();

--Funci��n para recalcular promedios de profesores
create or replace function refresh_teacher_stats() returns trigger as $$
declare
  target_id bigint := coalesce(new.teacher_id, old.teacher_id);
begin
  update teachers t
  set
    avg_overall = coalesce(sub.avg, 0),
    rating_count = coalesce(sub.cnt, 0)
  from (
    select teacher_id,
           avg(overall)::numeric(3,2) as avg,
           count(*) as cnt
    from teacher_ratings
    where teacher_id = target_id
    group by teacher_id
  ) sub
  where t.id = target_id;

  if not found then
    update teachers
    set avg_overall = 0,
        rating_count = 0
    where id = target_id;
  end if;

  return null;
end; $$ language plpgsql;

--Trigger para aplicar la funci��n en teacher_ratings
create trigger t_teacher_ratings_stats
after insert or update or delete on teacher_ratings
for each row execute function refresh_teacher_stats();

--Funci��n para crear curso con evaluaciones y asignaci�n autom�tica de estado
create or replace function create_course_with_evaluations(
  p_code text,
  p_name text,
  p_credits integer,
  p_system_id integer,
  p_subsystem_id integer,
  p_selected_evaluations integer[]
)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_exists_course boolean;
  v_system record;
  v_subsystem record;
  v_course courses%rowtype;
  v_status courses.status%type;
  v_selected_count integer := 0;
  v_distinct_selected_count integer := 0;
  v_all_evaluation_ids integer[];
begin
  p_selected_evaluations := coalesce(p_selected_evaluations, '{}');

  select exists (select 1 from courses where code = p_code)
  into v_exists_course;

  if v_exists_course then
    return json_build_object('ok', false, 'error', 'Curso ya existe');
  end if;

  select * into v_system
  from evaluation_systems
  where system_id = p_system_id;

  if not found then
    return json_build_object('ok', false, 'error', 'Sistema inv�lido');
  end if;

  select coalesce(array_length(p_selected_evaluations, 1), 0)
  into v_selected_count;

  select count(distinct x.evaluation_id)
  into v_distinct_selected_count
  from unnest(p_selected_evaluations) as x(evaluation_id);

  if v_selected_count <> v_distinct_selected_count then
    return json_build_object('ok', false, 'error', 'Hay evaluaciones seleccionadas repetidas');
  end if;

  -- Determinaci�n del estado y validaci�n del subsistema
  if v_system.requires_subsystem then
    if p_subsystem_id is null then
      if v_selected_count > 0 then
        return json_build_object('ok', false, 'error', 'No se pueden seleccionar evaluaciones mientras el subsistema est� pendiente');
      end if;
      v_status := 'INCOMPLETO';
    else
      select * into v_subsystem
      from evaluation_subsystems
      where subsystem_id = p_subsystem_id;

      if not found then
        return json_build_object('ok', false, 'error', 'Subsistema inv�lido');
      end if;

      if v_selected_count <> v_subsystem.practices_quantity then
        return json_build_object('ok', false, 'error', format('Debe seleccionar exactamente %s evaluaciones', v_subsystem.practices_quantity));
      end if;

      v_status := 'COMPLETO';
    end if;
  else
    if p_subsystem_id is not null then
      return json_build_object('ok', false, 'error', 'El sistema seleccionado no requiere subsistema');
    end if;

    if v_selected_count > 0 then
      return json_build_object('ok', false, 'error', 'Este sistema no debe recibir evaluaciones seleccionadas manualmente');
    end if;

    v_status := 'COMPLETO';
  end if;

  -- Verifica que todas las evaluaciones enviadas existan y correspondan al sistema
  if v_selected_count > 0 then
    if exists (
      select 1
      from unnest(p_selected_evaluations) as x(evaluation_id)
      left join evaluation_type et on et.evaluation_id = x.evaluation_id
      where et.evaluation_id is null
    ) then
      return json_build_object('ok', false, 'error', 'Hay evaluaciones seleccionadas inv�lidas');
    end if;
  end if;

  if v_selected_count > 0 then
    if exists (
      select 1
      from unnest(p_selected_evaluations) as x(evaluation_id)
      left join (
        select distinct get1.evaluation_id
        from system_grades_consider sgc
        join grade_evaluation_type get1 on get1.grade_id = sgc.grade_id
        join evaluation_type et on et.evaluation_id = get1.evaluation_id
        where sgc.system_id = p_system_id
          and upper(coalesce(et.evaluation_category, '')) in ('PRACTICA', 'LABORATORIO', 'TRABAJO')
      ) allowed on allowed.evaluation_id = x.evaluation_id
      where allowed.evaluation_id is null
    ) then
      return json_build_object('ok', false, 'error', 'Hay evaluaciones seleccionadas que no corresponden al sistema elegido');
    end if;
  end if;

  insert into courses (code, name, credits, system_id, subsystem_id, status, is_hidden)
  values (p_code, p_name, p_credits, p_system_id, p_subsystem_id, v_status, false)
  returning * into v_course;

  -- Recolecta evaluaciones: fijas del sistema + seleccionadas + ES (si EP y EF existen) + PE
  select coalesce(array_agg(distinct t.evaluation_id), '{}')
  into v_all_evaluation_ids
  from (
    select get1.evaluation_id
    from system_grades_consider sgc
    join grade_evaluation_type get1 on get1.grade_id = sgc.grade_id
    join evaluation_type et on et.evaluation_id = get1.evaluation_id
    where sgc.system_id = p_system_id
      and upper(coalesce(et.evaluation_category, '')) not in ('PRACTICA', 'LABORATORIO', 'TRABAJO')
    union
    select unnest(p_selected_evaluations)
    union
    select et_es.evaluation_id
    from evaluation_type et_es
    where upper(coalesce(et_es.evaluation_abr, '')) = 'ES'
      and exists (
        select 1 from system_grades_consider sgc
        join grade_evaluation_type get_ep on get_ep.grade_id = sgc.grade_id
        join evaluation_type et_ep on et_ep.evaluation_id = get_ep.evaluation_id
        where sgc.system_id = p_system_id and upper(coalesce(et_ep.evaluation_abr, '')) = 'EP'
      )
      and exists (
        select 1 from system_grades_consider sgc
        join grade_evaluation_type get_ef on get_ef.grade_id = sgc.grade_id
        join evaluation_type et_ef on et_ef.evaluation_id = get_ef.evaluation_id
        where sgc.system_id = p_system_id and upper(coalesce(et_ef.evaluation_abr, '')) = 'EF'
      )
    union
    select et_pe.evaluation_id
    from evaluation_type et_pe
    where upper(coalesce(et_pe.evaluation_abr, '')) = 'PE'
  ) as t;

  if coalesce(array_length(v_all_evaluation_ids, 1), 0) > 0 then
    insert into course_evaluations (course_id, evaluation_id)
    select v_course.id, x.evaluation_id
    from unnest(v_all_evaluation_ids) as x(evaluation_id);
  end if;

  return json_build_object(
    'ok', true,
    'course', json_build_object(
      'id', v_course.id,
      'code', v_course.code,
      'name', v_course.name,
      'credits', v_course.credits,
      'system_id', v_course.system_id,
      'subsystem_id', v_course.subsystem_id,
      'status', v_course.status,
      'is_hidden', v_course.is_hidden
    )
  );

exception
  when unique_violation then
    return json_build_object('ok', false, 'error', 'Curso ya existe o se intent� duplicar una evaluaci�n del curso');
  when others then
    return json_build_object('ok', false, 'error', sqlerrm);
end;
$$;
