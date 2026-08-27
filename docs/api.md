# Referencia API

Base local: `http://localhost:4321`

## Convenciones

- La mayoría de endpoints responde JSON.
- Los endpoints administrativos usan la cookie de sesión `admin_session`, salvo `login`.
- Las calificaciones de planchas y profesores se asocian al usuario autenticado mediante Supabase Auth.
- Los endpoints de vistas e interés pueden requerir `device_id`, un UUID generado en el cliente.
- Los errores usan un código HTTP apropiado y normalmente incluyen `{ "error": "mensaje" }` o `{ "ok": false, "error": "mensaje" }`.

---

## Endpoints públicos

### GET `/api/search`

Búsqueda global de cursos, profesores y planchas.

**Request:**

```http
GET /api/search?query=calculo
```

**Response (200):**

```json
{
  "query": "calculo",
  "courses": [
    {
      "id": 1,
      "code": "MAT01",
      "name": "Cálculo I",
      "sheetCount": 15
    }
  ],
  "teachers": [
    {
      "id": 5,
      "full_name": "Juan Pérez",
      "avg_overall": 4.2,
      "rating_count": 28
    }
  ],
  "sheets": [
    {
      "id": 12,
      "exam_type": "Parcial 1",
      "cycle": "2024-1",
      "course_code": "MAT01"
    }
  ]
}
```

---

### POST `/api/sheets/batch`

Obtiene múltiples planchas por sus IDs. Se utiliza, entre otros casos, para cargar la sección de elementos guardados.

**Request:**

```http
POST /api/sheets/batch
Content-Type: application/json

{
  "ids": [1, 5, 12]
}
```

**Response (200):**

```json
[
  {
    "id": 1,
    "exam_type": "Parcial 1",
    "cycle": "2024-1",
    "avg_difficulty": 3.5,
    "rating_count": 42,
    "view_count": 156,
    "course_code": "MAT01",
    "course_name": "Cálculo I"
  }
]
```

---

### POST `/api/sheets/:id/rate`

Crea o actualiza la calificación de dificultad de una plancha para el usuario autenticado.

**Request:**

```http
POST /api/sheets/12/rate
Content-Type: application/json

{
  "score": 4
}
```

**Response (200):**

```json
{
  "success": true,
  "stats": {
    "avg_difficulty": 3.8,
    "rating_count": 43
  }
}
```

**Errores:**

- `400`: ID inválido, JSON inválido o `score` fuera del rango `1-5`.
- `401`: El usuario no inició sesión.
- `404`: La plancha no existe o no está disponible.
- `429`: Rate limit excedido.
- `500`: Error al guardar la calificación.

---

### GET `/api/sheets/:id/rate`

Consulta si el usuario autenticado ya calificó una plancha.

**Request:**

```http
GET /api/sheets/12/rate
```

**Response (200):**

```json
{
  "hasVoted": true,
  "rating": {
    "id": 18,
    "score": 4,
    "created_at": "2026-08-01T15:30:00.000Z"
  }
}
```

Cuando no existe una sesión válida, responde `200` con:

```json
{
  "hasVoted": false,
  "rating": null
}
```

---

### DELETE `/api/sheets/:id/rate`

Elimina la calificación de dificultad del usuario autenticado.

**Request:**

```http
DELETE /api/sheets/12/rate
```

**Response (200):**

```json
{
  "success": true,
  "deleted": true,
  "stats": {
    "avg_difficulty": 3.7,
    "rating_count": 42
  }
}
```

**Errores:**

- `400`: ID inválido.
- `401`: El usuario no inició sesión.
- `404`: No existe una calificación para eliminar.
- `500`: Error al eliminar la calificación.

---

### POST `/api/sheets/:id/view`

Registra una vista o descarga de una plancha.

**Request:**

```http
POST /api/sheets/12/view
Content-Type: application/json

{
  "device_id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "view"
}
```

El campo `type` puede representar una vista o descarga, según la implementación del cliente.

**Response (200):**

```json
{
  "success": true
}
```

---

### GET `/api/sheets/:id/file`

Obtiene el archivo de una plancha o solucionario.

**Request:**

```http
GET /api/sheets/12/file?type=exam&mode=stream
```

**Parámetros:**

| Parámetro | Valores | Default |
|---|---|---|
| `type` | `exam`, `solution` | `exam` |
| `mode` | `stream`, `download` | Redirección a URL firmada |

**Comportamiento:**

- `stream`: muestra el archivo en el navegador.
- `download`: fuerza la descarga.
- Sin un modo de transferencia: genera una URL firmada y redirige.
- Solo permite acceder cuando la plancha y su curso están visibles.

**Errores:**

- `400`: Tipo de archivo inválido.
- `404`: Plancha o archivo no disponible.
- `500`: Error al descargar o firmar el archivo.

---

### GET `/api/sheets/:id/solution`

Redirige al solucionario de una plancha.

**Request:**

```http
GET /api/sheets/12/solution
```

**Response:**

- `302`: Redirección a una URL firmada para PDF o a una URL externa de video.
- `404`: La plancha o el solucionario no están disponibles.
- `500`: Error al generar la URL o URL de video inválida.

---

### GET `/api/sheets/:id/interest`

Consulta si un dispositivo registró interés en una plancha.

**Request:**

```http
GET /api/sheets/12/interest?device_id=550e8400-e29b-41d4-a716-446655440000
```

**Response (200):**

```json
{
  "interested": true
}
```

**Errores:**

- `400`: ID o `device_id` inválido.
- `404`: Plancha no disponible.
- `409`: La plancha ya tiene solucionario disponible.
- `500`: Error interno.

---

### POST `/api/sheets/:id/interest`

Registra o elimina el interés de un dispositivo en una plancha.

**Request:**

```http
POST /api/sheets/12/interest
Content-Type: application/json

{
  "device_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (200):**

```json
{
  "ok": true,
  "interested": true,
  "interest_count": 15
}
```

**Errores:**

- `400`: ID inválido, falta `device_id` o UUID inválido.
- `404`: Plancha no disponible.
- `409`: La plancha ya tiene solucionario.
- `429`: Rate limit excedido.
- `500`: Error interno.

---

### GET `/api/cursos`

Lista cursos visibles para autocompletado y selectores públicos.

**Request:**

```http
GET /api/cursos
```

**Response (200):**

```json
{
  "ok": true,
  "cursos": [
    {
      "id": 1,
      "code": "MAT01",
      "name": "Cálculo I"
    },
    {
      "id": 2,
      "code": "MAT02",
      "name": "Cálculo II"
    }
  ]
}
```

---

### GET `/api/cursos/:cursoCode/profesores`

Obtiene profesores asociados a un curso mediante su código.

**Request:**

```http
GET /api/cursos/MAT01/profesores
```

**Response (200):**

```json
{
  "ok": true,
  "profesores": [
    {
      "id": 5,
      "full_name": "Juan Pérez"
    },
    {
      "id": 8,
      "full_name": "María García"
    }
  ]
}
```

Si el curso no existe o no tiene profesores:

```json
{
  "ok": true,
  "profesores": []
}
```

---

### GET `/api/profesores/:id/detail`

Obtiene el detalle de un profesor, estadísticas y reseñas paginadas.

**Request:**

```http
GET /api/profesores/5/detail?page=1&pageSize=5
```

**Response (200):**

```json
{
  "teacher": {
    "id": 5,
    "full_name": "Juan Pérez",
    "bio": "Profesor de matemáticas con 10 años de experiencia.",
    "avg_overall": 4.2,
    "rating_count": 28,
    "courses": [
      {
        "code": "MAT01",
        "name": "Cálculo I"
      }
    ]
  },
  "stats": {
    "avg_overall": 4.2,
    "avg_difficulty": 3.8,
    "avg_didactic": 4.5,
    "avg_resources": 4,
    "avg_responsability": 4.3,
    "avg_grading": 3.9
  },
  "reviews": [
    {
      "id": 101,
      "overall": 5,
      "comment": "Excelente profesor, muy claro.",
      "created_at": "2024-03-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 5,
    "totalReviews": 28,
    "totalPages": 6
  }
}
```

---

### POST `/api/profesores/:id/rate`

Crea o actualiza la calificación de un profesor para el usuario autenticado.

**Request:**

```http
POST /api/profesores/5/rate
Content-Type: application/json

{
  "difficulty": 4,
  "didactic": 5,
  "resources": 4,
  "responsability": 5,
  "grading": 4,
  "comment": "Muy buen profesor, explica con claridad."
}
```

**Response (200):**

```json
{
  "success": true,
  "stats": {
    "avg_overall": 4.3,
    "rating_count": 29
  }
}
```

> Si se incluye `comment`, la reseña puede iniciar oculta hasta su moderación.

**Errores:**

- `400`: ID, JSON o puntuaciones inválidas.
- `401`: El usuario no inició sesión.
- `404`: Profesor no disponible.
- `429`: Rate limit excedido.
- `500`: Error al guardar la calificación.

---

### GET `/api/profesores/:id/rate`

Consulta si el usuario autenticado ya calificó al profesor.

**Request:**

```http
GET /api/profesores/5/rate
```

**Response (200):**

```json
{
  "hasVoted": true,
  "rating": {
    "id": 101,
    "overall": 5,
    "difficulty": 4,
    "didactic": 5,
    "resources": 4,
    "responsability": 5,
    "grading": 4,
    "comment": "Muy buen profesor"
  }
}
```

---

### DELETE `/api/profesores/:id/rate`

Elimina la calificación del usuario autenticado.

**Request:**

```http
DELETE /api/profesores/5/rate
```

**Response (200):**

```json
{
  "success": true,
  "deleted": true,
  "stats": {
    "avg_overall": 4.1,
    "rating_count": 27
  }
}
```

**Errores:**

- `400`: ID inválido.
- `401`: El usuario no inició sesión.
- `404`: No existe una calificación para eliminar.
- `500`: Error al eliminar la calificación.

---

## Endpoints administrativos

> Salvo `login`, todos los endpoints de esta sección requieren una cookie `admin_session` válida.

### POST `/api/admin/login`

Inicia una sesión administrativa.

**Request:**

```http
POST /api/admin/login
Content-Type: application/x-www-form-urlencoded

email=admin@example.com&password=secret123
```

**Response:**

- Redirección al panel administrativo.
- Registra la cookie `admin_session`.

---

### POST `/api/admin/logout`

Cierra la sesión administrativa.

**Response:**

- Elimina la cookie `admin_session`.
- Redirige fuera del panel administrativo.

---

### POST `/api/admin/upload-url`

Genera una URL firmada para subir archivos directamente a Supabase Storage.

Este flujo evita enviar archivos grandes a través de la función de Vercel.

**Request de ejemplo:**

```http
POST /api/admin/upload-url
Content-Type: application/json

{
  "course_id": 1,
  "evaluation_id": 4,
  "cycle": "2024-1",
  "resource_kind": "PLANCHA",
  "is_teacher_specific": false
}
```

**Campos principales:**

| Campo | Requerido | Descripción |
|---|---|---|
| `course_id` | ✅ | ID del curso |
| `evaluation_id` | ✅ | ID de la evaluación asociada |
| `cycle` | ✅ | Ciclo con formato `AAAA-T` |
| `resource_kind` | ✅ | `PLANCHA`, `SOLUCIONARIO` o `AMBOS` |
| `is_teacher_specific` | ✅ | Indica si el recurso pertenece a un profesor |
| `teacher_id` | Condicional | Profesor asociado cuando corresponde |

**Response (200):**

La respuesta incluye la URL firmada, token, ruta y bucket necesarios para subir el archivo. Cuando se solicita `AMBOS`, incluye la información requerida para cada recurso.

**Errores:**

- `400`: Campos faltantes, ciclo inválido o tipo de recurso inválido.
- `401`: Sesión administrativa inválida.
- `404`: Curso, evaluación o profesor no encontrado.
- `409`: No existe una plancha previa para subir únicamente un solucionario.
- `500`: Error al generar la URL firmada.

---

### POST `/api/admin/upload`

Registra en la base de datos los metadatos del archivo previamente subido a Supabase Storage.

**Request de ejemplo:**

```http
POST /api/admin/upload
Content-Type: application/json

{
  "course_id": 1,
  "evaluation_id": 4,
  "cycle": "2024-1",
  "resource_kind": "PLANCHA",
  "storage_path": "MAT01/2024-1/parcial-1.pdf",
  "thumb_storage_path": "MAT01/2024-1/parcial-1.webp",
  "is_teacher_specific": false
}
```

**Reglas principales:**

- El curso debe tener configuración completa.
- La evaluación debe estar asociada al curso.
- El ciclo debe tener formato válido.
- `SOLUCIONARIO` requiere una plancha previa.
- `AMBOS` registra o actualiza plancha y solucionario en una misma operación lógica.
- Cuando el recurso es específico de un profesor, se valida la relación entre el profesor y el curso.

**Response (200):**

```json
{
  "ok": true
}
```

**Errores:**

- `400`: Metadatos o rutas inválidas.
- `401`: Sesión administrativa inválida.
- `404`: Curso, evaluación, profesor o plancha no encontrada.
- `409`: Curso incompleto, solucionario sin plancha previa o recurso incompatible.
- `500`: Error al registrar el archivo.

---

### POST `/api/admin/pending-comments`

Lista comentarios pendientes de moderación.

**Response (200):**

```json
[
  {
    "id": 105,
    "teacher_id": 5,
    "teacher_name": "Juan Pérez",
    "comment": "Comentario pendiente de revisión.",
    "created_at": "2024-03-20T14:00:00Z"
  }
]
```

---

### POST `/api/admin/approve-comment`

Aprueba un comentario y lo hace visible.

**Request:**

```json
{
  "rating_id": 105
}
```

**Efecto:** establece `is_hidden = false`.

---

### POST `/api/admin/hide-comment`

Oculta un comentario.

**Request:**

```json
{
  "rating_id": 105
}
```

**Efecto:** establece `is_hidden = true`.

---

### POST `/api/admin/delete-rating`

Elimina una calificación de profesor.

**Request:**

```json
{
  "rating_id": 105
}
```

**Efecto:** elimina la fila de `teacher_ratings`.

---

### POST `/api/admin/teachers`

Lista profesores, incluyendo los ocultos.

**Request:**

```http
POST /api/admin/teachers
Content-Type: application/json

{
  "page": 1,
  "pageSize": 20,
  "search": "pérez"
}
```

**Response (200):**

```json
{
  "ok": true,
  "teachers": [
    {
      "id": 5,
      "full_name": "Juan Pérez",
      "bio": "Profesor de matemáticas.",
      "is_hidden": false,
      "rating_count": 28
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 28,
    "totalPages": 2
  }
}
```

---

### POST `/api/admin/toggle-teacher`

Oculta o muestra un profesor.

**Request:**

```json
{
  "teacher_id": 5,
  "is_hidden": true
}
```

**Response (200):**

```json
{
  "ok": true
}
```

---

### POST `/api/admin/add-teacher`

Crea un profesor y lo asocia a uno o más cursos.

**Request:**

```json
{
  "full_name": "María García",
  "bio": "Profesora de física.",
  "course_ids": [1, 3]
}
```

---

### POST `/api/admin/mallas`

Lista planes de estudio paginados.

**Request:**
```json
{ "page": 1, "pageSize": 10 }
```

**Response (200):**
```json
{
  "ok": true,
  "plans": [
    {
      "id": "uuid",
      "year": 2021,
      "is_current": true,
      "is_published": true,
      "specialties": { "id": 1, "name": "Ingeniería de Software" },
      "plan_courses": [{ "count": 31 }]
    }
  ],
  "pagination": { "total": 5, "page": 1, "pageSize": 10, "totalPages": 1 }
}
```

---

### POST `/api/admin/add-malla`

Crea un nuevo plan de estudios. Si `is_current` es `true`, se desmarca automáticamente el plan vigente anterior de la misma especialidad (función RPC `add_malla_transaction`).

**Request:**
```json
{
  "specialty_id": 1,
  "year": 2025,
  "is_current": true
}
```

**Response (200):**

```json
{
  "ok": true,
  "plan": {
    "id": "uuid",
    "specialty_id": 1,
    "year": "2025",
    "is_current": true,
    "is_published": false
  }
}
```

---

### POST `/api/admin/edit-malla`

Edita metadatos de un plan existente. Cuando `is_current` es `true`, desmarca atómicamente los demás planes vigentes de la misma especialidad (función RPC `edit_malla_transaction`).

**Request:**
```json
{
  "id": "uuid",
  "specialty_id": 1,
  "year": 2025,
  "is_current": true
}
```

**Response (200):**

```json
{
  "ok": true
}
```

---

### POST `/api/admin/delete-malla`

Elimina un plan de estudios (borrado en cascada sobre `plan_courses` y `course_prerequisites`).

**Request:**
```json
{ "id": "uuid" }
```

**Response (200):**

```json
{
  "ok": true
}
```

---

### POST `/api/admin/toggle-malla`

Alterna el estado de publicación (`is_published`) de una malla.

**Request:**
```json
{ "planId": "uuid" }
```

**Response (200):**
```json
{ "ok": true, "is_published": true }
```

---

### POST `/api/admin/save-malla`

Persiste la estructura completa de una malla desde el constructor visual. Ejecuta un *delete-then-insert* transaccional para `plan_courses` y `course_prerequisites` (función RPC `save_malla_transaction`).

**Request:**
```json
{
  "planId": "uuid",
  "placedCourses": [
    {
      "course_id": 42,
      "cycle": 3,
      "row_index": 2,
      "prerequisites": [10, 15]
    }
  ]
}
```

**Comportamiento:**
1. Elimina todos los registros de `plan_courses` para el `planId`.
2. Inserta los nuevos cursos con su posición (`cycle`, `row_index`).
3. Reinserta los prerrequisitos de cada curso en `course_prerequisites`.
4. El servidor valida que cada prerrequisito exista en el plan y que su ciclo sea estrictamente menor al del curso; los inválidos se descartan.

---

### POST `/api/admin/drive-sync`

Sincroniza Google Drive con Supabase Storage (placeholder).

**Request:**
```json
{ "type": "exams" }
```

**Response:** `501 Not Implemented` - usar CLI: `npm run drive:sync`

---

### POST `/api/admin/courses`

Lista cursos del panel administrativo, incluyendo cursos ocultos.

**Request:**

```http
POST /api/admin/courses
Content-Type: application/json

{
  "page": 1,
  "pageSize": 50,
  "search": "cálculo",
  "status": "INCOMPLETO"
}
```

**Campos:**

| Campo | Requerido | Default | Descripción |
|---|---|---|---|
| `page` | ❌ | `1` | Página actual |
| `pageSize` | ❌ | `50` | Elementos por página, máximo `100` |
| `search` | ❌ | `""` | Filtrar por código o nombre |
| `status` | ❌ | `null` | `INCOMPLETO`, `COMPLETO` o sin filtro |

**Response (200):**

```json
{
  "ok": true,
  "courses": [
    {
      "id": 1,
      "code": "MAT01",
      "name": "Cálculo I",
      "summary": "Curso de introducción al cálculo.",
      "credits": 4,
      "subsystem_id": 1,
      "status": "COMPLETO",
      "is_hidden": false
    }
  ],
  "counts": {
    "visible": 45,
    "hidden": 5
  },
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "total": 50,
    "totalPages": 1
  }
}
```

**Errores:**

- `400`: Parámetros de paginación o estado inválidos.
- `401`: Sesión administrativa inválida.
- `500`: Error al obtener cursos.

---

### GET `/api/admin/course-options`

Lista cursos visibles para dropdowns y selectores administrativos.

**Request:**

```http
GET /api/admin/course-options
```

**Response (200):**

```json
{
  "ok": true,
  "courses": [
    {
      "id": 1,
      "code": "MAT01",
      "name": "Cálculo I"
    },
    {
      "id": 2,
      "code": "MAT02",
      "name": "Cálculo II"
    }
  ]
}
```

**Errores:**

- `401`: Sesión administrativa inválida.
- `500`: Error al obtener cursos.

---

### GET `/api/admin/course-details`

Obtiene el detalle completo de un curso para edición.

**Request:**

```http
GET /api/admin/course-details?course_id=1
```

**Response (200):**

```json
{
  "ok": true,
  "course": {
    "id": 1,
    "code": "MAT01",
    "name": "Cálculo I",
    "summary": "Curso de introducción al cálculo diferencial e integral.",
    "credits": 4,
    "system_id": 1,
    "subsystem_id": null,
    "status": "INCOMPLETO",
    "is_hidden": false,
    "selected_evaluations": [1, 2, 3]
  }
}
```

**Errores:**

- `400`: `course_id` inválido.
- `401`: Sesión administrativa inválida.
- `404`: Curso no encontrado.
- `500`: Error al obtener el curso o sus evaluaciones.

---

### POST `/api/admin/add-course`

Crea un curso con sistema y configuración de evaluación.

**Request:**

```http
POST /api/admin/add-course
Content-Type: application/json

{
  "code": "MAT01",
  "name": "Cálculo I",
  "summary": "Curso de introducción al cálculo diferencial e integral.",
  "credits": 4,
  "system_id": 1,
  "subsystem_id": null,
  "selected_evaluations": []
}
```

**Campos:**

| Campo | Requerido | Descripción |
|---|---|---|
| `code` | ✅ | Código con formato válido |
| `name` | ✅ | Nombre del curso |
| `summary` | ❌ | Sumilla, máximo `1000` caracteres |
| `credits` | ✅ | Entero mayor que `0` |
| `system_id` | ✅ | ID del sistema de evaluación |
| `subsystem_id` | ❌ | ID del subsistema o `null` |
| `selected_evaluations` | ❌ | IDs de evaluaciones variables |

**Reglas de `status`:**

- Una sumilla vacía mantiene el curso como `INCOMPLETO`.
- Si el sistema no requiere subsistema y la información obligatoria está completa, el curso puede quedar `COMPLETO`.
- Si el sistema requiere subsistema y `subsystem_id` es `null`, queda `INCOMPLETO`.
- Si requiere subsistema, debe seleccionar exactamente la cantidad de evaluaciones definida por `practices_quantity`.

**Response (200):**

```json
{
  "ok": true,
  "course": {
    "id": 1,
    "code": "MAT01",
    "name": "Cálculo I",
    "summary": "Curso de introducción al cálculo diferencial e integral.",
    "credits": 4,
    "system_id": 1,
    "subsystem_id": null,
    "status": "INCOMPLETO",
    "is_hidden": false
  }
}
```

**Errores:**

- `400`: Validación fallida, curso duplicado, sistema o subsistema inválido, o evaluaciones incompatibles.
- `401`: Sesión administrativa inválida.
- `500`: Error al crear el curso.

---

### PATCH `/api/admin/update-course`

Actualiza un curso y reconstruye sus evaluaciones asociadas.

**Request:**

```http
PATCH /api/admin/update-course
Content-Type: application/json

{
  "course_id": 1,
  "code": "MAT01",
  "name": "Cálculo I",
  "summary": "Curso de introducción al cálculo diferencial e integral.",
  "credits": 4,
  "system_id": 1,
  "subsystem_id": null,
  "selected_evaluations": []
}
```

**Reglas:**

- Aplica las mismas reglas de configuración y `status` que `add-course`.
- Conserva el valor actual de `is_hidden`.

**Response (200):**

```json
{
  "ok": true,
  "course": {
    "id": 1,
    "code": "MAT01",
    "name": "Cálculo I",
    "summary": "Curso de introducción al cálculo diferencial e integral.",
    "credits": 4,
    "system_id": 1,
    "subsystem_id": null,
    "status": "INCOMPLETO",
    "is_hidden": false
  }
}
```

**Errores:**

- `400`: Curso o campos inválidos, código duplicado, configuración académica inválida.
- `401`: Sesión administrativa inválida.
- `404`: Curso no encontrado.
- `500`: Error al actualizar el curso.

---

### POST `/api/admin/delete-course`

Elimina un curso únicamente cuando no tiene planchas asociadas.

**Request:**

```http
POST /api/admin/delete-course
Content-Type: application/json

{
  "course_id": 1
}
```

**Response (200):**

```json
{
  "ok": true
}
```

**Errores:**

- `400`: ID inválido.
- `401`: Sesión administrativa inválida.
- `404`: Curso no encontrado.
- `409`: El curso tiene planchas asociadas y debe ocultarse en lugar de eliminarse.
- `500`: Error al eliminar el curso.

---

### PATCH `/api/admin/toggle-course`

Oculta o muestra un curso.

**Request:**

```http
PATCH /api/admin/toggle-course
Content-Type: application/json

{
  "course_id": 1,
  "is_hidden": true
}
```

**Response (200):**

```json
{
  "ok": true,
  "course": {
    "id": 1,
    "is_hidden": true
  },
  "counts": {
    "visible": 44,
    "hidden": 6
  }
}
```

**Errores:**

- `400`: ID o valor de visibilidad inválido.
- `401`: Sesión administrativa inválida.
- `404`: Curso no encontrado.
- `500`: Error al actualizar la visibilidad.

---

### GET `/api/admin/cycles`

Lista ciclos académicos ordenados por año descendente y término ascendente.

**Request:**

```http
GET /api/admin/cycles
```

**Response (200):**

```json
{
  "ok": true,
  "cycles": [
    {
      "cycle_id": 1,
      "cycle_code": "2024-1",
      "year": 2024,
      "term": 1
    },
    {
      "cycle_id": 2,
      "cycle_code": "2024-2",
      "year": 2024,
      "term": 2
    }
  ]
}
```

**Errores:**

- `401`: Sesión administrativa inválida.
- `500`: Error al obtener ciclos.

---

### GET `/api/admin/evaluation-systems`

Lista sistemas de evaluación disponibles.

**Request:**

```http
GET /api/admin/evaluation-systems
```

**Response (200):**

```json
{
  "ok": true,
  "systems": [
    {
      "system_id": 1,
      "system_cod": "A",
      "system_description": "Descripción del sistema",
      "requires_subsystem": true
    }
  ]
}
```

**Errores:**

- `401`: Sesión administrativa inválida.
- `500`: Error al obtener sistemas.

---

### GET `/api/admin/evaluation-subsystems`

Lista subsistemas de evaluación disponibles.

**Request:**

```http
GET /api/admin/evaluation-subsystems
```

**Response (200):**

```json
{
  "ok": true,
  "subsystems": [
    {
      "subsystem_id": 1,
      "subsystem_cod": "S5",
      "practices_quantity": 5
    }
  ]
}
```

**Errores:**

- `401`: Sesión administrativa inválida.
- `500`: Error al obtener subsistemas.

---

### POST `/api/admin/course-evaluation-options`

Obtiene las evaluaciones variables disponibles para un sistema.

**Request:**

```http
POST /api/admin/course-evaluation-options
Content-Type: application/json

{
  "system_id": 1
}
```

**Response (200):**

```json
{
  "ok": true,
  "evaluations": [
    {
      "evaluation_id": 1,
      "evaluation_name": "Práctica 1"
    },
    {
      "evaluation_id": 2,
      "evaluation_name": "Práctica 2"
    }
  ]
}
```

**Errores:**

- `400`: `system_id` inválido.
- `401`: Sesión administrativa inválida.
- `500`: Error al obtener evaluaciones.

---

### GET `/api/admin/course-evaluations`

Obtiene las evaluaciones asociadas a un curso.

**Request:**

```http
GET /api/admin/course-evaluations?course_id=1
```

**Response (200):**

```json
{
  "ok": true,
  "evaluations": [
    {
      "evaluation_id": 1,
      "evaluation_name": "Parcial 1",
      "evaluation_abr": "PC1",
      "evaluation_category": "examen"
    },
    {
      "evaluation_id": 2,
      "evaluation_name": "Parcial 2",
      "evaluation_abr": "PC2",
      "evaluation_category": "examen"
    }
  ]
}
```

**Errores:**

- `400`: `course_id` inválido.
- `401`: Sesión administrativa inválida.
- `404`: Curso no encontrado.
- `500`: Error al obtener evaluaciones.

---

### POST `/api/admin/all-ratings`

Lista calificaciones visibles de profesores para el panel administrativo.

**Request:**

```http
POST /api/admin/all-ratings
Content-Type: application/json

{
  "page": 1,
  "pageSize": 20,
  "teacher_id": 5,
  "search": "excelente"
}
```

**Response (200):**

```json
{
  "ok": true,
  "ratings": [
    {
      "id": 105,
      "overall": 4.5,
      "difficulty": 3,
      "didactic": 5,
      "resources": 4,
      "responsability": 5,
      "grading": 4,
      "comment": "Excelente profesor",
      "created_at": "2024-03-20T14:00:00Z",
      "is_hidden": false,
      "teacher_id": 5,
      "teachers": {
        "id": 5,
        "full_name": "Juan Pérez"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 120,
    "totalPages": 6
  }
}
```

---

### POST `/api/admin/reset-interest`

Elimina los registros de interés de una plancha y restablece `interest_count` en `0`.

**Request:**

```http
POST /api/admin/reset-interest
Content-Type: application/json

{
  "sheet_id": 12
}
```

**Response (200):**

```json
{
  "ok": true
}
```

**Errores:**

- `400`: `sheet_id` inválido.
- `401`: Sesión administrativa inválida.
- `404`: Plancha no encontrada.
- `500`: Error al reiniciar el contador.

---

## Endpoints de autenticación

> Los endpoints de autenticación de estudiantes usan Supabase Auth y se manejan con cookies administradas por `@supabase/ssr`. El correo debe terminar en `@uni.pe`.

### POST `/api/auth/signin`

Inicia sesión delegando la autenticación OAuth a Supabase (Google).

**Request:**

```http
POST /api/auth/signin
Content-Type: multipart/form-data o application/x-www-form-urlencoded

next=/profile
```

**Efecto:**
- Redirige al proveedor de OAuth de Google vía Supabase.

---

### GET `/api/auth/callback`

Maneja la respuesta del flujo OAuth de Supabase.

**Efecto:**
- Intercambia el código por una sesión de Supabase Auth.
- Exige correo `@uni.pe`.
- Crea/actualiza la fila en `student_details` (`user_id`, `email`, `full_name`).
- Establece las cookies de sesión correspondientes y redirige.

**Errores:**
- Redirige a `/login?error=...` en caso de error (e.g., correo incorrecto).


---

### POST `/api/auth/register`

Registro directo de usuarios (deshabilitado a propósito).

**Response (410):**

```json
{
  "error": "El registro ahora se realiza con Google institucional"
}
```

---

### POST `/api/auth/logout`

Cierra la sesión del usuario.

**Request:**

```http
POST /api/auth/logout
Content-Type: application/json
```

**Response** (si se espera JSON): `{ "success": true }` o redirección según implementación del cliente (`src/pages/api/auth/logout.ts`).

---

## Endpoints de perfil

### POST `/api/profile/update`

Actualiza la especialidad y/o el avatar del estudiante mediante `multipart/form-data`.

**Campos:**

| Campo | Requerido | Descripción |
|---|---|---|
| `specialty` | ❌ | Nombre de la especialidad; se valida contra la tabla `specialties` |
| `avatar` | ❌ | Imagen (`image/jpeg`, `image/png`, `image/webp`), máx. 5 MB |

**Efecto:** sube el avatar (si se envía) al bucket `avatars` y actualiza `student_details`.

**Response (200):**

```json
{
  "success": true,
  "avatarUrl": "https://...",
  "specialty": "Ingeniería de Software"
}
```

### POST `/api/profile/avatar`

Reemplaza el avatar del estudiante.

**Campos (`multipart/form-data`):**

| Campo | Requerido | Descripción |
|---|---|---|
| `avatar` | ✅ | Imagen (`image/jpeg`, `image/png`, `image/webp`), máx. 2 MB |

**Efecto:** sube el archivo al bucket `avatars` y actualiza `profiles.avatar_url`.

**Response (200):**

```json
{
  "success": true,
  "profile": { "id": "...", "avatar_url": "https://...", "...": "..." }
}
```

---

## Endpoints de contribuciones

> Requieren una sesión de estudiante de Supabase Auth.

### POST `/api/contributions/create`

Envía una contribución de plancha/solucionario.

**Campos (`multipart/form-data`):**

| Campo | Requerido | Descripción |
|---|---|---|
| `course_id` | ✅ | ID del curso |
| `cycle` | ✅ | Formato `20XX-(I|II|0)` |
| `exam_type` | ✅ | `PC1..PC5`, `Parcial`, `Final` o `Sustitutorio` |
| `contribution_type` | ✅ | `sheet` o `solution` |
| `file` | ✅ | PDF o imagen, máx. 10 MB |

**Efecto:** sube el archivo al bucket `contributions` e inserta una fila con `status: "pending"`.

**Response (200):**

```json
{
  "success": true,
  "contribution": { "id": 1, "status": "pending", "...": "..." }
}
```

### GET `/api/contributions/my-contributions`

Lista las contribuciones del estudiante autenticado (más recientes primero).

**Response (200):**

```json
{
  "success": true,
  "contributions": [ { "id": 1, "status": "pending", "...": "..." } ]
}
```

### POST `/api/contributions/clear-history`

Limpia el historial de contribuciones del estudiante. Utiliza una lógica mixta de borrado:
- **Hard Delete:** Elimina de la base de datos y del bucket de almacenamiento (Storage) las contribuciones en estado `pending` o `rejected`.
- **Soft Delete:** Para las contribuciones `approved`, establece el campo `hidden_by_user = true` para ocultarlas del historial del usuario, pero las conserva en la base de datos para mantener la consistencia de los datos aportados.

**Response (200):**

```json
{
  "success": true,
  "message": "Historial de contribuciones vaciado correctamente"
}
```

### POST `/api/contributions/delete`

Elimina una contribución individual del historial del estudiante. Utiliza la misma lógica mixta de borrado (Hard Delete para pendientes/rechazadas, Soft Delete para aprobadas).

**Request (FormData):**

| Campo | Requerido | Descripción |
|---|---|---|
| `contribution_id` | ✅ | ID de la contribución a eliminar |

**Response (200):**

```json
{
  "success": true,
  "message": "Aporte eliminado correctamente del historial"
}
```

---

## Endpoints administrativos (planchas y contribuciones)

### POST `/api/admin/sheets`

Lista planchas del panel administrativo, incluyendo ocultas.

**Request:**

```json
{
  "page": 1,
  "pageSize": 20,
  "course": "cálculo",
  "q": "parcial"
}
```

**Campos:**

| Campo | Requerido | Default | Descripción |
|---|---|---|---|
| `page` | ❌ | `1` | Página actual |
| `pageSize` | ❌ | `20` | Máx. `100` |
| `course` | ❌ | `""` | Filtro por código o nombre de curso |
| `q` | ❌ | `""` | Búsqueda por `exam_type`, `cycle` o `teacher_hint` |

**Response (200):**

```json
{
  "ok": true,
  "sheets": [
    {
      "id": 1,
      "exam_type": "Parcial 1",
      "cycle": "2024-1",
      "is_hidden": false,
      "course_code": "MAT01",
      "course_name": "Cálculo I"
    }
  ],
  "counts": { "visible": 45, "hidden": 5 },
  "pagination": { "page": 1, "pageSize": 20, "total": 50, "totalPages": 3 }
}
```

### POST `/api/admin/toggle-sheet`

Alterna la visibilidad de una plancha.

**Request:**

```json
{
  "sheet_id": 1,
  "is_hidden": true
}
```

**Response (200):**

```json
{
  "ok": true,
  "counts": { "visible": 45, "hidden": 5 }
}
```

### POST `/api/admin/delete-sheet`

Elimina una plancha y sus archivos de Storage (`exams`, `solutions`, `thumbnails`).

**Request:**

```json
{
  "sheet_id": 1
}
```

**Response (200):**

```json
{
  "ok": true,
  "counts": { "visible": 45, "hidden": 5 }
}
```

**Errores:**

- `400`: ID de plancha inválido.
- `401`: Sesión administrativa inválida.
- `404`: Plancha no encontrada o ya eliminada.

### POST `/api/admin/delete-teacher`

Elimina un profesor.

**Request:**

```json
{
  "teacher_id": 5
}
```

**Response (200):**

```json
{
  "ok": true
}
```

---

### GET `/api/admin/contributions/list`

Lista las contribuciones (incluye URL firmada de 1 hora para cada archivo).

**Response (200):**

```json
{
  "success": true,
  "contributions": [
    {
      "id": 1,
      "status": "pending",
      "signedUrl": "https://...",
      "...": "..."
    }
  ]
}
```

### POST `/api/admin/contributions/review`

Aprueba o rechaza una contribución.

**Campos (`multipart/form-data`):**

| Campo | Requerido | Descripción |
|---|---|---|
| `contribution_id` | ✅ | ID de la contribución |
| `action` | ✅ | `approve` o `reject` |
| `admin_notes` | ❌ | Nota del administrador |

**Comportamiento:**

- `reject`: marca la contribución como `rejected` (con `post_status`).
- `approve` (tipo `sheet`): copia el archivo de `contributions` a `exams` y crea/actualiza la plancha correspondiente con `is_hidden: false`; el registro queda `approved`.

**Response (200):**

```json
{
  "success": true,
  "message": "Contribución aprobada correctamente"
}
```
