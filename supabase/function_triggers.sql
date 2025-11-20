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
