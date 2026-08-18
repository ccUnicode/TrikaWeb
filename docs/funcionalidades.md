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

## Módulo de mallas curriculares

### Vista pública (`/especialidades`)

- Catálogo de mallas publicadas agrupadas por carrera con badges de estado (Vigente / Histórica).
- Selector de versiones de plan cuando una carrera tiene múltiples planes publicados.
- Vista de detalle (`/especialidades/[id]`) con malla interactiva basada en `@xyflow/react`.

### Malla interactiva (`Curriculum.tsx`)

- Lienzo paneable y zoomable con nodos por curso y encabezados por ciclo.
- Auto-zoom al tamaño del contenedor con cálculo dinámico de `minZoom`.
- Hover en un nodo resalta aristas de prerrequisitos (color verde, animación de flujo).
- Click en un nodo abre el panel lateral con detalles del curso.
- Controles flotantes: zoom in, zoom out, reset y pantalla completa.

### Panel lateral de detalles (`CourseDetailPanel.tsx`)

- Código, nombre, tipo (Obligatorio/Electivo), créditos, sistema de evaluación y dificultad.
- Tooltip con fórmula del sistema de evaluación al hacer hover.
- Acordeón colapsable para la sumilla con transición CSS Grid.
- Lista navegable de prerrequisitos y cursos dependientes con navegación espacial animada.
- Listado de docentes vinculados con enlace a su perfil.
- Botón fijo "Ver planchas" que redirige a `/curso/[code]`.

### Constructor visual de mallas (admin)

- Panel de administración (`/admin/mallas`) para CRUD de planes de estudio y publicación.
- Constructor drag-and-drop (`/admin/mallas/builder/[id]`) con cuadrícula 10 ciclos × 15 filas.
- Sidebar con buscador de cursos y tarjetas arrastrables.
- Gestión de prerrequisitos por curso posicionado.
- Persistencia vía `save-malla` con delete-then-insert transaccional.

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
- Gestión de mallas curriculares:
  - crear, editar, eliminar planes de estudio
  - publicar/despublicar mallas
  - constructor visual drag-and-drop
- Visualización de todas las calificaciones con filtros.
- Gestión de ciclos académicos.
- Gestión de planchas:
  - listar con filtros por curso y búsqueda
  - ocultar/mostrar
  - eliminar (incluye limpieza de archivos en Storage)
- Reinicio de contador de interés de planchas.
- Revisión de contribuciones de usuarios (aprobar/rechazar).

## Contribuciones de usuarios

- Usuarios externos pueden enviar planchas o solucionarios.
- Las contribuciones pasan por un flujo de revisión (pending → approved/rejected).
- Almacena datos del contribuyente (nombre, email).
- El usuario puede listar sus contribuciones y vaciar su historial (solo se eliminan las pendientes y rechazadas, las aprobadas se conservan para medallas/historial).
- **Flujo de Planchas (Exámenes):** Al aprobar, el archivo se auto-publica (se copia a `exams` y se crea la plancha). El archivo original de contribuciones se elimina inmediatamente del Storage, pero se conserva el registro de la contribución en base de datos.
- **Flujo de Solucionarios:** Al aprobar, se mantiene en el panel del administrador hasta que sea vinculado manualmente a un examen existente. Luego, el administrador puede marcarlo como procesado ("Eliminar archivo"), lo que borra el archivo del Storage y deja el campo de la ruta en `null`, conservando el registro histórico.
- **Rechazos:** Si una contribución es rechazada, se elimina automáticamente su archivo del Storage.

## Perfiles de usuario

- Perfiles vinculados a Supabase Auth (estudiantes con correo institucional `@uni.pe`).
- Datos del perfil en `student_details` (specialty, avatar).
- Avatares y nombres de usuario.

## Sincronizacion externa

- Scripts CLI para sincronizar Google Drive -> Supabase Storage:
  - `npm run drive:sync`
  - `npm run drive:sync-exams`
  - `npm run drive:sync-solutions`

## Autenticación y sesiones

- Inicio de sesión de estudiantes mediante Google institucional (Firebase Auth).
- Restricción a correos `@uni.pe`.
- Sesión administrativa independiente mediante Supabase Auth y cookie `admin_session`.
- Registro directo deshabilitado (410 Gone).

## Alcance actual y proximo

Estado actual cubre flujo principal de consulta, descarga, calificacion, moderacion, mallas curriculares y contribuciones.
Como siguientes pasos recomendados:

- CI con pruebas automatizadas de API.
- Documentar contrato de errores estandar (schema comun).
- Endurecer endpoint `/api/admin/drive-sync` para usar la misma sesion admin.
- Automatización de ingreso de mallas vía CSV (deuda técnica documentada).
