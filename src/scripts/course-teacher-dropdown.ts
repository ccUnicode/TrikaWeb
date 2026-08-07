type TeacherOption = {
  id: number;
  full_name: string;
};

export function initTeacherDropdown(
  getActiveCourseId?: () => number | null
) {
  const courseCodeInput = document.getElementById("course-code") as HTMLInputElement;
  const teacherSearchInput = document.getElementById("teacher-search") as HTMLInputElement;
  const teacherIdInput = document.getElementById("teacher-id") as HTMLInputElement;
  const teacherDropdown = document.getElementById("teacher-dropdown") as HTMLUListElement;
  const teacherLoading = document.getElementById("teacher-loading");

  let allTeachers: TeacherOption[] = [];
  let lastFetchedCode = "";
  let teachersAbortController: AbortController | null = null;

  async function loadTeachersByCourse(code: string, expectedCourseId?: number) {
    const trimmed = code.trim().toUpperCase();

    if (!/^[A-Z]{2,4}[0-9]{2,3}$/.test(trimmed)) {
      resetTeacherSelection("Ingresa un curso primero");
      return;
    }

    if (trimmed === lastFetchedCode) return;
    lastFetchedCode = trimmed;

    teachersAbortController?.abort();
    teachersAbortController = new AbortController();
    const { signal } = teachersAbortController;

    if (teacherSearchInput) {
      teacherSearchInput.value = "";
      teacherSearchInput.placeholder = "Cargando profesores...";
      teacherSearchInput.setAttribute("disabled", "true");
    }
    if (teacherIdInput) teacherIdInput.value = "";
    if (teacherDropdown) {
      teacherDropdown.innerHTML = "";
      teacherDropdown.classList.add("hidden");
    }
    teacherLoading?.classList.remove("hidden");

    try {
      const res = await fetch(
        `/api/cursos/${encodeURIComponent(trimmed)}/profesores`,
        { signal },
      );

      if (signal.aborted) return;

      const activeId = getActiveCourseId ? getActiveCourseId() : undefined;
      if (expectedCourseId !== undefined && activeId !== expectedCourseId) {
        return;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const activeIdAfter = getActiveCourseId ? getActiveCourseId() : undefined;
      if (expectedCourseId !== undefined && activeIdAfter !== expectedCourseId) {
        return;
      }

      if (data.ok && Array.isArray(data.profesores) && data.profesores.length > 0) {
        const rawTeachers = data.profesores as unknown[];
        allTeachers = rawTeachers
          .map((prof: unknown): TeacherOption | null => {
            if (typeof prof !== "object" || prof === null || !("id" in prof) || !("full_name" in prof)) return null;
            const id = Number(prof.id);
            const fullName = String(prof.full_name ?? "").trim();
            if (!Number.isSafeInteger(id) || id <= 0 || !fullName) return null;
            return { id, full_name: fullName };
          })
          .filter((prof: TeacherOption | null): prof is TeacherOption => prof !== null);

        if (allTeachers.length === 0) {
          resetTeacherSelection("Sin profesores asociados");
          return;
        }

        if (teacherSearchInput) {
          teacherSearchInput.removeAttribute("disabled");
          teacherSearchInput.placeholder = "Buscar docente...";
        }
        renderTeacherDropdown(allTeachers);
      } else {
        resetTeacherSelection("Sin profesores asociados");
      }
    } catch (err: any) {
      if (signal.aborted || err.name === 'AbortError') return;
      console.error("Error cargando profesores:", err);
      resetTeacherSelection("Error al cargar profesores");
    } finally {
      if (!signal.aborted) {
        teacherLoading?.classList.add("hidden");
      }
    }
  }

  function resetTeacherSelection(placeholder = "Ingresa un curso primero") {
    if (teachersAbortController) {
      teachersAbortController.abort();
      teachersAbortController = null;
    }
    if (teacherSearchInput) {
      teacherSearchInput.value = "";
      teacherSearchInput.placeholder = placeholder;
      teacherSearchInput.setAttribute("disabled", "true");
    }
    if (teacherIdInput) {
      teacherIdInput.value = "";
    }
    if (teacherDropdown) {
      teacherDropdown.innerHTML = "";
      teacherDropdown.classList.add("hidden");
    }
    allTeachers = [];
    lastFetchedCode = "";
  }

  function renderTeacherDropdown(teachersToRender: TeacherOption[]) {
    if (!teacherDropdown) return;
    teacherDropdown.innerHTML = "";
    if (teachersToRender.length === 0) {
      const emptyItem = document.createElement("li");
      emptyItem.className = "px-4 py-3 text-sm text-global-text-muted text-center cursor-default";
      emptyItem.textContent = "No se encontraron docentes.";
      teacherDropdown.appendChild(emptyItem);
      return;
    }

    teachersToRender.forEach((teacher) => {
      const item = document.createElement("li");
      item.className = "px-4 py-2.5 hover:bg-black/30 hover:text-white cursor-pointer text-sm text-global-text transition-colors";
      item.textContent = teacher.full_name;
      item.addEventListener("mousedown", (event) => {
        event.preventDefault();
        if (teacherIdInput) teacherIdInput.value = String(teacher.id);
        if (teacherSearchInput) teacherSearchInput.value = teacher.full_name;
        teacherDropdown.classList.add("hidden");
      });
      teacherDropdown.appendChild(item);
    });
  }

  if (courseCodeInput) {
    courseCodeInput.addEventListener("blur", () => {
      loadTeachersByCourse(courseCodeInput.value);
    });
    courseCodeInput.addEventListener("input", () => {
      const val = courseCodeInput.value.trim().toUpperCase();
      if (/^[A-Z]{2,4}[0-9]{2,3}$/.test(val)) {
        loadTeachersByCourse(val);
      } else {
        // Si el código deja de ser válido, reiniciamos y cortamos peticiones en vuelo
        resetTeacherSelection("Ingresa un curso primero");
      }
    });
  }

  return { loadTeachersByCourse, resetTeacherSelection };
}
