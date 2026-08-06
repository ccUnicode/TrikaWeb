-- Migración 17
-- Agregar configuración y estados de cursos
-- Añade sistema, subsistema, sumilla, estado, visibilidad y backfill de cursos.
-- Diseñada para ejecutarse sobre el schema original entregado al equipo.

begin;

alter table public.courses
  add column if not exists is_hidden boolean,
  add column if not exists system_id integer,
  add column if not exists subsystem_id integer,
  add column if not exists summary text,
  add column if not exists is_elective boolean,
  add column if not exists avg_difficulty numeric(3,2),
  add column if not exists status varchar(20);


-- Configuración recuperada para los cursos existentes.
create temporary table migration_course_state (
  code text primary key,
  name text not null,
  credits integer,
  is_hidden boolean,
  system_id integer not null,
  subsystem_id integer,
  summary text,
  is_elective boolean,
  avg_difficulty numeric(3,2),
  status varchar(20) not null
) on commit drop;

insert into migration_course_state (
  code,
  name,
  credits,
  is_hidden,
  system_id,
  subsystem_id,
  summary,
  is_elective,
  avg_difficulty,
  status
)
values
  ('SW807', 'Procesos de Ingeniería de Software', 3, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('FB303', 'Cálculo Multivariable', 5, false, 7, 1, 'Cálculo Multivariable extiende los conceptos del cálculo de una variable a funciones de dos o más dimensiones. El curso enseña a analizar curvas en el espacio, calcular límites y derivadas en 3D, optimizar funciones con máximos y mínimos (libres o condicionados), y dominar integrales dobles, triples y de línea, siempre enfocándose en aplicaciones prácticas. Es un curso teórico-práctico del tercer ciclo que te da las herramientas para modelar problemas reales en múltiples dimensiones.', false, 0.00, 'COMPLETO'),
  ('GE101', 'Introducción a la Ingeniería Industrial', 3, false, 6, 1, '(falta descripción)', false, 0.00, 'COMPLETO'),
  ('FB305', 'Estadística y Probabilidades', 3, false, 7, 1, 'Estadística y Probabilidades te enseña a recolectar, organizar y analizar datos (estadística descriptiva) y a sacar conclusiones generales a partir de muestras (estadística inferencial). Además, estudias modelos de probabilidad para medir qué tan probable es que ocurran ciertos eventos asociados a variables aleatorias. El curso combina teoría con práctica, y al final estarás capacitado para identificar variables, parámetros y estadísticos relevantes en cualquier estudio con enfoque positivista.', false, 0.00, 'COMPLETO'),
  ('SI701', 'Modelado Sistémico y Simulación', 3, false, 6, null, null, false, 0.00, 'INCOMPLETO'),
  ('SW902', 'Proyecto de Tesis en Ingeniería de Software I', 2, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('TE302', 'Diseño Asistido por Computador', 3, false, 4, null, null, false, 0.00, 'INCOMPLETO'),
  ('SI150', 'Analítica de Datos', 3, false, 6, null, null, false, 0.00, 'INCOMPLETO'),
  ('TE501', 'Electricidad y Electrónica Industrial', 4, false, 6, null, null, false, 0.00, 'INCOMPLETO'),
  ('SW405', 'Ingeniería de Requerimientos I', 3, false, 6, 1, null, false, 0.00, 'COMPLETO'),
  ('SI101', 'Introducción al Pensamiento y a la Ingeniería de Sistemas', 3, false, 6, 1, null, false, 0.00, 'COMPLETO'),
  ('BEF01', 'Ética y Filosofía Política', 2, false, 4, 2, null, false, 0.00, 'COMPLETO'),
  ('SW505', 'Construcción de Software I (Fundamentos, Prácticas)', 4, false, 4, null, null, false, 0.00, 'INCOMPLETO'),
  ('SI201', 'Psicología Sistémica', 3, false, 7, 2, null, false, 0.00, 'COMPLETO'),
  ('SI203', 'Teoría y Ciencia de Sistemas', 3, false, 6, 3, null, false, 0.00, 'COMPLETO'),
  ('SI207', 'Sistemas Biológicos y Ecológicos', 2, false, 6, 3, null, false, 0.00, 'COMPLETO'),
  ('BFI01', 'Física I', 5, false, 6, 7, null, false, 0.00, 'COMPLETO'),
  ('SW507', 'Redes y Comunicaciones', 3, false, 7, null, null, false, 0.00, 'INCOMPLETO'),
  ('SW608', 'Lenguajes de Dominio Específico', 4, false, 6, null, null, false, 0.00, 'INCOMPLETO'),
  ('SW603', 'Diseño de Software', 3, false, 4, null, null, false, 0.00, 'INCOMPLETO'),
  ('SW708', 'Arquitectura de Soluciones de Software', 3, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('SW707', 'Construcción de Software II (Herramientas y Tecnologías)', 3, false, 4, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('SW703', 'Sistemas Embebidos y en Tiempo Real', 3, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('SW803', 'Aprendizaje Automático I (Machine Learning I)', 4, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('BIC01', 'Introducción a la Computación', 2, false, 6, 1, null, false, 0.00, 'COMPLETO'),
  ('SW904', 'Seguridad en Redes y Desarrollo de Software Seguro', 3, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('SW907', 'Metodologías Ágiles para Proyectos de Software', 2, false, 7, null, null, false, 0.00, 'INCOMPLETO'),
  ('SW002', 'Tópicos Especiales en Ingeniería de Software', 3, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('SW004', 'Gestión de Proyectos de Software', 3, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('GS804', 'Administración de Empresas de Software', 3, false, 7, null, null, false, 0.00, 'INCOMPLETO'),
  ('BMA02', 'Cálculo Integral', 5, false, 7, 1, null, false, 0.00, 'COMPLETO'),
  ('GE709', 'Sistemas de Calidad', 3, false, 6, null, null, false, 0.00, 'INCOMPLETO'),
  ('HU301', 'Metodología de la Investigación', 2, false, 4, 2, null, false, 0.00, 'COMPLETO'),
  ('SI301', 'Teoría y Ciencia de Sistemas Aplicada', 2, false, 7, 1, null, false, 0.00, 'COMPLETO'),
  ('BQU01', 'Química I', 5, false, 6, 9, null, false, 0.00, 'COMPLETO'),
  ('BRC01', 'Redacción y Comunicación', 2, false, 4, 3, null, false, 0.00, 'COMPLETO'),
  ('SI302', 'Programación Orientada a Objetos', 3, false, 6, 1, null, false, 0.00, 'COMPLETO'),
  ('SI403', 'Metodología de los Sistemas Blandos', 3, false, 7, 10, null, false, 0.00, 'COMPLETO'),
  ('FB101', 'Geometría Analítica', 3, false, 7, 1, null, false, 0.00, 'COMPLETO'),
  ('FB402', 'Cálculo Numérico', 3, false, 7, 1, null, false, 0.00, 'COMPLETO'),
  ('FB405', 'Estadística Aplicada', 3, false, 7, 1, null, false, 0.00, 'COMPLETO'),
  ('FB501', 'Matemática Aplicada', 3, false, 7, 1, null, false, 0.00, 'COMPLETO'),
  ('GE501', 'Teoría Organizacional', 3, false, 6, 3, null, false, 0.00, 'COMPLETO'),
  ('SI501', 'Investigación de Operaciones I', 3, false, 6, 1, null, false, 0.00, 'COMPLETO'),
  ('GE605', 'Sistema y Gestión Financiera', 3, false, 6, 3, null, false, 0.00, 'COMPLETO'),
  ('SI601', 'Investigación de Operaciones II', 3, false, 6, 1, null, false, 0.00, 'COMPLETO'),
  ('SI602', 'Dinámica de Sistemas', 3, false, 4, 1, null, false, 0.00, 'COMPLETO'),
  ('SI603', 'Modelado de Procesos de Ciclo de Vida de Sistemas', 3, false, 6, 2, null, false, 0.00, 'COMPLETO'),
  ('SI604', 'Análisis y Diseño de Sistemas', 4, false, 6, 2, null, false, 0.00, 'COMPLETO'),
  ('SI605', 'Arquitectura Empresarial', 3, false, 6, 1, null, false, 0.00, 'COMPLETO'),
  ('FB301', 'Matemática Discreta', 3, false, 7, 1, null, false, 0.00, 'COMPLETO'),
  ('FB401', 'Física II', 5, false, 7, 7, null, false, 0.00, 'COMPLETO'),
  ('SW305', 'Algoritmia y Estructura de Datos Avanzada', 3, false, 6, 1, null, false, 0.00, 'COMPLETO'),
  ('BEG01', 'Economía General', 3, false, 6, 1, null, false, 0.00, 'COMPLETO'),
  ('SW101', 'Introducción a la Ingeniería de Software', 3, false, 6, 1, null, false, 0.00, 'COMPLETO'),
  ('TE205', 'Dibujo y Geometría Descriptiva', 2, false, 4, 2, null, false, 0.00, 'COMPLETO'),
  ('BMA03', 'Álgebra Lineal', 4, false, 7, 1, null, false, 0.00, 'COMPLETO'),
  ('FB202', 'Química II', 4, false, 6, 9, null, false, 0.00, 'COMPLETO'),
  ('SW301', 'Arquitectura de Computadoras I', 2, false, 7, 1, null, false, 0.00, 'COMPLETO'),
  ('SI503', 'Ingeniería de Procesos', 3, false, 6, 2, null, false, 0.00, 'COMPLETO'),
  ('SI405', 'Modelado Conceptual de Datos', 3, false, 6, 2, null, false, 0.00, 'COMPLETO'),
  ('SW303', 'Lenguaje de Programación I (Imperativo)', 4, false, 6, 1, null, false, 0.00, 'COMPLETO'),
  ('SW403', 'Lenguaje de Programación II (Orientada a Objetos)', 3, false, 6, 2, null, false, 0.00, 'COMPLETO'),
  ('SW407', 'Sistemas Operativos', 3, false, 7, 1, null, false, 0.00, 'COMPLETO'),
  ('BMA01', 'Cálculo Diferencial', 5, false, 7, 1, null, false, 0.00, 'COMPLETO'),
  ('FB403', 'Ecuaciones Diferenciales', 5, false, 7, 1, null, false, 0.00, 'COMPLETO'),
  ('BRN01', 'Realidad Nacional, Constitución y Derechos Humanos', 3, false, 4, 1, null, false, 0.00, 'COMPLETO'),
  ('HU501', 'Taller de Efectividad Personal', 2, false, 4, 3, null, false, 0.00, 'COMPLETO'),
  ('SI505', 'Diseño de Base de Datos', 3, false, 6, 2, null, false, 0.00, 'COMPLETO'),
  ('HU102', 'Desarrollo Personal', 2, false, 4, 3, null, false, 0.00, 'COMPLETO'),
  ('SI205', 'Algoritmia y Estructura de Datos', 3, false, 6, 1, null, false, 0.00, 'COMPLETO'),
  ('SI607', 'Arquitectura Computacional y Redes', 3, false, 6, 1, null, false, 0.00, 'COMPLETO'),
  ('SI707', 'Ingeniería de Software', 3, false, 6, null, null, false, 0.00, 'INCOMPLETO'),
  ('TE401', 'Termodinámica', 3, false, 6, null, null, false, 0.00, 'INCOMPLETO'),
  ('TE301', 'Fisicoquímica y Operaciones Unitarias', 4, false, 6, null, null, false, 0.00, 'INCOMPLETO'),
  ('SW503', 'Análisis y Modelamiento de Comportamiento', 4, false, 6, null, null, false, 0.00, 'INCOMPLETO'),
  ('SW605', 'Ingeniería de Requerimientos II', 3, false, 6, null, null, false, 0.00, 'INCOMPLETO'),
  ('SW609', 'Sistemas de Gestión de Base de Datos', 4, false, 7, null, null, false, 0.00, 'INCOMPLETO'),
  ('SW701', 'Gestión del Mantenimiento, Configuración y Cambios del Software', 3, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('SW709', 'Verificación y Validación de Software', 3, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('SW705', 'Taller de Ingeniería de Software I', 2, false, 4, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('HU801', 'Taller de Efectividad Profesional', 2, false, 4, null, null, false, 0.00, 'INCOMPLETO'),
  ('SW805', 'Ingeniería Económica para Software', 3, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('SW809', 'Aseguramiento de Calidad de Software', 3, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('SW901', 'Aprendizaje Automático II (Machine Learning II)', 4, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('SW903', 'Taller de Innovación y Tecnologías Emergentes', 3, false, 7, null, null, false, 0.00, 'INCOMPLETO'),
  ('SW905', 'Taller de Ingeniería de Software II', 2, false, 7, null, null, false, 0.00, 'INCOMPLETO'),
  ('SW001', 'Proyecto de Tesis en Ingeniería de Software II', 2, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('SW003', 'Gestión de Servicios del Software', 3, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('SW005', 'Taller de Emprendimiento en Base a Soluciones de Software', 2, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('SI705', 'Estándares de la Ingeniería de Sistemas', 2, false, 6, null, null, false, 0.00, 'INCOMPLETO'),
  ('SW501', 'Arquitectura de Computadoras II', 3, false, 7, 1, null, false, 0.00, 'INCOMPLETO');

-- Completar únicamente los campos vacíos de los cursos existentes.
-- Los valores ya configurados en la base de datos se preservan.
update public.courses as course
set
  name = case
    when nullif(btrim(course.name), '') is null
      then source.name
    else course.name
  end,

  credits = coalesce(
    course.credits,
    source.credits
  ),

  is_hidden = coalesce(
    course.is_hidden,
    source.is_hidden,
    false
  ),

  system_id = coalesce(
    course.system_id,
    source.system_id
  ),

  subsystem_id = coalesce(
    course.subsystem_id,
    source.subsystem_id
  ),

  summary = case
    when nullif(btrim(course.summary), '') is null
      then nullif(btrim(source.summary), '')
    else course.summary
  end,

  is_elective = coalesce(
    course.is_elective,
    source.is_elective,
    false
  ),

  avg_difficulty = coalesce(
    course.avg_difficulty,
    source.avg_difficulty,
    0.00
  ),

  status = case
    when nullif(btrim(course.status), '') is null
      then source.status
    else upper(btrim(course.status))
  end
from migration_course_state as source
where upper(btrim(course.code)) = source.code;

-- Normalizar sumillas vacías para que el constraint las trate como ausentes.
update public.courses
set summary = null
where summary is not null
  and btrim(summary) = '';

-- Completar valores predeterminados únicamente después del backfill.
-- Los cursos no incluidos en el snapshot quedan INCOMPLETO.
update public.courses
set
  is_hidden = coalesce(is_hidden, false),
  is_elective = coalesce(is_elective, false),
  avg_difficulty = coalesce(avg_difficulty, 0.00),
  status = coalesce(
    nullif(upper(btrim(status)), ''),
    'INCOMPLETO'
  )
where is_hidden is null
   or is_elective is null
   or avg_difficulty is null
   or status is null
   or btrim(status) = ''
   or status <> upper(btrim(status));

-- Validar el backfill antes de imponer restricciones.

do $$
begin
  if exists (
    select 1
    from public.courses
    where system_id is null
  ) then
    raise exception
      'Backfill incompleto: existen cursos sin system_id. Revise migration_course_state.';
  end if;

  if exists (
    select 1
    from public.courses
    where status not in ('INCOMPLETO', 'COMPLETO', 'ARCHIVADO')
  ) then
    raise exception
      'Backfill inválido: existen cursos con status fuera del catálogo permitido.';
  end if;

  if exists (
    select 1
    from public.courses
    where code is null
       or code !~ '^[A-Z]{2,3}[0-9]{2,3}$'
  ) then
    raise exception
      'Backfill inválido: existen cursos con códigos fuera del formato permitido.';
  end if;

  if exists (
    select upper(btrim(code))
    from public.courses
    group by upper(btrim(code))
    having count(*) > 1
  ) then
    raise exception
      'Backfill inválido: existen códigos de curso duplicados.';
  end if;
end
$$;

-- Aplicar DEFAULT y NOT NULL después de recuperar los datos existentes.
alter table public.courses
  alter column is_hidden set default false,
  alter column is_hidden set not null,
  alter column is_elective set default false,
  alter column is_elective set not null,
  alter column avg_difficulty set default 0.00,
  alter column status set default 'INCOMPLETO',
  alter column status set not null,
  alter column system_id set not null;

-- Recrear las restricciones dependientes de los datos normalizados.
alter table public.courses
  drop constraint if exists courses_code_format,
  drop constraint if exists courses_status_check,
  drop constraint if exists courses_summary_length_check;

alter table public.courses
  add constraint courses_code_format
    check (code ~ '^[A-Z]{2,3}[0-9]{2,3}$'),
  add constraint courses_status_check
    check (status in ('INCOMPLETO', 'COMPLETO', 'ARCHIVADO')),
  add constraint courses_summary_length_check
    check (
      summary is null
      or (
        char_length(btrim(summary)) >= 1
        and char_length(btrim(summary)) <= 1000
      )
    );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.courses'::regclass
      and conname = 'courses_code_key'
  ) then
    alter table public.courses
      add constraint courses_code_key
      unique (code);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.courses'::regclass
      and conname = 'courses_system_id_fkey'
  ) then
    alter table public.courses
      add constraint courses_system_id_fkey
      foreign key (system_id)
      references public.evaluation_systems(system_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.courses'::regclass
      and conname = 'courses_subsystem_id_fkey'
  ) then
    alter table public.courses
      add constraint courses_subsystem_id_fkey
      foreign key (subsystem_id)
      references public.evaluation_subsystems(subsystem_id);
  end if;

end
$$;

alter table public.courses
  enable row level security;

drop policy if exists "public read courses"
  on public.courses;

drop policy if exists "public read visible courses"
  on public.courses;

create policy "public read visible courses"
on public.courses
for select
to anon, authenticated
using (is_hidden = false);

revoke all privileges
on table public.courses
from public, anon, authenticated;

revoke all privileges
on sequence public.courses_id_seq
from public, anon, authenticated;

grant all privileges
on table public.courses
to service_role;

grant all privileges
on sequence public.courses_id_seq
to service_role;

grant select
on public.courses
to anon, authenticated;

commit;