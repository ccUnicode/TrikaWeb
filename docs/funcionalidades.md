# Funcionalidades de TrikaWeb

## Modulo academico

- Listado de cursos y detalle por codigo (`/curso/[code]`).
- Visualizacion de planchas por curso y ciclo.
- Visualizacion de ranking de planchas por dificultad y vistas.
- Descarga o visualizacion de PDF de planchas y solucionarios.
- Interés en planchas: toggle "me interesa" para medir demanda.
- Feedback en planchas: estrellas y comentarios con moderación.

## Modulo de profesores

- Listado de profesores visibles.
- Vista de detalle de profesor con estadisticas y reseñas paginadas.
- Calificacion por dimensiones:
  - `difficulty`
  - `didactic`
  - `resources`
  - `responsability`
  - `grading`
- Calculo de `overall` automatico en backend.
- Comentarios anónimos u opcionalmente con nombre/email.

## Sistema de evaluaciones

- Gestión de sistemas de evaluación (regímenes de notas).
- Tipos de evaluación configurables (PC1, PC2, EP, EF, etc.) asociados a cada curso.
- Pesos de notas configurables por sistema de evaluación.
- Subsistemas con cantidad de prácticas variable.

## Plan de estudios

- Gestión de planes de estudio por especialidad/carrera.
- Organización de cursos por ciclo dentro de un plan.
- Prerrequisitos entre cursos.
- Especialidades y carreras disponibles.

## Sistema de ratings y anti-spam

- Un voto por `device_id` para planchas y profesores.
- Limite por IP hasheada para evitar abuso.
- Votacion editable y eliminable por el mismo cliente.
- Límite de 3 votos por IP por profesor/plancha.

## Busqueda

- Endpoint de autocomplete (`/api/search`) sobre cursos, profesores y planchas.
- Matching por texto en codigo, nombre, ciclo, exam_type y comentario.
- Scoring por relevancia con normalización Unicode.

## Administracion

- Login/logout de administrador con Supabase Auth.
- Carga de planchas/solucionarios via `multipart/form-data`.
- Subida directa a Storage mediante URL firmada (evita límite 4.5MB de Vercel).
- Moderacion de comentarios:
  - listar pendientes
  - aprobar
  - ocultar
  - eliminar
- Gestion de profesores:
  - listar (incluyendo ocultos)
  - ocultar/mostrar
  - crear profesor y asociar cursos
- Gestion de cursos:
  - crear curso con sistema de evaluación
  - ocultar/mostrar
  - eliminar
- Visualización de todas las calificaciones con filtros.
- Gestión de ciclos académicos.
- Reinicio de contador de interés de planchas.

## Contribuciones de usuarios

- Usuarios externos pueden enviar planchas/solucionarios.
- Las contribuciones pasan por un flujo de revisión (pending → approved/rejected).
- Almacena datos del contribuyente (nombre, email).

## Perfiles de usuario

- Perfiles vinculados a Supabase Auth.
- Roles de usuario (admin, etc.).
- Avatares y nombres de usuario.

## Sincronizacion externa

- Scripts CLI para sincronizar Google Drive -> Supabase Storage:
  - `npm run drive:sync`
  - `npm run drive:sync-exams`
  - `npm run drive:sync-solutions`
