# Arquitectura del Proyecto

Este documento describe la estructura técnica, la base de datos y las APIs de TrikaWeb.

## 📁 Estructura de Carpetas

```
TrikaWeb/
├── src/
│   ├── components/       # Componentes de UI reutilizables (Botones, Tarjetas, Headers)
│   ├── layouts/          # Plantillas de diseño generales (LayoutBase, etc.)
│   ├── pages/            # Rutas de la aplicación (File-based routing de Astro)
│   │   ├── api/          # Endpoints de Backend (API Routes)
│   │   │   ├── sheets/   # Lógica relacionada a exámenes (votos, descargas)
│   │   │   └── teachers/ # Lógica relacionada a profesores (calificaciones)
│   │   ├── curso/        # Páginas dinámicas de cursos
│   │   └── index.astro   # Página de inicio
│   └── lib/              # Utilidades y clientes de servicios (Supabase, Helpers)
├── public/               # Assets estáticos públicos
├── supabase/             # Scripts SQL para la base de datos y seeds
└── tests/                # Tests automatizados (Playwright/Unit)
```

## 🗄️ Base de Datos (Supabase - PostgreSQL)

La base de datos relacional gestiona la información académica y las interacciones de los usuarios.

### Tablas Principales
- **`courses`**: Catálogo de cursos disponibles.
- **`teachers`**: Registro de profesores.
- **`sheets`**: Metadatos de los exámenes (tipo, ciclo, archivos).
- **`sheet_ratings`**: Votos de dificultad de los usuarios.
- **`sheet_views`**: Registro de vistas/descargas.
- **`teacher_ratings`**: Evaluaciones detalladas de profesores.
- **`courses_teachers`**: Tabla pivote para la relación muchos-a-muchos entre cursos y profesores.

### Storage Buckets
- **`exams`**: Almacenamiento seguro (privado) para PDFs de exámenes.
- **`solutions`**: Almacenamiento seguro (privado) para solucionarios.
- **`thumbnails`**: Imágenes públicas (opcional).

## 📡 API Endpoints

La comunicación entre el frontend y el backend se realiza a través de Astro API Routes.

### Exámenes
- `POST /api/sheets/:id/rate`: Registrar voto de dificultad.
- `POST /api/sheets/:id/view`: Registrar vista de un examen.
- `GET /api/sheets/:id/file`: Obtener URL firmada para descarga de examen.
- `GET /api/sheets/:id/solution`: Obtener URL firmada para descarga de solucionario.

### Profesores
- `POST /api/teachers/:id/rate`: Enviar calificación completa de un profesor.

### Administración
- `POST /api/admin/hide-comment`: Ocultar comentarios inapropiados (Moderación).
- `POST /api/admin/upload`: Endpoint para carga de archivos (requiere `ADMIN_PASS`).

## 🔒 Seguridad Implementada

- **IP Hashing**: Las direcciones IP se almacenan hasheadas con "salt" para proteger la privacidad del usuario.
- **Device Fingerprinting**: Se utiliza un ID de dispositivo único para limitar a un voto por recurso por usuario.
- **Service Role Key**: Las operaciones sensibles se realizan solo en el servidor usando la Service Key de Supabase.
- **Validación de Datos**: Todos los inputs (votos 1-5, textos) son validados antes de procesarse.
- **Integridad Referencial**: Uso de Foreign Keys en la BD para asegurar la consistencia de los datos.
