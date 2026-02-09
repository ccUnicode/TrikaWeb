# Setup y Configuracion

## Requisitos

- Node.js 18+
- npm
- Proyecto de Supabase (DB + Storage)

## Instalacion local

```bash
npm install
cp .env.example .env
npm run dev
```

Servidor local: `http://localhost:4321`

## Variables de entorno

Fuente base: `.env.example`

### Servidor (privadas)

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `IP_SALT`
- `ADMIN_PASS`
- `GOOGLE_APPLICATION_CREDENTIALS` (si usas sync Drive)
- `DRIVE_EXAMS_FOLDER_ID` (si usas sync Drive)
- `DRIVE_SOLUTIONS_FOLDER_ID` (si usas sync Drive)

### Cliente (publicas)

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`

## Base de datos

Ejecutar en SQL Editor de Supabase, en este orden:

1. `supabase/schema.sql`
2. `supabase/function_triggers.sql`
3. `supabase/migrations/add_teacher_visibility.sql`
4. `supabase/seed.sql` (opcional)

## Storage buckets

Crear buckets:

- `exams`
- `solutions`
- `thumbnails` (opcional)

## Scripts disponibles

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run drive:sync`
- `npm run drive:sync-exams`
- `npm run drive:sync-solutions`

## Notas operativas

- `SUPABASE_SERVICE_KEY` no debe exponerse en cliente.
- Si ejecutas scripts de Drive, valida acceso al archivo JSON de cuenta de servicio.
- El endpoint `api/admin/upload` requiere `admin_pass` en el formulario.
