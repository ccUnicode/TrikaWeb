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

## Sistema de ratings y anti-spam

- Un voto por `device_id` para calificaciones de planchas (dificultad), calificaciones de profesores y **feedback de solucionarios**.
- **Feedback de Planchas/Solucionarios:** Calificación de satisfacción por estrellas (1-5) y comentarios de texto vinculados a cada evaluación.
- Limite por IP hasheada para evitar abuso y prevención de spam por reenvío de contenido idéntico.
- Votacion y comentarios editables o eliminables por el mismo cliente.

## Busqueda

- Endpoint de autocomplete (`/api/search`) sobre cursos, profesores y planchas.
- Matching por texto en codigo, nombre, ciclo, exam_type y comentario.

## Administracion

- Login/logout de administrador.
- Carga de planchas/solucionarios via `multipart/form-data`.
- **Moderación Unificada:**
  - Gestión centralizada de opiniones de profesores y comentarios de planchas/solucionarios en una sola interfaz.
  - Filtros por **categoría** (Profesores / Planchas) y **estado** (Pendiente / Historial).
  - Acciones rápidas: ocultar (soft-delete reactivo) y marcar como revisado.
- Eliminación de recursos: Eliminación independiente de la plancha y del solucionario.
- Gestion de profesores:
  - listar (incluyendo ocultos)
  - ocultar/mostrar
  - crear profesor y asociar cursos

## Sincronizacion externa

- Scripts CLI para sincronizar Google Drive -> Supabase Storage:
  - `npm run drive:sync`
  - `npm run drive:sync-exams`
  - `npm run drive:sync-solutions`

## Alcance actual y proximo

Estado actual cubre flujo principal de consulta, descarga, calificacion y moderacion.
Como siguientes pasos recomendados:

- CI con pruebas automatizadas de API.
- Documentar contrato de errores estandar (schema comun).
- Endurecer endpoint `/api/admin/drive-sync` para usar la misma sesion admin.
