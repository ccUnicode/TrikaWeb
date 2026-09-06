# TrikaWeb

Plataforma colaborativa para consultar y compartir recursos académicos universitarios, incluyendo exámenes anteriores (planchas), solucionarios, información de cursos y valoraciones de docentes.

## Stack

- Frontend: Astro + React + Tailwind CSS
- Backend: Astro API Routes
- Base de datos: Supabase PostgreSQL
- Autenticación: Supabase Auth
- Storage: Supabase Storage
- Pruebas E2E: Playwright
- Deploy: Vercel

## Requisitos

- Node.js >= 22.12.0
- npm
- Git

Para la configuración completa del entorno, consultar [`docs/setup.md`](./docs/setup.md).

## Inicio rápido

```bash
npm ci
cp .env.example .env
npm run dev
```

Aplicación local: `http://localhost:4321`

## Documentación

La documentación completa está en `docs/`:

- `docs/README.md`: índice general
- `docs/funcionalidades.md`: alcance funcional
- `docs/arquitectura.md`: arquitectura técnica y base de datos
- `docs/flujos.md`: diagramas visuales de flujos del sistema
- `docs/setup.md`: instalación y configuración local
- `docs/api.md`: referencia de endpoints
- `docs/deploy.md`: despliegue y checklist de release

## Scripts

- `npm run dev`: entorno local
- `npm run build`: build de producción
- `npm run preview`: vista previa de build
- `npm run check`: validación estática
- `npm run test:e2e`: pruebas de extremo a extremo
- `npm run drive:sync`: sync completo desde Google Drive
- `npm run drive:sync-exams`: sync solo exámenes
- `npm run drive:sync-solutions`: sync solo solucionarios

### Mantenimiento manual (no sale en `package.json`)

**Regenerar miniaturas faltantes** — `scripts/rebuild-missing-thumbnails.mjs`

- **¿Qué hace?:** Lee planchas con PDF en Storage; si no existe el JPG en el bucket `thumbnails` (o con `--force`), descarga el examen, renderiza la primera página con PDF.js + `canvas` en Node y sube la miniatura; opcionalmente actualiza `thumb_storage_path` en la tabla `sheets`.
- **¿Cuándo ejecutarlo?:** A mano, después de cargas masivas, imports o si quedaron PDFs sin miniatura. No corre en deploy ni en CI salvo que lo configures tú.
- **Requisitos:** `npm install` (incluye dependencias de desarrollo usadas por el script: `canvas`, etc.), variables `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (o `SUPABASE_SERVICE_KEY`) en `.env` / `.env.local`.
- **Comando:**

```bash
node scripts/rebuild-missing-thumbnails.mjs
```

- **Opción `--force`:** Vuelve a generar aunque el archivo ya exista en Storage.
