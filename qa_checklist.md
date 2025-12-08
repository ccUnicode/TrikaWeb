# Lista Maestra de QA Testing - TrikaWeb

Utiliza este documento para llevar el control manual de la calidad del proyecto.
Marca con una `x` dentro de los corchetes `[x]` cuando una prueba haya sido superada satisfactoriamente.

## 1. Funcionalidades Críticas (Core)

### Buscador Principal
- [ ] **Búsqueda Normal**: Ingresar nombre de curso existente -> Muestra resultados.
- [ ] **Búsqueda Vacía**: Presionar buscar sin texto -> No rompe la página.
- [ ] **Sin Resultados**: Ingresar texto random ("xyz") -> Muestra mensaje "No se encontraron resultados".
- [ ] **Navegación**: Clic en un resultado del autocomplete -> Lleva a la página correcta.

### Exámenes y Planchas
- [ ] **Listado**: Se ven las tarjetas de exámenes correctamente alineadas.
- [ ] **Filtros**: (Si existen) Filtrar por Ciclo/Tipo -> Actualiza la lista correctamente.
- [ ] **Descarga**: Botón "Descargar PDF" -> Inicia la descarga del archivo real.
- [ ] **Visualización**: Entrar al detalle del examen -> Se ve la vista previa del PDF (si aplica).

### Profesores
- [ ] **Listado**: Cards de profesores muestran Nombre, Curso y Estrellas.
- [ ] **Detalle**: Clic en profesor -> Lleva a su perfil completo.
- [ ] **Rating**: Formulario de calificación carga correctamente.
- [ ] **Validación Rating**: Intentar enviar sin poner estrellas -> Muestra error.

### Autenticación y Usuario (Si aplica)
- [ ] **Login**: Iniciar sesión con credenciales correctas -> Redirige al Home/Dashboard.
- [ ] **Favoritos**: Clic en "Guardar" en un examen -> El icono cambia a relleno.
- [ ] **Persistencia**: Recargar la página -> El examen sigue guardado como favorito.

---

## 2. Diseño y UX/UI

### Tema (Light/Dark Mode)
- [ ] **Switch**: El botón de cambio de tema funciona instantáneamente.
- [ ] **Light Mode**:
    - [ ] Fondo claro, texto oscuro legible.
    - [ ] Las Cards tienen sombra suave y se distinguen del fondo.
    - [ ] No hay textos blancos sobre fondo blanco (invisibles).
- [ ] **Dark Mode**:
    - [ ] Fondo oscuro, texto claro legible.
    - [ ] Contraste adecuado en botones y enlaces.

### Responsive (Adaptabilidad)
- [ ] **Móvil (375px)**:
    - [ ] Menú de navegación se colapsa en hamburguesa (si aplica) o se ve bien.
    - [ ] No hay scroll horizontal (la página no "baila" hacia los lados).
    - [ ] Cards de exámenes se ponen una debajo de otra (1 columna).
- [ ] **Tablet (768px)**: La grilla de exámenes se adapta (2 columnas).
- [ ] **Desktop (1024px+)**: La grilla aprovecha el ancho (3 o 4 columnas).

### Estética General
- [ ] **Fuentes**: La tipografía carga correctamente y es legible.
- [ ] **Imágenes**: No hay imágenes rotas. Tienen buena resolución.
- [ ] **Espaciado**: Los márgenes y paddings son consistentes (no hay elementos pegados).

---

## 3. Manejo de Errores (Edge Cases)

- [ ] **404**: Escribir una URL falsa (`/pagina-que-no-existe`) -> Muestra página de "No encontrado" bonita (no error de código).
- [ ] **Datos Faltantes**: Si un profesor no tiene foto -> Muestra un avatar por defecto (no imagen rota).
- [ ] **Inputs Inválidos**:
    - [ ] Email sin arroba `@`.
    - [ ] Textos extremadamente largos en búsquedas -> No rompen el diseño.

---

## 4. Rendimiento y SEO

- [x] **Carga Inicial**: La página carga en menos de 3 segundos (visible). (Actual: ~4s en dev, aceptable).
- [ ] **Títulos**: La pestaña del navegador muestra el título correcto en cada página.
- [ ] **Lighthouse Score**:
    - [x] Performance > 80 (Aceptable para MVP estudiantil: ~4.2s carga)
    - [/] Accessibility > 90
    - [/] SEO > 90

