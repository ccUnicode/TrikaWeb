# Despliegue

Este documento describe el proceso de despliegue, validación y rollback de TrikaWeb.

Para procedimientos de recuperación ante fallas, ubicación de logs y respuesta operativa, consultar [`runbook.md`](./runbook.md).

## 1. Entorno de producción

TrikaWeb se despliega mediante Vercel (Proyecto: `TrikaWeb`).

La aplicación utiliza:

- Astro con salida de servidor.
- Adapter de Vercel.
- Supabase para base de datos, autenticación y Storage.
- GitHub como repositorio de código (`ccUnicode/TrikaWeb`).

**Ramas:**
- Rama de producción (enlazada a Vercel): `main`
- Rama de pruebas e integración: `dev`

El flujo general es:

```text
GitHub
   ↓
Pull Request
   ↓
Preview Deployment
   ↓
Revisión
   ↓
Merge a rama de prueba (dev)
   ↓
Preview Deployment
   ↓
Pull Request
   ↓
Merge a rama de producción (main)
   ↓
Verificación
```

---

## 2. Requisitos previos

Antes de desplegar una versión:

- Tener acceso al repositorio de GitHub.
- Tener acceso al proyecto de Vercel.
- Confirmar que las variables de entorno necesarias existen en Vercel.
- Confirmar que las migraciones requeridas fueron revisadas.
- Confirmar que no existen secretos dentro del repositorio.
- Tener acceso a Supabase cuando el cambio afecte base de datos, autenticación o Storage.

---

## 3. Validación antes del despliegue

Antes de crear o aprobar un Pull Request hacia producción, ejecutar:

```bash
npm ci
npm run build
```

Todos los comandos deben finalizar correctamente.

Si una prueba no puede ejecutarse por una limitación conocida, debe quedar documentado en el Pull Request.

Además, deben probarse manualmente los flujos afectados por el cambio.

Ejemplos:

- autenticación;
- navegación entre cursos;
- acceso a planchas;
- endpoints modificados;
- formularios;
- funcionalidades administrativas;
- Storage;
- cambios de base de datos.

---

## 4. Preview Deployments

Los Pull Requests pueden generar deployments de preview en Vercel.

La preview debe utilizarse para validar cambios antes del merge cuando corresponda.

Antes de aprobar un cambio visual o funcional, revisar:

- que la página cargue correctamente;
- que los flujos modificados funcionen;
- que no existan errores inesperados;
- que las variables de entorno necesarias estén disponibles;
- que no se expongan secretos en el cliente.

Un Preview Deployment no reemplaza las validaciones locales.

---

## 5. Despliegue a producción

El despliegue productivo se realiza mediante la integración entre GitHub y Vercel.

El flujo esperado es:

1. Crear el Pull Request desde `dev`.
2. Ejecutar las validaciones correspondientes.
3. Esperar revisión.
4. Aprobar el Pull Request.
5. Realizar merge hacia la rama main.
6. Esperar que Vercel finalice el deployment.
7. Confirmar que el deployment aparezca como listo.
8. Ejecutar las verificaciones post-deploy.

No considerar una versión desplegada únicamente porque Vercel haya terminado el build.

La versión debe validarse funcionalmente.

---

## 6. Variables de entorno en Vercel

Las variables necesarias deben configurarse desde el panel del proyecto de Vercel.

No deben registrarse valores reales en este documento.

Las variables utilizadas actualmente por el proyecto incluyen, según corresponda:

```text
SUPABASE_URL
SUPABASE_SERVICE_KEY
IP_SALT
GOOGLE_APPLICATION_CREDENTIALS
DRIVE_EXAMS_FOLDER_ID
DRIVE_SOLUTIONS_FOLDER_ID
PUBLIC_SUPABASE_URL
PUBLIC_SUPABASE_ANON_KEY
```

Las variables privadas no deben exponerse al navegador.

Las variables con prefijo `PUBLIC_` pueden formar parte del código enviado al cliente.

Antes de agregar una variable nueva:

1. Añadirla a `.env.example`.
2. Documentar su propósito.
3. Configurarla en los ambientes necesarios.
4. Verificar que no contenga secretos si utiliza prefijo `PUBLIC_`.

---

## 7. Verificación posterior al despliegue

Después de cada deployment productivo, ejecutar como mínimo las siguientes verificaciones.

### Aplicación

- [ ] La página principal carga correctamente.
- [ ] La navegación principal funciona.
- [ ] Las páginas de cursos cargan.
- [ ] Las páginas de docentes cargan.
- [ ] Las planchas accesibles pueden consultarse.
- [ ] No existen errores visibles inesperados.

### Autenticación

- [ ] El inicio de sesión de estudiantes funciona.
- [ ] El callback de Supabase Auth funciona.
- [ ] El cierre de sesión funciona.
- [ ] Las rutas protegidas respetan la sesión.
- [ ] El acceso administrativo funciona cuando corresponda.

### API

- [ ] Los endpoints críticos responden correctamente.
- [ ] Los endpoints protegidos rechazan accesos no autorizados.
- [ ] No se exponen errores internos de PostgreSQL o Supabase.

### Storage

- [ ] Los PDFs accesibles cargan correctamente.
- [ ] Los solucionarios accesibles cargan correctamente.
- [ ] Las miniaturas cargan.
- [ ] Los recursos privados no quedan expuestos públicamente.

### Vercel

- [ ] El deployment aparece como listo.
- [ ] No existen errores nuevos relevantes en los logs.

### Supabase

- [ ] No aparecen errores inesperados relacionados con base de datos.
- [ ] No aparecen errores nuevos de autenticación.
- [ ] No existen fallos inesperados de RLS o permisos.

---

## 8. Rollback de aplicación

Si una nueva versión introduce un fallo crítico, se debe regresar a una versión estable.

Antes de hacer rollback:

1. Confirmar que el problema fue introducido por el deployment reciente.
2. Revisar logs.
3. Identificar el último deployment estable.
4. Confirmar si la versión incluye cambios de base de datos.

El rollback de aplicación puede realizarse mediante uno de estos mecanismos:

### Opción A: restaurar un deployment anterior en Vercel

Desde el proyecto de Vercel:

1. Abrir la sección de deployments.
2. Identificar el último deployment estable.
3. Utilizar la opción disponible para volver a promover o restaurar esa versión.
4. Verificar nuevamente los flujos críticos.

La disponibilidad y nombre exacto de esta opción dependen de la configuración actual de Vercel.

### Opción B: revertir el cambio en Git

Si corresponde, crear un revert del commit o Pull Request problemático.

Ejemplo:

```bash
git revert <commit>
```

Luego:

1. Crear el Pull Request correspondiente si el flujo del equipo lo requiere.
2. Hacer merge.
3. Esperar un nuevo deployment.
4. Ejecutar la verificación post-deploy.

---

## 9. Rollback y cambios de base de datos

Un rollback de Vercel no revierte automáticamente la base de datos.

Antes de revertir código que depende de una migración, verificar si la versión anterior es compatible con el esquema actual.

Las migraciones pueden modificar:

- columnas;
- constraints;
- datos;
- funciones;
- triggers;
- policies;
- permisos.

Por ello:

- no asumir que una migración puede deshacerse automáticamente;
- evaluar cada rollback de base de datos de forma individual;
- evitar migraciones destructivas sin estrategia de recuperación;
- crear backups antes de cambios de riesgo.

Se prefiere una migración correctiva sobre una reversión destructiva improvisada.

---

## 10. Backups de base de datos

Antes de ejecutar migraciones con riesgo sobre información existente, crear un backup de la base de datos.
Al utilizar un plan que puede no incluir respaldos automatizados o Point-in-Time Recovery, la copia debe realizarse manualmente mediante Supabase CLI o el Dashboard.

### Generar un backup (Exportar)

Mediante Supabase CLI (requiere Docker y haber hecho login con `npx supabase login`):

```bash
# Exportar esquema y datos
npx supabase db dump -f trikaweb-production-YYYY-MM-DD.sql --db-url "postgres://[user]:[password]@[host]:[port]/[db_name]"
```
*(Los datos de conexión se encuentran en Settings > Database en el panel de Supabase).*

Alternativamente, desde el panel web de Supabase:
1. Ir a **Database** > **Backups** o utilizar un cliente externo como DBeaver/pgAdmin para hacer un export.

Los archivos de backup no deben subirse al repositorio ni exponerse.

### Restaurar un backup

Para restaurar una base de datos desde un archivo SQL (precaución: esto sobrescribirá la base de datos):

```bash
psql -h [host] -U [user] -d [db_name] -p [port] -f trikaweb-production-YYYY-MM-DD.sql
```

---

## 11. Storage y backups

Los backups de PostgreSQL no incluyen automáticamente los archivos físicos almacenados en Supabase Storage (exámenes, solucionarios, miniaturas, avatares, etc.).

### Generar un backup de Storage

Para resguardar los archivos, se puede descargar el contenido de los buckets mediante el Dashboard de Supabase, o emplear un script utilizando AWS CLI (dado que Supabase Storage expone compatibilidad con S3).

Ejemplo con AWS CLI:
```bash
aws s3 sync s3://exams ./backup-exams --endpoint-url https://[project-ref].supabase.co/storage/v1/s3 --region eu-west-1
```
*(Requiere configurar las credenciales S3 desde Supabase Settings > Storage).*

Cualquier estrategia de recuperación completa debe contemplar ambos componentes (Base de datos y Storage).

---

## 12. Cambios de base de datos durante un release

Cuando un release incluye una migración:

1. Revisar la migración antes del deployment.
2. Identificar si es destructiva.
3. Evaluar compatibilidad con la versión anterior.
4. Crear backup cuando corresponda.
5. Aplicar la migración siguiendo el procedimiento definido.
6. Validar la estructura resultante.
7. Validar los endpoints afectados.
8. Continuar con el deployment.
9. Ejecutar verificaciones post-deploy.

No ejecutar por primera vez una migración destructiva directamente en producción.

---

## 13. Checklist previo al release

Antes del merge productivo:

- [ ] El Pull Request fue revisado.
- [ ] El issue relacionado está identificado, si existe.
- [ ] `npm run check` pasa.
- [ ] `npm run build` pasa.
- [ ] Las pruebas aplicables pasan.
- [ ] Las funcionalidades afectadas fueron verificadas.
- [ ] Las variables necesarias están configuradas.
- [ ] La documentación afectada fue actualizada.
- [ ] No existen secretos en el repositorio.
- [ ] Las migraciones fueron revisadas.
- [ ] Existe backup cuando el cambio lo requiere.
- [ ] Existe una estrategia de rollback si el cambio es de riesgo.

---

## 14. Checklist posterior al release

Después del deployment:

- [ ] Vercel muestra el deployment como listo.
- [ ] La aplicación carga.
- [ ] Los flujos críticos funcionan.
- [ ] La autenticación funciona.
- [ ] Los endpoints críticos funcionan.
- [ ] Storage funciona.
- [ ] No existen errores nuevos relevantes en logs.
- [ ] Las migraciones, si existieron, quedaron correctamente aplicadas.
- [ ] El equipo fue informado del resultado cuando corresponda.

---

## 15. Documentación relacionada

- [`runbook.md`](./runbook.md): fallas, logs, recuperación y procedimientos operativos.
- [`setup.md`](./setup.md): configuración local.
- [`arquitectura.md`](./arquitectura.md): arquitectura del sistema.
- [`api.md`](./api.md): endpoints.
