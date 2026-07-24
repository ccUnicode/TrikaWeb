# ADR-002: Uso de Supabase como base de datos y BaaS (Backend as a Service)

## Estado
Aprobada

## Contexto
TrikaWeb necesita una base de datos relacional robusta, autenticación de usuarios y almacenamiento de archivos (storage para imágenes o PDFs de exámenes), sin la necesidad de desarrollar, configurar y mantener infraestructura backend compleja desde cero.

## Alternativas consideradas
* **Firebase**: Excelente ecosistema, pero su base de datos principal es NoSQL (Firestore), lo que dificulta realizar consultas complejas y mantener la integridad relacional que requiere el sistema educativo (cursos, profesores, exámenes, etc.).
* **AWS / Base de datos tradicional + API propia**: Requiere desarrollar la capa de autenticación, el ORM, las políticas de acceso y configurar la nube manualmente, lo que llevaría demasiado tiempo de desarrollo.
* **Supabase**: Alternativa de código abierto a Firebase. Proporciona una base de datos PostgreSQL real, autenticación, storage y políticas de seguridad a nivel de fila (RLS), junto con un cliente de JS (SDK) fácil de usar.

## Decisión
Se eligió **Supabase** como plataforma de backend as a service, utilizando PostgreSQL como motor de base de datos principal, junto con sus módulos de Auth (autenticación) y Storage (almacenamiento de archivos).

## Consecuencias
* **Positivas**: Desarrollo backend drásticamente acelerado. Se aprovecha el poder de PostgreSQL y SQL puro. Seguridad robusta gracias a Row Level Security (RLS) directamente en la base de datos.
* **Negativas**: Existe una fuerte dependencia hacia el SDK de Supabase (vendor lock-in relativo). La configuración compleja de roles y políticas en SQL puede ser difícil de depurar si no se documenta bien.
