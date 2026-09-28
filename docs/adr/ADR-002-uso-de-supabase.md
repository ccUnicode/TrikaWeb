# ADR-002: Uso de Supabase como base de datos, storage y autenticación

## Estado
Aprobada

## Contexto
TrikaWeb necesita una base de datos relacional robusta, almacenamiento de archivos (storage para imágenes o PDFs de exámenes) y un mecanismo de autenticación tanto para estudiantes como para el acceso administrativo, sin la necesidad de desarrollar, configurar y mantener infraestructura backend compleja desde cero.

> **Nota**: Inicialmente Supabase Auth se utilizó de forma exclusiva para el acceso administrativo mientras Firebase Auth gestionaba a los estudiantes. Tras la unificación de la arquitectura, Supabase Auth gestiona la autenticación de todos los usuarios de la plataforma (ver ADR-006).

## Alternativas consideradas
* **Firebase**: Excelente ecosistema, pero su base de datos principal es NoSQL (Firestore), lo que dificulta realizar consultas complejas y mantener la integridad relacional que requiere el sistema educativo (cursos, profesores, exámenes, etc.).
* **AWS / Base de datos tradicional + API propia**: Requiere desarrollar la capa de autenticación, el ORM, las políticas de acceso y configurar la nube manualmente, lo que llevaría demasiado tiempo de desarrollo.
* **Supabase**: Alternativa de código abierto a Firebase. Proporciona una base de datos PostgreSQL real, autenticación, storage y políticas de seguridad a nivel de fila (RLS), junto con un cliente de JS (SDK) fácil de usar.

## Decisión
Se eligió **Supabase** como plataforma de backend as a service para los siguientes componentes:
* **PostgreSQL** como motor de base de datos principal.
* **Supabase Storage** para el almacenamiento de archivos (imágenes, PDFs de exámenes).
* **Supabase Auth** para la autenticación integral de la plataforma (tanto para estudiantes con Google OAuth institucional como para administradores con credenciales seguras).

## Consecuencias
* **Positivas**: Desarrollo backend drásticamente acelerado. Se aprovecha el poder de PostgreSQL y SQL puro. Seguridad robusta gracias a Row Level Security (RLS) directamente en la base de datos. Sistema de identidad unificado bajo un único proveedor y SDK.
* **Negativas**: Existe una fuerte dependencia hacia el SDK de Supabase (vendor lock-in relativo). La configuración compleja de roles y políticas en SQL puede ser difícil de depurar si no se documenta bien.
