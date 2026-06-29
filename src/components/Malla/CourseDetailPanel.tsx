import { useMemo } from 'react';
import type { CurriculumCourse, CoursePrerequisite } from '../../lib/curriculumTypes';

export interface CourseDetailPanelProps {
  course: CurriculumCourse;
  prerequisites: CoursePrerequisite[];
  allCourses: CurriculumCourse[];
  onPrerequisiteClick: (prerequisiteId: string) => void;
}

export default function CourseDetailPanel({ course, prerequisites, allCourses, onPrerequisiteClick }: CourseDetailPanelProps) {
  // Filtrar los prerrequisitos de este curso
  const coursePrereqs = useMemo(() => {
    const prereqIds = prerequisites
      .filter(pr => pr.course_id === course.course_id)
      .map(pr => pr.prerequisite_id);

    return allCourses.filter(c => prereqIds.includes(c.course_id));
  }, [course.course_id, prerequisites, allCourses]);

  // Encontrar cursos que tienen a este como prerrequisito (es prerrequisito de...)
  const dependentCourses = useMemo(() => {
    const depIds = prerequisites
      .filter(pr => pr.prerequisite_id === course.course_id)
      .map(pr => pr.course_id);

    return allCourses.filter(c => depIds.includes(c.course_id));
  }, [course.course_id, prerequisites, allCourses]);

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto custom-scrollbar pr-1">
      {/* Header: Código + Nombre */}
      <div>
        <span className="text-[#22c55e] font-mono text-sm font-bold tracking-wider uppercase">
          {course.code}
        </span>
        <h2 className="text-white text-xl font-bold mt-1 leading-snug">
          {course.name}
        </h2>
      </div>

      {/* Badges: Créditos + Tipo */}
      <div className="flex flex-wrap gap-2">
        {course.credits !== undefined && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            {course.credits} {course.credits === 1 ? 'Crédito' : 'Créditos'}
          </span>
        )}

        {course.is_elective ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Electivo
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-500/10 text-gray-400 border border-gray-500/20">
            Obligatorio
          </span>
        )}

        {course.evaluation_system && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20">
            {course.evaluation_system}
          </span>
        )}
      </div>

      {/* Separador */}
      <hr className="border-gray-800" />

      {/* Sumilla */}
      <div>
        <h3 className="text-white text-sm font-semibold mb-2 flex items-center gap-1.5">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Sumilla
        </h3>
        {course.sumilla ? (
          <p className="text-gray-300 text-sm leading-relaxed">
            {course.sumilla}
          </p>
        ) : (
          <p className="text-gray-500 text-sm italic">
            Sumilla pendiente de registro.
          </p>
        )}
      </div>

      {/* Pre-requisitos */}
      {coursePrereqs.length > 0 && (
        <div>
          <h3 className="text-white text-sm font-semibold mb-2 flex items-center gap-1.5">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            Pre-requisitos
          </h3>
          <div className="flex flex-col gap-1.5">
            {coursePrereqs.map(pr => (
              <button
                key={pr.course_id}
                onClick={() => onPrerequisiteClick(String(pr.course_id))}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#161b22] border border-gray-800 hover:border-[#22c55e]/40 hover:bg-[#1a2332] transition-all text-left cursor-pointer group active:scale-[0.98]"
              >
                <span className="text-[#22c55e] font-mono text-xs font-bold group-hover:text-[#4ade80] transition-colors">
                  {pr.code}
                </span>
                <span className="text-gray-300 text-xs truncate group-hover:text-white transition-colors">
                  {pr.name}
                </span>
                <svg className="w-3 h-3 text-gray-600 ml-auto flex-shrink-0 group-hover:text-[#22c55e] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Es prerrequisito de... */}
      {dependentCourses.length > 0 && (
        <div>
          <h3 className="text-white text-sm font-semibold mb-2 flex items-center gap-1.5">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
            </svg>
            Es pre-requisito de
          </h3>
          <div className="flex flex-col gap-1.5">
            {dependentCourses.map(dep => (
              <button
                key={dep.course_id}
                onClick={() => onPrerequisiteClick(String(dep.course_id))}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#161b22] border border-gray-800 hover:border-blue-500/40 hover:bg-[#1a2332] transition-all text-left cursor-pointer group active:scale-[0.98]"
              >
                <span className="text-blue-400 font-mono text-xs font-bold group-hover:text-blue-300 transition-colors">
                  {dep.code}
                </span>
                <span className="text-gray-300 text-xs truncate group-hover:text-white transition-colors">
                  {dep.name}
                </span>
                <svg className="w-3 h-3 text-gray-600 ml-auto flex-shrink-0 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Espacio para futuras secciones (Planchas, Dificultad, Profesores) */}

      {/* Link a la página del curso */}
      <div className="mt-auto pt-4 border-t border-gray-800">
        <a
          href={`/curso/${course.code}`}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-[#161b22] border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 transition-all text-sm font-medium group"
        >
          <svg className="w-4 h-4 text-gray-400 group-hover:text-[#22c55e] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Ver página del curso
        </a>
      </div>
    </div>
  );
}
