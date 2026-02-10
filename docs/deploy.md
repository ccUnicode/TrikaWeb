# Deploy

## Entorno objetivo

- Plataforma: Vercel
- Adapter Astro: `@astrojs/vercel`
- Modo de salida: `server`
- Dominio configurado en `astro.config.mjs`: `https://trikaweb.ccunicode.org`

## Build local de verificacion

```bash
npm run build
npm run preview
```

## Variables requeridas en Vercel

### Servidor

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `IP_SALT`
- `ADMIN_PASS`

### Cliente

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`

### Opcionales (solo si usan sync por script externo)

- `GOOGLE_APPLICATION_CREDENTIALS`
- `DRIVE_EXAMS_FOLDER_ID`
- `DRIVE_SOLUTIONS_FOLDER_ID`

## Checklist de release

1. Confirmar que `npm run build` termina sin errores.
2. Validar rutas criticas en preview:
   - `/`
   - `/cursos`
   - `/profesores`
   - `/exams/[id]`
3. Validar endpoints criticos:
   - `/api/search`
   - `/api/sheets/:id/file`
   - `/api/profesores/:id/detail`
4. Confirmar permisos de buckets en Supabase.
5. Confirmar que las variables de entorno en Vercel estan completas.

## Riesgos operativos conocidos

- `/api/admin/drive-sync` esta como placeholder (`501`) y no ejecuta sync real.
- El sync productivo se debe ejecutar por CLI (`npm run drive:sync*`).
