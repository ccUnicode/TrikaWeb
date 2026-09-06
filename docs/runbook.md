# Runbook operativo

Este documento describe qué hacer ante fallas operativas en TrikaWeb, dónde revisar logs, cómo realizar rollback y cómo recuperar el servicio.

No contiene credenciales, secretos ni valores reales de producción.

Para el proceso normal de despliegue, consultar [`deploy.md`](./deploy.md).

## 1. Propósito

El objetivo de este runbook es permitir que una persona con los accesos adecuados pueda:

- identificar dónde ocurrió una falla;
- consultar logs;
- restaurar una versión estable;
- evaluar problemas relacionados con base de datos;
- identificar limitaciones de los backups;
- verificar el servicio después de una recuperación.

---

## 2. Servicios involucrados

TrikaWeb depende principalmente de:

| Servicio     | Uso                                                |
| ------------ | -------------------------------------------------- |
| GitHub       | Repositorio, issues, ramas y Pull Requests         |
| Vercel       | Build, deployments, runtime y variables de entorno |
| Supabase     | PostgreSQL, Auth y Storage                         |
| Google Drive | Sincronización de recursos cuando aplica           |

---

## 3. Accesos necesarios

El equipo responsable de operación debe garantizar que existan personas con acceso a:

### GitHub

Permite:

- consultar código;
- revisar historial;
- revertir commits;
- crear ramas;
- crear Pull Requests;
- revisar issues.

### Vercel

Permite:

- consultar deployments;
- revisar builds;
- revisar logs;
- verificar variables de entorno;
- restaurar o promover deployments cuando corresponda.

### Supabase

Permite:

- revisar base de datos;
- revisar autenticación;
- revisar Storage;
- revisar logs;
- aplicar o verificar migraciones.

### Google Drive

Permite:

- consultar carpetas utilizadas para sincronización;
- verificar acceso de la cuenta de servicio;
- revisar recursos de origen.

No registrar en este documento:

- contraseñas;
- tokens;
- API keys;
- service role keys;
- claves privadas;
- archivos JSON de credenciales.

---

## 4. Ubicación de logs

Cuando algo falla, revisar primero el servicio relacionado.

### Error de build

Revisar:

```text
Vercel → Project → Deployments → Deployment → Build Logs
```

Casos típicos:

- error de TypeScript;
- dependencia faltante;
- variable requerida ausente;
- error de compilación;
- configuración inválida.

### Error HTTP 500 o fallo en API

Revisar:

```text
Vercel → Project → Logs / Runtime Logs
```

Si el error parece provenir de Supabase, revisar también los logs correspondientes en Supabase.

### Error de base de datos

Revisar en Supabase:

- errores SQL;
- permisos;
- RLS;
- restricciones;
- funciones;
- triggers.

### Error de autenticación

Revisar:

- Vercel Runtime Logs;
- configuración de variables;
- Supabase Auth;
- URL de callback;
- cookies de sesión.

### Error de Storage

Revisar:

- existencia del archivo;
- bucket correcto;
- permisos;
- policies;
- URL generada;
- logs del endpoint servidor que entrega el recurso.

---

## 5. Clasificación inicial de incidentes

Antes de realizar cambios, clasificar el problema.

### Nivel bajo

Ejemplos:

- error visual menor;
- recurso secundario no disponible;
- funcionalidad no crítica afectada.

Acción:

- registrar issue;
- corregir mediante flujo normal.

### Nivel medio

Ejemplos:

- una funcionalidad importante falla;
- errores repetidos en un endpoint;
- usuarios no pueden completar una acción relevante.

Acción:

- revisar logs;
- identificar deployment causante;
- evaluar hotfix o rollback.

### Nivel alto

Ejemplos:

- aplicación caída;
- autenticación inutilizable;
- pérdida de acceso a recursos críticos;
- migración dañina;
- exposición de información;
- corrupción o pérdida de datos.

Acción:

1. detener nuevos cambios;
2. identificar causa;
3. evaluar rollback;
4. verificar base de datos;
5. aplicar recuperación;
6. escalar al responsable correspondiente.

---

## 6. Incidente: deployment rompe la aplicación

### Síntomas

- página no carga;
- errores 500;
- múltiples flujos dejan de funcionar;
- error inmediatamente después de un deployment.

### Pasos

1. Abrir el deployment en Vercel.
2. Revisar Build Logs.
3. Revisar Runtime Logs.
4. Comparar con el último deployment estable.
5. Confirmar si hubo cambios de base de datos.
6. Si el problema está aislado al código, realizar rollback.
7. Verificar nuevamente la aplicación.

Consultar [`deploy.md`](./deploy.md) para el procedimiento de rollback.

---

## 7. Incidente: build falla

### Posibles causas

- TypeScript.
- Dependencias.
- `package-lock.json` desactualizado.
- Variable de entorno ausente.
- Error de Astro.
- Configuración incorrecta.

### Pasos

1. Revisar Build Logs.
2. Reproducir localmente:

```bash
npm ci
npm run check
npm run build
```

3. Comparar versión de Node.js.
4. Revisar variables de entorno.
5. Corregir el problema en una rama.
6. Crear Pull Request.
7. No modificar producción directamente para ocultar el error.

---

## 8. Incidente: API devuelve error 500

### Pasos

1. Identificar el endpoint.
2. Revisar Runtime Logs de Vercel.
3. Identificar el error interno.
4. Si utiliza Supabase, revisar:
   - tabla;
   - función;
   - RLS;
   - permisos;
   - datos;
   - migraciones recientes.
5. Reproducir el endpoint en un entorno seguro.
6. Aplicar corrección.
7. Verificar que el error interno no se esté exponiendo al cliente.

---

## 9. Incidente: autenticación no funciona

### Pasos

1. Confirmar que la aplicación carga.
2. Verificar `/api/auth/signin`.
3. Verificar `/api/auth/callback`.
4. Revisar las variables públicas de Supabase.
5. Revisar configuración del proyecto en Supabase Auth.
6. Revisar las URLs permitidas y callback.
7. Revisar Runtime Logs.
8. Probar logout y nueva sesión.

No utilizar documentación antigua de Firebase como referencia para el flujo actual.

---

## 10. Incidente: archivo de Storage no carga

### Pasos

1. Confirmar que el registro existe en base de datos.
2. Confirmar el `storage_path`.
3. Verificar que el archivo exista en el bucket.
4. Revisar si el bucket es público o privado.
5. Verificar cómo se genera la URL.
6. Revisar policies.
7. Revisar el endpoint servidor correspondiente.

Si el archivo fue eliminado físicamente de Storage, restaurar la base de datos no lo recuperará automáticamente.

---

## 11. Incidente: error después de una migración

### Pasos

1. Detener nuevas migraciones.
2. Identificar la última migración aplicada.
3. Revisar logs de Supabase.
4. Verificar:
   - tablas;
   - columnas;
   - constraints;
   - funciones;
   - triggers;
   - policies;
   - permisos.
5. Determinar si el código actual es compatible con el nuevo esquema.
6. Determinar si el código anterior también lo es.
7. Evaluar:
   - migración correctiva;
   - restauración de backup;
   - rollback controlado.

No intentar revertir una migración destructiva sin evaluar primero sus efectos sobre datos existentes.

---

## 12. Backups

### Base de datos

Los backups deben almacenarse fuera del repositorio.

Antes de cambios críticos:

- crear backup;
- identificar ambiente;
- registrar fecha;
- almacenar de forma segura.

Ejemplo de nombre:

```text
trikaweb-production-YYYY-MM-DD.sql
```

La forma exacta de generar y restaurar backups debe validarse con la configuración actual de Supabase antes de usarse en producción.

### Storage

Los archivos físicos de Supabase Storage requieren una estrategia independiente.

Los backups de base de datos no sustituyen un backup de:

```text
exams
solutions
thumbnails
avatars
contributions
```

---

## 13. Recuperación desde backup

La recuperación de base de datos debe realizarse únicamente por una persona con permisos suficientes y conocimiento del impacto.

Antes de restaurar:

1. Confirmar el backup correcto.
2. Confirmar el ambiente.
3. Evaluar si se sobrescribirán datos recientes.
4. Detener cambios concurrentes cuando sea necesario.
5. Verificar compatibilidad entre código y esquema.
6. Documentar la intervención.

Después de restaurar:

- verificar integridad;
- validar endpoints;
- validar autenticación;
- validar Storage;
- validar RLS;
- validar funciones y triggers;
- validar datos críticos.

---

## 14. Rollback

### Rollback de código

Si el fallo proviene de una versión reciente:

1. Identificar el último deployment estable.
2. Restaurar/promover ese deployment o revertir el commit.
3. Verificar los flujos críticos.
4. Confirmar que no existan incompatibilidades con base de datos.

### Rollback de base de datos

No existe un procedimiento genérico aplicable a todas las migraciones.

Cada caso debe evaluarse según:

- datos afectados;
- cambios estructurales;
- dependencia con el código;
- disponibilidad de backup;
- posibilidad de migración correctiva.

---

## 15. Verificación posterior a una recuperación

Después de recuperar el servicio:

- [ ] La página principal carga.
- [ ] El login funciona.
- [ ] El logout funciona.
- [ ] Las páginas de cursos funcionan.
- [ ] Las páginas de docentes funcionan.
- [ ] Los recursos de Storage cargan.
- [ ] Los endpoints críticos responden.
- [ ] Las rutas protegidas continúan protegidas.
- [ ] No aparecen errores nuevos en logs.
- [ ] La base de datos mantiene integridad.
- [ ] No existen fallos inesperados de RLS.

---

## 16. Transferencia operativa

Antes de una rotación de equipo, verificar la entrega de accesos a los siguientes recursos específicos:

### GitHub

**Proyecto:** `ccUnicode/TrikaWeb`

- [ ] El equipo entrante tiene acceso al repositorio (concedido por el administrador de la organización `ccUnicode`).
- [ ] Conoce la rama de producción (`main`) y la de prueba (`dev`).
- [ ] Conoce el flujo de Pull Requests.
- [ ] Puede revisar issues y deployments relacionados.

### Vercel

**Proyecto:** `TrikaWeb`

- [ ] Tiene acceso al proyecto en Vercel (asignado por el propietario del proyecto en Vercel).
- [ ] Puede consultar deployments.
- [ ] Puede consultar logs.
- [ ] Conoce dónde se administran variables de entorno.

### Supabase

**Proyecto:** `TrikaWeb`

- [ ] Tiene acceso al proyecto en Supabase (invitado por el administrador de la organización en Supabase).
- [ ] Puede revisar Database.
- [ ] Puede revisar Auth.
- [ ] Puede revisar Storage.
- [ ] Puede revisar logs.

### Google Drive

**Carpetas:** Exámenes y Solucionarios.

- [ ] Se tiene acceso a las carpetas compartidas de Drive requeridas para sincronización.
- [ ] Se conoce qué cuenta de servicio utiliza la sincronización (Service Account).

### Gestión de Credenciales y Secretos

- [ ] La entrega de variables de entorno (.env de producción) y accesos de administrador se gestiona de forma segura a través del líder del equipo saliente o el director del área, utilizando un gestor de contraseñas de equipo o un canal de comunicación cifrado.

---

## 17. Escalamiento

Cuando el problema no pueda resolverse con este runbook:

1. Registrar evidencia.
2. Registrar logs relevantes.
3. Identificar deployment o migración relacionada.
4. Evitar seguir realizando cambios no controlados.
5. Escalar al responsable técnico correspondiente.

La consulta debe incluir:

- qué ocurrió;
- desde cuándo;
- qué servicio falla;
- qué logs se revisaron;
- qué cambios recientes existen;
- qué acciones ya se intentaron.

---

## 18. Documentación relacionada

- [`deploy.md`](./deploy.md)
- [`setup.md`](./setup.md)
- [`arquitectura.md`](./arquitectura.md)
- [`api.md`](./api.md)
