# TrikaWeb 📚

> Plataforma colaborativa para compartir exámenes pasados, solucionarios y reseñas de profesores universitarios.

TrikaWeb nace con la misión de centralizar y democratizar el acceso a recursos académicos, permitiendo a los estudiantes prepararse mejor y tomar decisiones informadas sobre sus cursos.

---

## 🛠️ Stack Tecnológico

Construido con herramientas modernas para asegurar rendimiento y escalabilidad:

- **Frontend**: [Astro](https://astro.build/) + [TailwindCSS](https://tailwindcss.com/)
- **Backend**: API Routes de Astro (Node.js)
- **Base de Datos & Auth**: [Supabase](https://supabase.com/) (PostgreSQL)
- **Infraestructura**: Vercel (Deployment)

---

## 🚀 Guía de Instalación

Sigue estos pasos para levantar el entorno de desarrollo en tu máquina local.

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/trikaweb.git
cd trikaweb

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
# Crea tu archivo .env basado en el ejemplo
cp .env.example .env
```

> **Nota**: Para saber qué valores poner en el `.env` y configurar la base de datos, revisa la [Guía de Configuración](./docs/setup.md).

---

## ⚡ Uso Básico (Quickstart)

Una vez instaladas las dependencias y configurado el entorno:

1. **Inicia el servidor de desarrollo**:
   ```bash
   npm run dev
   ```

2. **Abre tu navegador**:
   Visita [http://localhost:4321](http://localhost:4321) para ver la aplicación en funcionamiento.

---

## 📖 Documentación

Toda la documentación detallada del proyecto se ha movido a la carpeta `/docs` para mantener este README limpio y ordenado.

- **[🗺️ Funcionalidades](./docs/funcionalidades.md)**: Explora qué hace TrikaWeb, sus características principales y el roadmap.
- **[🏗️ Arquitectura](./docs/arquitectura.md)**: Entiende la estructura de carpetas, el esquema de base de datos y los endpoints de la API.
- **[⚙️ Guía de Configuración](./docs/setup.md)**: Instrucciones detalladas sobre variables de entorno, setup de Supabase y convenciones de código.

---

## 📄 Licencia y Créditos

**Autor**: Equipo de Desarrollo TrikaWeb.

Este proyecto es de uso interno académico. El código fuente está disponible para colaboración bajo los términos establecidos por los administradores del proyecto.

Hecho con ❤️ por estudiantes, para estudiantes.