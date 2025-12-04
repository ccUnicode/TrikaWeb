# Plan de tareas por roles – TrikaWeb

## 🎯 Roles

- **Rol A** – Backend / Supabase / APIs / Deploy  
- **Rol B** – Frontend funcional (Astro/React, páginas)  
- **Rol C** – UI/UX & Dark Mode / pulido visual  
- **Rol D** – Guardados (Saved), QA y documentación ligera  

---

## 🧠 Rol A – Backend / Supabase / APIs / Deploy

### 1. Detalle de profesor (datos)

- [X] Implementar helper `getTeacherDetail(teacherId, page, pageSize)` que:
  - [X] Lea de `teachers`:
    - `id`
    - `full_name`
    - `bio`
    - `avg_overall`
    - `rating_count`
  - [X] Lea de `teacher_ratings`:
    - [X] Filtre `is_hidden = false`
    - [X] Calcule promedios por dimensión:
      - `overall`
      - `difficulty`
      - `didactic`
      - `resources`
      - `responsability`
      - `grading`
    - [X] Obtenga listado de reseñas:
      - ordenadas por `created_at DESC`
      - paginadas con `limit` + `offset`
  - [X] Lea de `courses_teachers` (+ `courses`) para obtener cursos donde dicta:
    - `id`
    - `code`
    - `name`
  - [X] Devuelva un objeto con:
    - `teacher`
    - `stats`
    - `courses`
    - `reviews`
    - `pagination` (page, pageSize, totalReviews, totalPages)

### 2. Endpoint de detalle de profesor (opcional pero recomendado)

- [X] Crear endpoint `GET /api/teachers/[id]?page=&pageSize=` que:
  - [X] Use `getTeacherDetail`
  - [X] Devuelva JSON con todos los datos calculados
  - [X] Maneje:
    - [X] 404 si el profesor no existe
    - [X] 400 si el `id` es inválido

### 3. Admin: soporte a solucionarios en video + thumbnails

- [ ] Extender `/api/admin/upload` para aceptar:
  - [ ] `solution_kind` (`'pdf' | 'video' | null`)
  - [ ] `solution_video_url` (YouTube)
  - [ ] archivo `thumbnail` (imagen) para guardar en `thumb_storage_path`
- [ ] Lógica de creación:
  - [ ] Si `solution_kind = 'pdf'` → mantener comportamiento actual (solucionario PDF)
  - [ ] Si `solution_kind = 'video'`:
    - [ ] No subir solucionario PDF
    - [ ] Validar que `solution_video_url` no esté vacío
    - [ ] Validar que la URL sea de YouTube (`youtube.com` o `youtu.be`)
    - [ ] Subir thumbnail a Storage y guardar `thumb_storage_path` en `sheets`
  - [ ] Mantener compatibilidad con registros viejos (solo PDF)

### 4. Búsqueda (lado datos, si se implementa en API)

- [X] Crear helper o endpoint `GET /api/search?query=...` que:
  - [X] Reciba `query`
  - [X] Use Supabase con `ilike` sobre cursos/profes/sheets (según alcance)
  - [X] Ordene resultados por relevancia
  - [X] Devuelva datos mínimos para pintar cards en el frontend

### 5. Deploy y configuración

- [ ] Preparar variables de entorno en el hosting (Vercel / Netlify / Render):
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_KEY` (solo server-side)
  - [ ] `IP_SALT`
  - [ ] `ADMIN_PASS`
  - [ ] Cualquier `PUBLIC_*` usado por Astro
- [ ] Configurar en Supabase:
  - [ ] CORS para permitir el dominio del hosting
  - [ ] Políticas de Storage para:
    - [ ] `exams`
    - [ ] `solutions`
    - [ ] `thumbnails` (o el bucket donde estén los thumbs)
- [ ] Agregar logs útiles:
  - [ ] Loggear errores en helpers/endpoints con contexto (nombre de función, parámetros, etc.)

---

## 💻 Rol B – Frontend funcional (Astro/React, páginas)

### 1. Página de detalle de profesor `/teachers/[id]`

- [X] Crear página dinámica `src/pages/teachers/[id].astro` que:
  - [X] Consuma `getTeacherDetail` (o `GET /api/teachers/[id]`)
- [X] Implementar layout con secciones:

**Header del profesor**
- [X] Mostrar:
  - [X] `full_name`
  - [X] `avg_overall` + `rating_count` (ej: “4.6 ⭐ (50 reseñas)”)
  - [X] `bio` (si existe)
- [X] Avatar:
  - [X] Se obtiene desde Supabase y usa `/img/fallback_teacher.jpeg` como placeholder si no hay foto
- [X] Botón “Calificar profesor”:
  - [X] Navega a la vista de calificación existente

**Barras por dimensión**
- [X] Usar `stats`:
  - [X] overall, difficulty, didactic, resources, responsability, grading
- [X] Renderizar barras horizontales con Tailwind

**Cursos asociados**
- [X] Mostrar chips/botones con cursos donde dicta
- [X] Si existen rutas por curso, linkear; si no, decorativo en v1

**Reseñas**
- [X] Listar `reviews`:
  - [X] mostrar al menos `overall` y `comment`
  - [X] fecha formateada
  - [X] comentario con texto justificado
- [X] Añadir paginación:
  - [X] “Anterior / Siguiente” o “Ver más”
- [X] Estado vacío:
  - [X] Mensaje tipo: “Todavía no hay reseñas visibles para este profesor”

---

### 2. Página de examen (planchas) con PDF + video

- [ ] En `exams/[id].astro` (o equivalente), usar campos de `sheets`:
  - [ ] `solution_kind`
  - [ ] `solution_video_url`
  - [ ] `thumb_storage_path`
- [ ] Mostrar **thumbnail**:
  - [ ] Obtener URL de `thumb_storage_path` (vía endpoint o URL firmada)
  - [ ] Fallback si no hay thumbnail
- [ ] Caso `solution_kind = 'pdf'`:
  - [ ] Mantener botón “Ver solucionario (PDF)” (endpoint actual)
- [ ] Caso `solution_kind = 'video'`:
  - [ ] Mostrar thumbnail con overlay de “Play”
  - [ ] Al hacer click:
    - [ ] Reemplazar thumbnail por `<iframe>` de YouTube embebido
    - [ ] Manejar `solution_video_url` → URL `embed`
  - [ ] (Opcional) Botón “Ver en YouTube” externo

---

### 3. Búsqueda: search-as-you-type (UI)

- [ ] En el componente del buscador:
  - [ ] Implementar debounce (~300–400 ms)
  - [ ] Llamar a:
    - [ ] endpoint `/api/search?query=...` (si existe),
    - [ ] o lógica actual mejorada, mientras escribe
- [ ] Mostrar resultados:
  - [ ] Bajo el input (dropdown) o actualizando el listado principal
  - [ ] Ordenar de modo que el resultado más relevante vaya arriba
- [ ] Estado sin resultados:
  - [ ] Mensaje de “No se encontraron resultados para ‘query’”

---

### 4. Integración para `/saved` (apoyo al Rol D)

- [ ] Recibir lista de IDs favoritos (desde lógica de localStorage)
- [ ] Implementar función/hook para:
  - [ ] Pedir a Supabase los `sheets` por esos IDs
  - [ ] Ordenarlos de forma razonable (por fecha, curso, etc.)
- [ ] Reutilizar componente de card de plancha para renderizar esos resultados en `/saved`

---

## 🎨 Rol C – UI/UX & Dark Mode / Pulido visual

### 1. Paleta dark consistente

- [ ] Definir niveles de color:
  - [ ] Fondo página (negro / gris muy oscuro)
  - [ ] Fondo de card
  - [ ] Bordes sutiles
  - [ ] Texto principal
  - [ ] Texto secundario (subtítulos)
  - [ ] Verde principal para acciones (botones, chips)
- [ ] Aplicar paleta en:
  - [ ] Home
  - [ ] Listados
  - [ ] Detalle de profesor
  - [ ] Detalle de examen
- [ ] Evitar grises demasiado lavados en subtítulos (aumentar opacidad)

### 2. Tipografía, justificación y espaciados

- [ ] Definir jerarquía tipográfica:
  - [ ] Título principal (h1)
  - [ ] Subtítulos (h2/h3)
  - [ ] Texto de cuerpo
  - [ ] Texto secundario / captions
- [ ] Ajustar `line-height` y `max-width` en:
  - [ ] Bio de profesor
  - [ ] Descripciones de cursos/planchas
  - [ ] Comentarios largos
- [ ] Aplicar texto justificado donde corresponda:
  - [ ] Bio
  - [ ] Descripciones de cursos
  - [ ] Reseñas largas

### 3. Componente de avatar de profesor

- [ ] Crear componente de avatar que:
  - [ ] Si hay foto → use `object-center object-cover`, forma redonda
  - [ ] Si no hay foto → muestre iniciales del nombre en un círculo
- [ ] Usarlo en:
  - [ ] Listado de profesores
  - [ ] Vista `/teachers/[id]`

### 4. Home / Landing y detalles visuales

- [ ] Retocar hero de la home:
  - [ ] Mensaje claro (qué hace TrikaWeb)
  - [ ] Subtítulo legible en dark
  - [ ] CTA principal bien visible (botón verde)
- [ ] Revisar:
  - [ ] Spacing vertical/horizontal entre secciones
  - [ ] Paddings de cards (uniformes)
- [ ] Implementar chips verdes de cursos donde aporte claridad (por ejemplo, en planchas o en la sección de cursos del profe)

---

## 🧩 Rol D – Guardados (Saved), QA y documentación ligera

### 1. Lógica de “Guardados” con localStorage

- [ ] Crear módulo `favorites` (p.ej. `favorites.ts`) que:
  - [ ] Use la clave `trikaweb:favorites` en `localStorage`
  - [ ] Exponga funciones:
    - [ ] `getFavorites(): number[]`
    - [ ] `isFavorite(id: number): boolean`
    - [ ] `toggleFavorite(id: number): void`
- [ ] Manejar SSR:
  - [ ] Comprobar `typeof window !== 'undefined'` antes de usar `localStorage`

### 2. Icono corazón en cards

- [ ] Añadir icono de corazón en cards de planchas/solus:
  - [ ] Corazón vacío → no favorito
  - [ ] Corazón lleno → favorito
- [ ] Integrar con `favorites`:
  - [ ] Al hacer click, llamar `toggleFavorite(id)`
  - [ ] Actualizar estado visual
- [ ] Verificar que el estado persiste al recargar (se lee de `localStorage`)

### 3. Página `/saved`

- [ ] Crear ruta `/saved` que:
  - [ ] En cliente:
    - [ ] lea IDs de favoritos desde `localStorage`
  - [ ] Si no hay favoritos:
    - [ ] mostrar estado vacío con mensaje tipo:
      - “Todavía no has guardado ninguna plancha. Usa el corazón en las cards para guardarlas aquí.”
  - [ ] Si hay favoritos:
    - [ ] pedir a Supabase los `sheets` con esos IDs (con el helper/hook de B)
    - [ ] mostrar cards de planchas reutilizando el componente existente

### 4. QA y checklist final

- [ ] Crear checklist de pruebas (puede ser un `.md` o página en Notion) que incluya:
  - [ ] Home carga sin errores
  - [ ] Búsqueda funciona mientras se escribe
  - [ ] `/teachers` → click en un profesor → vista `/teachers/[id]` correcta
  - [ ] Examen con solucionario PDF:
    - [ ] abrir vista de examen
    - [ ] abrir solucionario PDF
  - [ ] Examen con solucionario en video:
    - [ ] se ve thumbnail
    - [ ] al click se muestra iframe de YouTube
  - [ ] Guardados:
    - [ ] marcar plancha como favorita
    - [ ] aparecer en `/saved`
    - [ ] desmarcar y verificar que desaparece
  - [ ] Admin:
    - [ ] subir plancha + solucionario PDF
    - [ ] subir plancha + solucionario video + thumbnail
- [ ] Correr el checklist post-deploy y anotar bugs detectados

---
