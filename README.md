# TrikaWeb 📚

Plataforma web para compartir exámenes pasados, solucionarios y reseñas de profesores universitarios.

## 🎯 Funcionalidades

- 📄 Repositorio de exámenes pasados (PDFs)
- 📝 Solucionarios en PDF o videos
- ⭐ Sistema de calificación de dificultad (1-5 estrellas)
- 👨‍🏫 Reseñas y calificaciones de profesores
- 📊 Rankings de exámenes más visitados
- 🔒 Sistema anti-spam con device fingerprinting

---

## 🛠️ Tecnologías

- **Frontend:** Astro + TailwindCSS
- **Backend:** Astro API Routes
- **Base de datos:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage (PDFs)
- **Autenticación:** Supabase Auth (futuro)

---

## 📁 Estructura del Proyecto

```
TrikaWeb/
├── src/
│   ├── components/       # Componentes reutilizables
│   ├── layouts/          # Layouts de página
│   ├── pages/
│   │   ├── api/          # API endpoints (backend)
│   │   │   ├── sheets/[id]/
│   │   │   │   ├── rate.ts      # Votar dificultad
│   │   │   │   ├── view.ts      # Registrar vista
│   │   │   │   ├── file.ts      # Descargar examen
│   │   │   │   └── solution.ts  # Descargar solucionario
│   │   │   └── teachers/[id]/
│   │   │       └── rate.ts      # Calificar profesor
│   │   ├── cursos.astro
│   │   ├── teachers.astro
│   │   └── index.astro
│   └── lib/
│       ├── supabase.client.ts   # Cliente Supabase (frontend)
│       ├── supabase.server.ts   # Admin Supabase (backend)
│       └── utils.ts             # Funciones auxiliares
├── public/              # Archivos estáticos
├── .env.example         # Plantilla de variables de entorno
└── test-api.http        # Pruebas de API (REST Client)
```

---

## 🚀 Instalación y Configuración

### 1. Clonar repositorio

```bash
git clone https://github.com/tu-usuario/trikaweb.git
cd trikaweb
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Copia `.env.example` a `.env` y completa con tus credenciales de Supabase:

```bash
cp .env.example .env
```

Edita `.env`:

```env
# SERVER ONLY (backend)
SUPABASE_URL="https://tu-proyecto.supabase.co"
SUPABASE_SERVICE_KEY="tu_service_role_key"
IP_SALT="tu_salt_aleatorio"
ADMIN_PASS="tu_contraseña_admin"

# CLIENT (frontend - público)
PUBLIC_SUPABASE_URL="https://tu-proyecto.supabase.co"
PUBLIC_SUPABASE_ANON_KEY="tu_anon_key"
```

> ⚠️ **IMPORTANTE:** Nunca subas el archivo `.env` a GitHub

### 4. Iniciar servidor de desarrollo

```bash
npm run dev
```

Abre [http://localhost:4321](http://localhost:4321) en tu navegador.

---

## 📡 API Endpoints

### Exámenes

#### Votar dificultad
```http
POST /api/sheets/:id/rate
Content-Type: application/json

{
  "device_id": "uuid-del-navegador",
  "score": 4
}
```

#### Registrar vista
```http
POST /api/sheets/:id/view
Content-Type: application/json

{
  "device_id": "uuid-del-navegador"
}
```

#### Descargar examen
```http
GET /api/sheets/:id/file
```

#### Descargar solucionario
```http
GET /api/sheets/:id/solution
```

### Profesores

#### Calificar profesor
```http
POST /api/teachers/:id/rate
Content-Type: application/json

{
  "device_id": "uuid-del-navegador",
  "overall": 5,
  "difficulty": 3,
  "didactic": 5,
  "resources": 4,
  "responsability": 5,
  "grading": 4,
  "comment": "Excelente profesor"
}
```

---

## 🧪 Probar API

Usa la extensión **REST Client** en VSCode:

1. Instala "REST Client" por Huachao Mao
2. Abre `test-api.http`
3. Click en "Send Request" sobre cada prueba

---

## 🧞 Comandos

| Comando | Acción |
|---------|--------|
| `npm install` | Instalar dependencias |
| `npm run dev` | Servidor local en `localhost:4321` |
| `npm run build` | Construir para producción |
| `npm run preview` | Preview de build |

---

## 👥 Equipo y Roles

| Rol | Responsabilidad | Estado |
|-----|----------------|--------|
| **Rol A** | DB & Storage | ✅ Completo |
| **Rol B** | API & Seguridad | ✅ Completo |
| **Rol C** | Frontend | 🚧 En proceso |
| **Rol D** | Admin & Contenido | ⏳ Pendiente |

---

## 🔒 Seguridad Implementada

- ✅ **IP Hash:** IPs hasheadas con sal para privacidad
- ✅ **Device Fingerprinting:** Un usuario = un voto por examen
- ✅ **Service Key protegida:** Solo usada en servidor
- ✅ **Validación de datos:** Solo acepta valores 1-5
- ✅ **Foreign Keys:** Previene votos en recursos inexistentes

---

## 🗄️ Base de Datos (Supabase)

### Tablas principales

- `courses` - Cursos
- `teachers` - Profesores
- `sheets` - Exámenes
- `sheet_ratings` - Calificaciones de exámenes
- `sheet_views` - Vistas de exámenes
- `teacher_ratings` - Calificaciones de profesores
- `courses_teachers` - Relación cursos-profesores

### Buckets de Storage

- `exams` - PDFs de exámenes (privado)
- `solutions` - PDFs de solucionarios (privado)
- `thumbnails` - Miniaturas (público, opcional)

---

## 📝 Convenciones de Código

### Commits
```bash
feat(scope): descripción breve
fix(scope): descripción del bug
docs: actualizar documentación
```

### Branches
- `main` - Producción
- `feat/nombre` - Nuevas funcionalidades
- `fix/nombre` - Corrección de bugs

---

## 🔮 Roadmap

### v1.0 (Actual)
- [x] Sistema de votación
- [x] Descarga de exámenes
- [x] Calificación de profesores
- [ ] Frontend completo
- [ ] Panel de administración

### v2.0 (Futuro)
- [ ] Autenticación de usuarios
- [ ] Comentarios en exámenes
- [ ] Rate limiting avanzado
- [ ] Búsqueda por texto
- [ ] Filtros avanzados

---

## 📄 Licencia

Este proyecto es de código cerrado para uso interno universitario.

---

## 🤝 Contribuir

1. Fork el proyecto
2. Crea tu rama (`git checkout -b feat/amazing-feature`)
3. Commit tus cambios (`git commit -m 'feat: Add amazing feature'`)
4. Push a la rama (`git push origin feat/amazing-feature`)
5. Abre un Pull Request



## Admin y Moderacion

- `/admin/upload` usa `ADMIN_PASS` y envia los datos a `/api/admin/upload`.
- `PLANCHA` se guarda en el bucket `exams` (`exam_storage_path`), `SOLUCIONARIO` en `solutions` (`solution_storage_path`).
- `config/moderation.json` lista las palabras prohibidas editables por contenido.
- `POST /api/admin/hide-comment` marca `is_hidden = true` en `teacher_ratings`.

## Supabase (scripts y seeds)

- Corre `supabase/schema.sql`, `supabase/function_triggers.sql` y `supabase/seed.sql` en el SQL Editor de Supabase para recrear tablas, RLS y datos de prueba.
- Estos archivos documentan la infraestructura para sincronizar otros entornos.

---

## 📞 Contacto

Para dudas o sugerencias, contactar al equipo de desarrollo.

---

**Hecho con ❤️ por el equipo TrikaWeb**
---