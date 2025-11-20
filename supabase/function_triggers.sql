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
