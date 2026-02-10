# Flujos del Sistema

Este documento describe los flujos principales de TrikaWeb mediante diagramas visuales.

## Arquitectura General

```mermaid
flowchart TB
    subgraph Cliente["🖥️ Cliente (Browser)"]
        UI[Astro Pages]
        JS[JavaScript Client]
    end
    
    subgraph Servidor["⚙️ Servidor (Astro API Routes)"]
        API["/api/*"]
        LIB["src/lib/data.ts"]
    end
    
    subgraph Supabase["☁️ Supabase"]
        DB[(PostgreSQL)]
        STORAGE[("Storage Buckets")]
        AUTH[Auth]
    end
    
    UI --> LIB
    JS --> API
    API --> LIB
    LIB --> DB
    API --> STORAGE
    API --> AUTH
```

---

## Flujo: Consulta de Planchas por Curso

Cuando un estudiante visita `/curso/[code]`:

```mermaid
sequenceDiagram
    actor User as Estudiante
    participant Page as /curso/[code]
    participant Data as data.ts
    participant DB as Supabase DB
    
    User->>Page: Visita /curso/INF01
    Page->>Data: getCourseByCode("INF01")
    Data->>DB: SELECT courses WHERE code=INF01
    DB-->>Data: Curso encontrado
    Data->>DB: SELECT sheets WHERE course_id=X
    DB-->>Data: Lista de planchas
    Data-->>Page: CourseDetail
    Page-->>User: Renderiza lista de planchas
```

---

## Flujo: Calificación de Plancha

Cuando un usuario califica la dificultad de una plancha:

```mermaid
sequenceDiagram
    actor User as Estudiante
    participant UI as Frontend
    participant API as /api/sheets/:id/rate
    participant DB as Supabase DB
    participant Trigger as refresh_sheet_stats
    
    User->>UI: Selecciona ⭐⭐⭐ (3)
    UI->>API: POST { score: 3, device_id }
    API->>API: Valida device_id y rate limit
    API->>DB: INSERT sheet_ratings
    DB->>Trigger: AFTER INSERT
    Trigger->>DB: UPDATE sheets SET avg_difficulty, rating_count
    DB-->>API: Rating guardado
    API-->>UI: { success: true, stats }
    UI-->>User: Muestra nuevo promedio
```

---

## Flujo: Calificación de Profesor

Cuando un usuario califica a un profesor:

```mermaid
sequenceDiagram
    actor User as Estudiante
    participant UI as Frontend
    participant API as /api/profesores/:id/rate
    participant DB as Supabase DB
    participant Trigger as refresh_teacher_stats
    
    User->>UI: Completa formulario de calificación
    Note right of UI: difficulty, didactic, resources,<br/>responsability, grading, comment
    UI->>API: POST { dimensiones, device_id }
    API->>API: Calcula overall promedio
    API->>API: Valida rate limit por IP
    API->>DB: INSERT teacher_ratings (is_hidden=true si hay comentario)
    DB->>Trigger: AFTER INSERT
    Trigger->>DB: UPDATE teachers SET avg_overall, rating_count
    DB-->>API: Rating guardado
    API-->>UI: { success: true, stats }
    UI-->>User: Confirma calificación enviada
```

---

## Flujo: Visualización/Descarga de PDF

```mermaid
sequenceDiagram
    actor User as Estudiante
    participant Page as /exams/[id]
    participant API as /api/sheets/:id/file
    participant DB as Supabase DB
    participant Storage as Supabase Storage
    
    User->>Page: Click en "Ver PDF"
    Page->>API: GET ?type=exam&mode=stream
    API->>DB: SELECT exam_storage_path FROM sheets
    API->>Storage: createSignedUrl(path)
    Storage-->>API: Signed URL (expira en minutos)
    API-->>User: Redirect a Signed URL
    
    Note over User,Storage: El PDF se muestra en el navegador
```

---

## Flujo: Búsqueda Global

```mermaid
sequenceDiagram
    actor User as Estudiante
    participant UI as SearchBar
    participant API as /api/search
    participant Data as searchEntities()
    participant DB as Supabase DB
    
    User->>UI: Escribe "cálculo"
    UI->>API: GET ?query=cálculo
    API->>Data: searchEntities("cálculo")
    
    par Búsqueda en paralelo
        Data->>DB: SELECT courses WHERE name ILIKE '%cálculo%'
        Data->>DB: SELECT teachers WHERE full_name ILIKE '%cálculo%'
        Data->>DB: SELECT sheets WHERE exam_type/cycle ILIKE '%cálculo%'
    end
    
    DB-->>Data: Resultados
    Data->>Data: scoreAgainstQuery() + ordenar por relevancia
    Data-->>API: { courses, teachers, sheets }
    API-->>UI: JSON con resultados
    UI-->>User: Muestra sugerencias ordenadas
```

---

## Flujo: Administración - Subida de Plancha

```mermaid
sequenceDiagram
    actor Admin as Administrador
    participant UI as /admin
    participant API as /api/admin/upload
    participant Storage as Supabase Storage
    participant DB as Supabase DB
    
    Admin->>UI: Selecciona PDF + metadata
    Note right of UI: course_code, exam_type,<br/>cycle, resource_kind
    UI->>API: POST multipart/form-data
    API->>API: Valida admin_pass
    API->>Storage: upload(file, path)
    Storage-->>API: storage_path
    API->>DB: INSERT sheets (metadata + path)
    DB-->>API: Sheet creada
    API-->>UI: { success: true }
    UI-->>Admin: Confirma subida exitosa
```

---

## Flujo: Moderación de Comentarios

```mermaid
stateDiagram-v2
    [*] --> Pendiente: Usuario envía comentario
    Pendiente --> Visible: Admin aprueba
    Pendiente --> Oculto: Admin oculta
    Visible --> Oculto: Admin oculta
    Oculto --> Visible: Admin aprueba
    Oculto --> Eliminado: Admin elimina
    Eliminado --> [*]
    
    note right of Pendiente
        Comentarios nuevos
        tienen is_hidden=true
    end note
```

---

## Modelo de Datos (ER Simplificado)

```mermaid
erDiagram
    COURSES ||--o{ SHEETS : has
    COURSES ||--o{ COURSES_TEACHERS : participates
    TEACHERS ||--o{ COURSES_TEACHERS : teaches
    TEACHERS ||--o{ TEACHER_RATINGS : receives
    SHEETS ||--o{ SHEET_RATINGS : receives
    SHEETS ||--o{ SHEET_VIEWS : tracks
    
    COURSES {
        bigint id PK
        text code UK
        text name
        int credits
    }
    
    TEACHERS {
        bigint id PK
        text full_name UK
        text bio
        numeric avg_overall
        int rating_count
        boolean is_hidden
    }
    
    SHEETS {
        bigint id PK
        bigint course_id FK
        text cycle
        text exam_type
        text exam_storage_path
        text solution_kind
        numeric avg_difficulty
        int rating_count
        bigint view_count
    }
    
    SHEET_RATINGS {
        bigint id PK
        bigint sheet_id FK
        uuid device_id
        text ip_hash
        int score
    }
    
    TEACHER_RATINGS {
        bigint id PK
        bigint teacher_id FK
        uuid device_id
        int overall
        int difficulty
        int didactic
        int resources
        int responsability
        int grading
        text comment
        boolean is_hidden
    }
```

---

## Sistema Anti-Spam

```mermaid
flowchart LR
    subgraph Identificación
        IP[IP Address]
        DEVICE[device_id]
    end
    
    subgraph Protección
        HASH["IP_SALT + SHA256"]
        LIMIT["write_limits table"]
        UNIQUE["UNIQUE(sheet_id, device_id)"]
    end
    
    subgraph Resultado
        BLOCK["❌ Rechazado"]
        ALLOW["✅ Permitido"]
    end
    
    IP --> HASH
    HASH --> LIMIT
    DEVICE --> UNIQUE
    
    LIMIT -->|"count_1h > limite"| BLOCK
    LIMIT -->|"count_1h <= limite"| ALLOW
    UNIQUE -->|"Ya votó"| BLOCK
    UNIQUE -->|"Nuevo voto"| ALLOW
```
