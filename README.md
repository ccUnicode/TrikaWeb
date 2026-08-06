# TrikaWeb

Plataforma colaborativa para compartir examenes pasados, solucionarios y
calificaciones de profesores universitarios.

## Stack

- Frontend: Astro + Tailwind CSS
- Backend: Astro API Routes (output server)
- Base de datos y storage: Supabase (PostgreSQL)
- Auth de estudiantes: Firebase
- Auth de administrador: Supabase Auth
- Deploy: Vercel

## Inicio rapido

```bash
npm install
cp .env.example .env
npm run dev
```

Aplicacion local: `http://localhost:4321`

## Documentacion

La documentacion completa esta en `docs/`:

- `docs/README.md`: indice general
- `docs/funcionalidades.md`: alcance funcional
- `docs/arquitectura.md`: arquitectura tecnica y base de datos
- `docs/flujos.md`: diagramas visuales de flujos del sistema
- `docs/setup.md`: instalacion y configuracion local
- `docs/api.md`: referencia de endpoints
- `docs/deploy.md`: despliegue y checklist de release

## Scripts

- `npm run dev`: entorno local
- `npm run build`: build de produccion
- `npm run preview`: vista previa de build
- `npm run drive:sync`: sync completo desde Google Drive
- `npm run drive:sync-exams`: sync solo examenes
- `npm run drive:sync-solutions`: sync solo solucionarios

### Mantenimiento manual (no sale en `package.json`)

**Regenerar miniaturas faltantes** — `scripts/rebuild-missing-thumbnails.mjs`

- **Que hace:** Lee planchas con PDF en Storage; si no existe el JPG en el bucket `thumbnails` (o con `--force`), descarga el examen, renderiza la primera pagina con PDF.js + `canvas` en Node y sube la miniatura; opcionalmente actualiza `thumb_storage_path` en la tabla `sheets`.
- **Cuando ejecutarlo:** A mano, despues de cargas masivas, imports o si quedaron PDFs sin miniatura. No corre en deploy ni en CI salvo que lo configures tu.
- **Requisitos:** `npm install` (incluye dependencias de desarrollo usadas por el script: `canvas`, etc.), variables `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (o `SUPABASE_SERVICE_KEY`) en `.env` / `.env.local`.
- **Comando:**

```bash
node scripts/rebuild-missing-thumbnails.mjs
```

- **Opcion `--force`:** Vuelve a generar aunque el archivo ya exista en Storage.
