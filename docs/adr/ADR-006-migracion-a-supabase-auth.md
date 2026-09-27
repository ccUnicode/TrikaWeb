# ADR-006: Migración completa de autenticación a Supabase Auth

## Estado
Aprobada

## Contexto
Originalmente, TrikaWeb utilizaba dos sistemas de autenticación:
- **Firebase Auth** para los estudiantes (validando dominios `@uni.pe` y gestionando sesiones mediante `firebase_session` y el Firebase Admin SDK).
- **Supabase Auth** para los administradores.

Mantener dos proveedores de autenticación añadía complejidad operativa, requería variables de entorno adicionales (Firebase Admin y Firebase Web SDK), y obligaba a mantener un flujo de conversión de UIDs de Firebase a UUIDs nativos en las inserciones de base de datos (`student_details`, `teacher_ratings`, etc.), lo que aumentaba el riesgo de inconsistencias.

## Alternativas consideradas
1. **Mantener el estado actual (Firebase + Supabase)**: Implicaría seguir lidiando con la duplicación de lógicas de sesión, gestión de tokens dispares y las transformaciones de UUIDs.
2. **Migrar completamente a Firebase**: Inviable dado que Supabase es nuestra base de datos principal y utiliza RLS (Row Level Security), lo cual se integra nativamente y de manera óptima con Supabase Auth.
3. **Migrar completamente a Supabase Auth**: Unificar toda la autenticación en Supabase.

## Decisión
Se decidió migrar la autenticación de estudiantes a **Supabase Auth** (OAuth con Google), unificando así todo el sistema de identidad de la plataforma.

## Detalles de Implementación
- El inicio de sesión de estudiantes ahora utiliza el proveedor de Google de Supabase Auth a través de `@supabase/ssr`.
- Los endpoints obsoletos de Firebase (`/api/auth/login`) fueron reemplazados por `/api/auth/signin` y un flujo de callback en `/api/auth/callback`.
- Las variables de entorno relacionadas con Firebase (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, y todas las variables `PUBLIC_FIREBASE_*`) se han eliminado del proyecto y de la documentación.
- Los registros en base de datos de los estudiantes ahora utilizan directamente el `user.id` (UUID nativo) proveído por Supabase, eliminando la necesidad de las funciones de conversión de UID.

## Consecuencias
* **Positivas**: 
  - Simplificación drástica de la arquitectura al mantener un único proveedor de Auth.
  - Integración nativa de la identidad de los estudiantes con las políticas RLS de PostgreSQL de Supabase.
  - Reducción del código de autenticación y de las dependencias externas (eliminación del Firebase Admin SDK).
  - Eliminación del paso intermedio de conversión de UID a UUID en la base de datos.
* **Negativas**: 
  - Requiere asegurar que las credenciales OAuth (Google Cloud Console) estén correctamente configuradas directamente en el panel de Supabase Auth.
