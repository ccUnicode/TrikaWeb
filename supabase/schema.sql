-- Tabla de cursos 
create table if not exists courses (
  id bigserial primary key,
  code text not null,
  name text not null,
  credits int,
  constraint courses_code_format check (code ~ '^[A-Z]{3}[0-9]{2}$')
);

-- Unicidad por código 
create unique index if not exists uq_courses_code_nocase
  on courses (lower(code));

-- RLS y policy de lectura pública
alter table courses enable row level security;
create policy "public read courses" on courses
  for select using (true);

--Tabla de profesores
create table if not exists teachers (
  id bigserial primary key,
  full_name text not null,
  bio text not null
);

-- Unicidad por nombre
create unique index if not exists uq_teachers_name_nocase
  on teachers (lower(full_name));


-- RLS y policy de lectura pública
alter table teachers enable row level security;
create policy "public read teachers" on teachers
  for select using (true);

--Tabla intermedia profesores_cursos
create table if not exists courses_teachers(
  course_id bigint not null references courses(id) on delete cascade,
  teacher_id bigint not null references teachers(id) on delete cascade,
  primary key (course_id, teacher_id)
);

-- Índice para búsquedas por docente
create index if not exists ix_courses_teachers__teacher
  on courses_teachers (teacher_id);

--RLS y public read policy
alter table courses_teachers enable row level security;
create policy "public read courses_teachers" on courses_teachers
  for select using (true);

  --Tabla índice para las exámenes y solucionarios
create table if not exists sheets(
  id bigserial primary key,
  course_id bigint not null references courses(id)  on delete cascade,
  
  --Metadata
  cycle text not null,
  exam_type text not null,
  teacher_hint text,

  --Examen
  exam_storage_path text not null,

  --Solucionario
  solution_kind text  check (solution_kind in ('pdf','video')),
  solution_storage_path text,
  solution_video_url text,
  thumb_storage_path text,

  --Métricas
  avg_difficulty numeric(3,2) default 0,
  rating_count int default 0,
  view_count bigint default 0,

  constraint sheets_solution_present_ck
  check (
    solution_kind is null
    or (solution_kind = 'pdf'   and solution_storage_path is not null)
    or (solution_kind = 'video' and solution_video_url     is not null)
  )
);

--Índice para nicidad 
create unique index if not exists uq_sheets_course_cycle_title
  on sheets (course_id, cycle, lower(exam_type));

--Índice para búsqueda
create index if not exists ix_sheets_course on sheets (course_id);

--RLS y public read
alter table sheets enable row level security;
create policy "public read sheets" on sheets
  for select using (true); 

--Tabla intermedia para las calificaciones
create table if not exists sheet_ratings (
  id bigserial primary key,
  sheet_id bigint not null references sheets(id) on delete cascade,
  device_id uuid not null,
  ip_hash text not null,
  score int not null check (score between 1 and 5),
  created_at timestamptz default now(),
  unique (sheet_id, device_id)
);

--RLS y read policy
alter table sheet_ratings enable row level security;
create policy "public read sheet_ratings" on sheet_ratings
  for select using (true);

--Tabla intermedia para las visualizaciones
create table if not exists sheet_views (
  id bigserial primary key,
  sheet_id bigint not null references sheets(id) on delete cascade,
  type text not null check (type in ('view','download')),
  device_id uuid not null,
  ip_hash text not null,
  occurred_at timestamptz default now()
);

--RLS y read policy
alter table sheet_views enable row level security;
create policy "public read sheet_views" on sheet_views
  for select using (true);

--Tabla para rate limiting por IP
create table if not exists write_limits (
  ip_hash text primary key,
  last_at timestamptz not null default now(),
  count_1h int not null default 0
);

--Tabla para guardar calificaciones de los profesores
create table if not exists teacher_ratings (
  id bigserial primary key,
  teacher_id bigint not null references teachers(id) on delete cascade,
  device_id uuid not null,
  ip_hash text not null,
  overall int not null check( overall between 1 and 5),
  difficulty int not null check (difficulty between 1 and 5),
  didactic int not null check (didactic between 1 and 5),
  resources int not null check (resources between 1 and 5),
  responsability int not null check (responsability between 1 and 5),
  grading int not null check (grading between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

--Índice para búsqueda
create index if not exists idx_teacher_ratings_teacher_id
  on teacher_ratings (teacher_id);

--RLS y read policy
alter table teacher_ratings enable row level security;
create policy "public read teacher_ratings" on teacher_ratings
  for select using (true); 
