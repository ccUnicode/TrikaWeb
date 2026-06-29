// src/lib/curriculumTypes.ts
// Interfaces para la data de Mallas Curriculares (Supabase → React Flow)

/** Un curso dentro de un plan de estudios, con su ciclo asignado */
export interface CurriculumCourse {
  course_id: number;
  code: string;
  name: string;
  cycle: number;
  credits?: number;
  evaluation_system?: string;
  row_index?: number;
  sumilla?: string | null;
  is_elective?: boolean;
  avg_difficulty?: number;
  teachers?: Array<{
    id: number;
    full_name: string;
    avatar_url: string | null;
  }>;
}

/** Relación de pre-requisito entre dos cursos del plan */
export interface CoursePrerequisite {
  course_id: number;
  prerequisite_id: number;
}

/** Data completa de un plan de estudios para el componente React Flow */
export interface CurriculumData {
  specialtyName: string;
  planYear: string;
  courses: CurriculumCourse[];
  prerequisites: CoursePrerequisite[];
}
