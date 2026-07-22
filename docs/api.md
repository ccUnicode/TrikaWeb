# Referencia API

Base local: `http://localhost:4321`

## Convenciones

- Respuesta JSON en la mayoría de endpoints.
- Endpoints de admin usan cookie de sesión (`admin_session`) salvo donde se indique.
- Endpoints de rating requieren `device_id` (UUID generado en cliente).
- Errores retornan formato: `{ "error": "mensaje" }` con status HTTP apropiado.

---

## Endpoints Públicos

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
    { "id": 1, "code": "MAT01", "name": "Cálculo I", "sheetCount": 15 }
  ],
  "teachers": [
    { "id": 5, "full_name": "Juan Pérez", "avg_overall": 4.2, "rating_count": 28 }
  ],
  "sheets": [
    { "id": 12, "exam_type": "Parcial 1", "cycle": "2024-1", "course_code": "MAT01" }
  ]
}
```

---

### POST `/api/sheets/batch`

Obtener múltiples planchas por IDs (usado para "guardados").

**Request:**
```http
POST /api/sheets/batch
Content-Type: application/json

{ "ids": [1, 5, 12] }
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

Calificar dificultad de una plancha.

**Request:**
```http
POST /api/sheets/12/rate
Content-Type: application/json

{
  "score": 4,
  "device_id": "550e8400-e29b-41d4-a716-446655440000"
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
- `400`: Score fuera de rango (1-5)
- `429`: Rate limit excedido

---

### DELETE `/api/sheets/:id/rate`

Eliminar calificación propia.

**Request:**
```http
DELETE /api/sheets/12/rate
Content-Type: application/json

{ "device_id": "550e8400-e29b-41d4-a716-446655440000" }
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

---

### POST `/api/sheets/:id/view`

Registrar vista o descarga de plancha.

**Request:**
```http
POST /api/sheets/12/view
Content-Type: application/json

{
  "device_id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "download"
}
```

**Response (200):**
```json
{ "success": true }
```

---

### GET `/api/sheets/:id/file`

Obtener PDF de plancha (redirect a signed URL).

**Request:**
```http
GET /api/sheets/12/file?type=exam&mode=stream
```

**Parámetros:**
| Param | Valores | Default |
|-------|---------|---------|
| `type` | `exam`, `solution` | `exam` |
| `mode` | `stream`, `download` | `stream` |

**Response:** `302 Redirect` a Supabase signed URL.

---

### GET `/api/sheets/:id/solution`

Obtener solucionario (PDF o video).

**Request:**
```http
GET /api/sheets/12/solution
```

**Response:**
- `302 Redirect` a signed URL (PDF) o URL de video
- `404` si no existe solucionario

---

### GET `/api/sheets/:id/interest`

Verificar si un dispositivo tiene interés en una plancha.

**Request:**
```http
GET /api/sheets/12/interest?device_id=550e8400-e29b-41d4-a716-446655440000
```

**Response (200):**
```json
{ "interested": true }
```

---

### POST `/api/sheets/:id/interest`

Registrar o quitar interés en una plancha (toggle). Si el dispositivo ya tiene interés, se elimina; si no, se registra.

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
  "success": true,
  "interested": true,
  "interest_count": 15
}
```

**Errores:**
- `400`: ID inválido o falta `device_id`
- `429`: Rate limit excedido (300 req/hora)

---

### GET `/api/cursos`

Listar todos los cursos (para autocomplete).

**Request:**
```http
GET /api/cursos
```

**Response (200):**
```json
{
  "ok": true,
  "cursos": [
    { "id": 1, "code": "MAT01", "name": "Cálculo I" },
    { "id": 2, "code": "MAT02", "name": "Cálculo II" }
  ]
}
```

---

### GET `/api/cursos/:cursoCode/profesores`

Obtener los profesores asociados a un curso dado su código.

**Request:**
```http
GET /api/cursos/MAT01/profesores
```

**Response (200):**
```json
{
  "ok": true,
  "profesores": [
    { "id": 5, "full_name": "Juan Pérez" },
    { "id": 8, "full_name": "María García" }
  ]
}
```

**Response si el curso no existe:**
```json
{ "ok": true, "profesores": [] }
```

---

### GET `/api/profesores/:id/detail`

Detalle de profesor con stats y reseñas paginadas.

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
      { "code": "MAT01", "name": "Cálculo I" },
      { "code": "MAT02", "name": "Cálculo II" }
    ]
  },
  "stats": {
    "avg_overall": 4.2,
    "avg_difficulty": 3.8,
    "avg_didactic": 4.5,
    "avg_resources": 4.0,
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

Calificar a un profesor.

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
  "comment": "Muy buen profesor, explica con claridad.",
  "device_id": "550e8400-e29b-41d4-a716-446655440000"
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

> **Nota:** Si incluye `comment`, la reseña inicia con `is_hidden=true` hasta moderación.

---

### GET `/api/profesores/:id/rate`

Verificar si el usuario ya calificó al profesor.

**Request:**
```http
GET /api/profesores/5/rate?device_id=550e8400-e29b-41d4-a716-446655440000
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

Eliminar calificación propia de profesor.

**Request:**
```http
DELETE /api/profesores/5/rate
Content-Type: application/json

{ "device_id": "550e8400-e29b-41d4-a716-446655440000" }
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

---

## Endpoints Admin

> Requieren cookie `admin_session` (salvo `login` y `upload`).

### POST `/api/admin/login`

Iniciar sesión de administrador.

**Request:**
```http
POST /api/admin/login
Content-Type: application/x-www-form-urlencoded

email=admin@example.com&password=secret123
```

**Response:** `302 Redirect` a `/admin` + set cookie `admin_session`.

---

### POST `/api/admin/logout`

Cerrar sesión de administrador.

**Response:** Elimina cookie `admin_session` + redirect a `/`.

---

### POST `/api/admin/upload`

Subir plancha o solucionario.

**Request:**
```http
POST /api/admin/upload
Content-Type: multipart/form-data

admin_pass=secret123
course_code=MAT01
exam_type=Parcial 1
cycle=2024-1
resource_kind=PLANCHA
file=@plancha.pdf
```

**Campos:**
| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| `admin_pass` | ✅ | Contraseña de admin |
| `course_code` | ✅ | Código del curso (ej: `MAT01`) |
| `exam_type` | ✅ | Tipo de examen |
| `cycle` | ✅ | Ciclo académico (ej: `2024-1`) |
| `resource_kind` | ✅ | `PLANCHA` o `SOLUCIONARIO` |
| `teacher_hint` | ❌ | Nombre del profesor (opcional) |
| `file` | ✅ | Archivo PDF |

---

### POST `/api/admin/pending-comments`

Listar comentarios pendientes de moderación.

**Response (200):**
```json
[
  {
    "id": 105,
    "teacher_id": 5,
    "teacher_name": "Juan Pérez",
    "comment": "Este profesor es...",
    "created_at": "2024-03-20T14:00:00Z"
  }
]
```

---

### POST `/api/admin/approve-comment`

Aprobar un comentario (hacerlo visible).

**Request:**
```json
{ "rating_id": 105 }
```

**Efecto:** `is_hidden = false`

---

### POST `/api/admin/hide-comment`

Ocultar un comentario.

**Request:**
```json
{ "rating_id": 105 }
```

**Efecto:** `is_hidden = true`

---

### POST `/api/admin/delete-rating`

Eliminar una calificación completamente.

**Request:**
```json
{ "rating_id": 105 }
```

**Efecto:** Elimina la fila de `teacher_ratings`.

---

### POST `/api/admin/teachers`

Listar profesores (incluye ocultos).

**Request:**
```json
{ "page": 1, "pageSize": 10, "search": "pérez" }
```

**Response (200):**
```json
{
  "teachers": [
    { "id": 5, "full_name": "Juan Pérez", "is_hidden": false, "rating_count": 28 }
  ],
  "pagination": { "page": 1, "totalPages": 3 }
}
```

---

### POST `/api/admin/toggle-teacher`

Ocultar/mostrar un profesor.

**Request:**
```json
{ "teacher_id": 5, "is_hidden": true }
```

---

### POST `/api/admin/add-teacher`

Crear nuevo profesor.

**Request:**
```json
{
  "full_name": "María García",
  "bio": "Profesora de física.",
  "course_ids": [1, 3]
}
```

---

### POST `/api/admin/add-course`

Crear un nuevo curso con sistema de evaluación. El estado (`status`) se asigna automáticamente según las reglas del sistema de evaluación.

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
  "selected_evaluations": [1, 2, 3]
}
```

**Campos:**
| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| `code` | ✅ | Código del curso (mín. 2 caracteres) |
| `name` | ✅ | Nombre del curso (mín. 2 caracteres) |
| `summary` | ✅ | Sumilla del curso (obligatorio, máx. 1000 caracteres) |
| `credits` | ✅ | Número entero mayor a 0 |
| `system_id` | ✅ | ID del sistema de evaluación |
| `subsystem_id` | ❌ | ID del subsistema de evaluación (puede ser `null`) |
| `selected_evaluations` | ❌ | Array de IDs de evaluaciones a asociar |

**Reglas de asignación de `status`:**
- Si el sistema **no requiere subsistema** → `COMPLETO` (sin evaluaciones seleccionadas)
- Si el sistema **requiere subsistema** y `subsystem_id` es `null` → `INCOMPLETO` (no se permiten evaluaciones seleccionadas)
- Si el sistema **requiere subsistema** y `subsystem_id` está definido → `COMPLETO` (debe seleccionar exactamente `practices_quantity` evaluaciones)

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
- `400`: Validación de campos fallida (código, nombre, sumilla, créditos), curso ya existe, sistema/subsistema inválido, evaluaciones repetidas o no corresponden al sistema
- `401`: Sesión admin inválida
- `500`: Error al crear curso

---

### POST `/api/admin/update-course`

Actualizar un curso existente. Recalcula el `status` y reconstruye las evaluaciones asociadas según el sistema de evaluación.

**Request:**
```http
POST /api/admin/update-course
Content-Type: application/json

{
  "course_id": 1,
  "code": "MAT01",
  "name": "Cálculo I",
  "summary": "Curso de introducción al cálculo diferencial e integral.",
  "credits": 4,
  "system_id": 1,
  "subsystem_id": null,
  "selected_evaluations": [1, 2, 3]
}
```

**Campos:**
| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| `course_id` | ✅ | ID del curso a actualizar |
| `code` | ✅ | Código del curso (mín. 2 caracteres) |
| `name` | ✅ | Nombre del curso (mín. 2 caracteres) |
| `summary` | ✅ | Sumilla del curso (obligatorio, máx. 1000 caracteres) |
| `credits` | ✅ | Número entero mayor a 0 |
| `system_id` | ✅ | ID del sistema de evaluación |
| `subsystem_id` | ❌ | ID del subsistema de evaluación (puede ser `null`) |
| `selected_evaluations` | ❌ | Array de IDs de evaluaciones a asociar |

**Reglas de asignación de `status`:**
Mismas reglas que `add-course`. Además, el campo `is_hidden` conserva su valor actual.

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
- `400`: Curso inválido o no encontrado, validación de campos fallida, ya existe otro curso con ese código, sistema/subsistema inválido, evaluaciones repetidas o no corresponden al sistema
- `401`: Sesión admin inválida
- `500`: Error al actualizar curso

---

### POST `/api/admin/drive-sync`

Sincronizar con Google Drive (placeholder).

**Request:**
```json
{ "type": "exams" }
```

**Response:** `501 Not Implemented` - usar CLI: `npm run drive:sync`

---

### POST `/api/admin/upload-url`

Generar URL firmada para subir PDFs directamente a Supabase Storage (evita límite de 4.5 MB de Vercel).

**Request:**
```http
POST /api/admin/upload-url
Content-Type: application/json

{
  "course_code": "MAT01",
  "exam_type": "Parcial 1",
  "cycle": "2024-1",
  "resource_kind": "PLANCHA"
}
```

**Campos:**
| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| `course_code` | ✅ | Código del curso (ej: `MAT01`) |
| `exam_type` | ✅ | Tipo de examen |
| `cycle` | ✅ | Ciclo académico (ej: `2024-1`) |
| `resource_kind` | ✅ | `PLANCHA` o `SOLUCIONARIO` |

**Response (200):**
```json
{
  "ok": true,
  "signedUrl": "https://...",
  "token": "...",
  "path": "MAT01/Parcial_1/2024-1.pdf",
  "bucket": "exams",
  "courseId": 1
}
```

**Errores:**
- `400`: Campos requeridos faltantes o `resource_kind` inválido
- `401`: Sesión admin inválida
- `404`: `course_code` no encontrado
- `500`: Error al generar URL firmada

---

### POST `/api/admin/reset-interest`

Reiniciar el contador de interés de una plancha (elimina todos los registros de interés y pone `interest_count` en 0).

**Request:**
```http
POST /api/admin/reset-interest
Content-Type: application/json

{ "sheet_id": 12 }
```

**Response (200):**
```json
{ "ok": true, "message": "Contador reiniciado" }
```

**Errores:**
- `400`: `sheet_id` inválido
- `401`: Sesión admin inválida
- `404`: Plancha no encontrada

---

### GET `/api/admin/cycles`

Listar ciclos académicos ordenados por año (descendente) y término (ascendente).

**Request:**
```http
GET /api/admin/cycles
```

**Response (200):**
```json
{
  "ok": true,
  "cycles": [
    { "cycle_id": 1, "cycle_code": "2024-1", "year": 2024, "term": 1 },
    { "cycle_id": 2, "cycle_code": "2024-2", "year": 2024, "term": 2 }
  ]
}
```

**Errores:**
- `401`: Sesión admin inválida
- `500`: Error al obtener ciclos

---

### GET `/api/admin/course-options`

Listar cursos visibles para usar en dropdowns/selects del panel admin.

**Request:**
```http
GET /api/admin/course-options
```

**Response (200):**
```json
{
  "ok": true,
  "courses": [
    { "id": 1, "code": "MAT01", "name": "Cálculo I" },
    { "id": 2, "code": "MAT02", "name": "Cálculo II" }
  ]
}
```

**Errores:**
- `401`: Sesión admin inválida
- `500`: Error al obtener cursos

---

### GET `/api/admin/course-evaluations`

Obtener los tipos de evaluación asociados a un curso específico.

**Request:**
```http
GET /api/admin/course-evaluations?course_id=1
```

**Response (200):**
```json
{
  "ok": true,
  "evaluations": [
    { "evaluation_id": 1, "evaluation_name": "Parcial 1", "evaluation_abr": "PC1", "evaluation_category": "examen" },
    { "evaluation_id": 2, "evaluation_name": "Parcial 2", "evaluation_abr": "PC2", "evaluation_category": "examen" }
  ]
}
```

**Errores:**
- `400`: `course_id` inválido
- `401`: Sesión admin inválida
- `500`: Error al obtener evaluaciones
