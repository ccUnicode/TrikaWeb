# Funcionalidades de TrikaWeb

## Modulo academico

- Listado de cursos y detalle por codigo (`/curso/[code]`).
- Visualizacion de planchas por curso y ciclo.
- Visualizacion de ranking de planchas por dificultad y vistas.
- Descarga o visualizacion de PDF de planchas y solucionarios.

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

## Busqueda

- Endpoint de autocomplete (`/api/search`) sobre cursos, profesores y planchas.
- Matching por texto en codigo, nombre, ciclo, exam_type y comentario.

## Administracion

- Login/logout de administrador.
- Carga de planchas/solucionarios via `multipart/form-data`.
- Moderacion de comentarios:
  - listar pendientes
  - aprobar
  - ocultar
  - eliminar
- Gestion de profesores:
  - listar (incluyendo ocultos)
  - ocultar/mostrar
  - crear profesor y asociar cursos
- Gestión de mallas curriculares:
  - crear, editar, eliminar planes de estudio
  - publicar/despublicar mallas
  - constructor visual drag-and-drop

## Sincronizacion externa

- Scripts CLI para sincronizar Google Drive -> Supabase Storage:
  - `npm run drive:sync`
  - `npm run drive:sync-exams`
  - `npm run drive:sync-solutions`

## Alcance actual y proximo

Estado actual cubre flujo principal de consulta, descarga, calificacion, moderacion y mallas curriculares.
Como siguientes pasos recomendados:

- CI con pruebas automatizadas de API.
- Documentar contrato de errores estandar (schema comun).
- Endurecer endpoint `/api/admin/drive-sync` para usar la misma sesion admin.
- Automatización de ingreso de mallas vía CSV (deuda técnica documentada).

