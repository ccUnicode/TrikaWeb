# TrikaWeb

Plataforma colaborativa para compartir examenes pasados, solucionarios y
calificaciones de profesores universitarios.

## Stack

- Frontend: Astro + Tailwind CSS
- Backend: Astro API Routes (output server)
- Base de datos y auth: Supabase (PostgreSQL)
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
