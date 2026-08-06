# ADR-002: Uso de Supabase como base de datos, storage y autenticación administrativa

## Estado
Aprobada

## Contexto
TrikaWeb necesita una base de datos relacional robusta, almacenamiento de archivos (storage para imágenes o PDFs de exámenes) y un mecanismo de autenticación para el acceso administrativo, sin la necesidad de desarrollar, configurar y mantener infraestructura backend compleja desde cero.

> **Nota**: La autenticación de los usuarios generales se gestiona mediante Firebase Auth (ver ADR correspondiente). Supabase Auth se utiliza exclusivamente para el acceso administrativo.

## Alternativas consideradas
* **Firebase**: Excelente ecosistema, pero su base de datos principal es NoSQL (Firestore), lo que dificulta realizar consultas complejas y mantener la integridad relacional que requiere el sistema educativo (cursos, profesores, exámenes, etc.).
* **AWS / Base de datos tradicional + API propia**: Requiere desarrollar la capa de autenticación, el ORM, las políticas de acceso y configurar la nube manualmente, lo que llevaría demasiado tiempo de desarrollo.
* **Supabase**: Alternativa de código abierto a Firebase. Proporciona una base de datos PostgreSQL real, autenticación, storage y políticas de seguridad a nivel de fila (RLS), junto con un cliente de JS (SDK) fácil de usar.

## Decisión
Se eligió **Supabase** como plataforma de backend as a service para los siguientes componentes:
* **PostgreSQL** como motor de base de datos principal.
* **Supabase Storage** para el almacenamiento de archivos (imágenes, PDFs de exámenes).
* **Supabase Auth** exclusivamente para la autenticación administrativa.

La autenticación de usuarios generales se maneja a través de **Firebase Auth** (`firebase_session` y Firebase Admin SDK), lo cual se documenta en un ADR separado.

## Consecuencias
* **Positivas**: Desarrollo backend drásticamente acelerado. Se aprovecha el poder de PostgreSQL y SQL puro. Seguridad robusta gracias a Row Level Security (RLS) directamente en la base de datos.
* **Negativas**: Existe una fuerte dependencia hacia el SDK de Supabase (vendor lock-in relativo). La configuración compleja de roles y políticas en SQL puede ser difícil de depurar si no se documenta bien. Se mantienen dos sistemas de autenticación distintos (Firebase Auth y Supabase Auth), lo que incrementa la complejidad operativa.
