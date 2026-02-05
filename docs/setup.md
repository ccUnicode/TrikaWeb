# Guía de Configuración y Desarrollo

Esta guía detalla los pasos para configurar el entorno de desarrollo, las variables de entorno necesarias y los flujos de trabajo recomendados.

## 🛠️ Requisitos Previos

- **Node.js**: v18 o superior.
- **Git**: Para control de versiones.
- **Cuenta en Supabase**: Para la base de datos y autenticación.

## ⚙️ Configuración de Variables de Entorno

El proyecto utiliza un archivo `.env` para manejar credenciales sensibles. **Nunca** debes subir este archivo al repositorio.

1. Copia el archivo de ejemplo:
   ```bash
   cp .env.example .env
   ```

2. Configura las siguientes variables en tu archivo `.env`:

   **Backend (Server Only - Privado)**:
   - `SUPABASE_URL`: URL de tu proyecto Supabase.
   - `SUPABASE_SERVICE_KEY`: Key con permisos de administración (Service Role). Úsala con precaución.
   - `IP_SALT`: Una cadena aleatoria usada para hashear las IPs de los usuarios.
   - `ADMIN_PASS`: Contraseña para acceder a funciones administrativas (ej. uploads).

   **Frontend (Client - Público)**:
   - `PUBLIC_SUPABASE_URL`: La misma URL de tu proyecto.
   - `PUBLIC_SUPABASE_ANON_KEY`: Key pública (Anon) para consultas desde el cliente.

## 🚀 Base de Datos (Supabase)

Para replicar el esquema de la base de datos en tu entorno local o nuevo proyecto:

1. Ve al "SQL Editor" en tu dashboard de Supabase.
2. Ejecuta el contenido de `supabase/schema.sql` para crear las tablas y políticas de seguridad.
3. Ejecuta `supabase/function_triggers.sql` si existen triggers o funciones almacenadas.
4. Para poblar la base de datos con datos de prueba, ejecuta `supabase/seed.sql`.

## 📦 Scripts y Comandos

| Comando | Descripción |
|---------|-------------|
| `npm install` | Instala todas las dependencias del proyecto. |
| `npm run dev` | Inicia el servidor de desarrollo local en `http://localhost:4321`. |
| `npm run build` | Compila el proyecto para producción. |
| `npm run preview` | Vista previa de la build de producción localmente. |
| `npm run drive:sync` | Sincroniza archivos desde Google Drive (si está configurado). |

## 🤝 Convenciones de Código y Contribución

### Estilo de Commits
Seguimos la convención de **Conventional Commits**:
- `feat(scope)`: Nueva funcionalidad.
- `fix(scope)`: Corrección de errores.
- `docs`: Cambios en documentación.
- `style`: Cambios de formato (espacios, puntos y comas).
- `refactor`: Refactorización de código sin cambios en lógica.

### Flujo de Trabajo (Git Flow simplificado)
1. **Main**: Rama de producción. Estable.
2. **Feat Branches**: Crea una rama `feat/nombre-feature` para nuevos desarrollos.
3. **Pull Request**: Abre un PR hacia `main` cuando termines tu tarea.

## 👮 Administración y Moderación

- La configuración de moderación (palabras prohibidas) se encuentra en `config/moderation.json`.
- Para acciones administrativas como subir archivos, se utiliza el endpoint `/api/admin/upload` autenticado con `ADMIN_PASS`.
