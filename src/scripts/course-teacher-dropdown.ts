export type CourseOption = { code: string; name: string };

export function initCourseTeacherDropdown() {
  let allCourses: CourseOption[] = [];

  const courseSearchInput = document.getElementById("course-search") as HTMLInputElement;
  const courseCodeHidden = document.getElementById("course-code") as HTMLInputElement;
  const courseDropdown = document.getElementById("course-dropdown") as HTMLUListElement;
  const courseComboboxContainer = document.getElementById("course-combobox-container");

  // RF-30: Teacher dropdown elements
  const teacherSelect = document.getElementById("teacher-select") as HTMLSelectElement;
  const teacherLoading = document.getElementById("teacher-loading");
  
  let lastFetchedTeacherCode = "";
  let teacherFetchAbortCtrl: AbortController | null = null;

  async function loadCourseOptions() {
    try {
      const res = await fetch("/api/admin/course-options", {
        method: "GET",
        credentials: "include",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        if (courseSearchInput) courseSearchInput.placeholder = "No se pudieron cargar cursos";
        return;
      }

      allCourses = data.courses || [];

      if (!allCourses.length) {
        if (courseSearchInput) courseSearchInput.placeholder = "No hay cursos disponibles";
        return;
      }

      if (courseSearchInput) {
        courseSearchInput.placeholder = "Buscar curso (ej. Física, BFI01)...";
        courseSearchInput.removeAttribute("disabled");
      }
    } catch (e) {
      console.error(e);
      if (courseSearchInput) courseSearchInput.placeholder = "Error cargando cursos";
    }
  }

  function renderCourseDropdown(coursesToRender: CourseOption[]) {
    if (!courseDropdown) return;
    
    courseDropdown.innerHTML = "";
    
    if (coursesToRender.length === 0) {
      const emptyLi = document.createElement("li");
      emptyLi.className = "px-4 py-3 text-sm text-global-text-muted text-center cursor-default";
      emptyLi.textContent = "No se encontraron cursos.";
      courseDropdown.appendChild(emptyLi);
      return;
    }

    coursesToRender.forEach((c) => {
      const label = `${c.code} - ${c.name}`;
      const li = document.createElement("li");
      li.dataset.code = c.code;
      li.dataset.label = label;
      li.className = "px-4 py-2.5 hover:bg-black/30 hover:text-white cursor-pointer text-sm text-global-text transition-colors";
      li.textContent = label;

      li.addEventListener("click", () => {
        if (courseCodeHidden) courseCodeHidden.value = c.code;
        if (courseSearchInput) courseSearchInput.value = label;
        courseDropdown.classList.add("hidden");
        // RF-30: Load teachers when a course is selected
        loadTeachersByCourse(c.code);
      });

      courseDropdown.appendChild(li);
    });
  }

  courseSearchInput?.addEventListener("input", (e) => {
    const query = (e.target as HTMLInputElement).value.toLowerCase();
    // Ocultar valor real si editan para forzar la selección válida
    if (courseCodeHidden) courseCodeHidden.value = "";

    // RF-30: Reset teacher dropdown when course changes
    resetTeacherDropdown();

    const filtered = allCourses.filter(
      (c) =>
        c.code.toLowerCase().includes(query) ||
        c.name.toLowerCase().includes(query),
    );
    renderCourseDropdown(filtered);
    courseDropdown?.classList.remove("hidden");
  });

  courseSearchInput?.addEventListener("focus", () => {
    courseSearchInput.select();
    if (allCourses.length > 0) {
      const query = courseSearchInput.value.toLowerCase();
      const filtered = allCourses.filter(
        (c) =>
          c.code.toLowerCase().includes(query) ||
          c.name.toLowerCase().includes(query),
      );
      renderCourseDropdown(filtered);
      courseDropdown?.classList.remove("hidden");
    }
  });

  document.addEventListener("click", (e) => {
    if (!courseComboboxContainer?.contains(e.target as Node)) {
      courseDropdown?.classList.add("hidden");
    }
  });

  // Enforce selection from list
  courseSearchInput?.addEventListener("blur", () => {
    setTimeout(() => {
      if (courseCodeHidden && !courseCodeHidden.value) {
        courseSearchInput.value = "";
      }
    }, 150);
  });

  loadCourseOptions();

  // ── RF-30: Teacher dropdown functions ──
  function resetTeacherDropdown() {
    // Cancelar cualquier petición de profesores en vuelo para evitar que
    // una respuesta tardía sobreescriba el estado limpio del selector.
    if (teacherFetchAbortCtrl) {
      teacherFetchAbortCtrl.abort();
      teacherFetchAbortCtrl = null;
    }
    if (teacherSelect) {
      teacherSelect.innerHTML = '<option value="">-- Ingresa un curso primero --</option>';
      teacherSelect.disabled = true;
    }
    teacherLoading?.classList.add("hidden");
    lastFetchedTeacherCode = "";
  }

  async function loadTeachersByCourse(code: string) {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || trimmed === lastFetchedTeacherCode) return;
    lastFetchedTeacherCode = trimmed;

    // Abort previous fetch if any
    if (teacherFetchAbortCtrl) {
      teacherFetchAbortCtrl.abort();
    }
    teacherFetchAbortCtrl = new AbortController();
    const signal = teacherFetchAbortCtrl.signal;

    teacherLoading?.classList.remove("hidden");
    if (teacherSelect) {
      teacherSelect.disabled = true;
      teacherSelect.innerHTML = '<option value="">Cargando...</option>';
    }

    try {
      const res = await fetch(
        `/api/cursos/${encodeURIComponent(trimmed)}/profesores`,
        { signal }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Check if we were aborted manually while awaiting JSON
      if (signal.aborted) return;

      if (data.ok && data.profesores.length > 0) {
        if (teacherSelect) {
          teacherSelect.innerHTML = '<option value="">-- Selecciona un docente --</option>';
          for (const prof of data.profesores) {
            const opt = document.createElement("option");
            opt.value = prof.full_name;
            opt.textContent = prof.full_name;
            teacherSelect.appendChild(opt);
          }
          teacherSelect.disabled = false;
        }
      } else {
        if (teacherSelect) {
          teacherSelect.innerHTML = '<option value="">Sin profesores asociados</option>';
          teacherSelect.disabled = true;
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Request was aborted by a new course selection, do not update UI
        return;
      }
      console.error("Error cargando profesores:", err);
      if (teacherSelect) {
        teacherSelect.innerHTML = '<option value="">Error al cargar</option>';
        teacherSelect.disabled = true;
      }
    } finally {
      if (teacherFetchAbortCtrl?.signal === signal) {
        teacherLoading?.classList.add("hidden");
      }
    }
  }
}
