import { supabaseClient } from './supabase.client';

export interface CourseSummary {
  id: number;
  code: string;
  name: string;
  sheetCount: number;
}

export interface SheetSummary {
  id: number;
  exam_type: string;
  cycle: string;
  avg_difficulty: number | null;
  rating_count: number;
  view_count: number | null;
  teacher_hint: string | null;
  solution_kind?: string | null;
  course_code?: string;
  course_name?: string;
}

export interface CourseDetail extends CourseSummary {
  sheetCount: number;
  sheets: SheetSummary[];
}

export interface TeacherSummary {
  id: number;
  full_name: string;
  bio: string;
  avg_overall: number | null;
  rating_count: number;
  courses: { code: string; name: string }[];
}

const sheetSelect = `
  id,
  exam_type,
  cycle,
  avg_difficulty,
  rating_count,
  view_count,
  teacher_hint,
  courses:course_id (code,name)
`;

export async function getCourses(): Promise<CourseSummary[]> {
  const { data, error } = await supabaseClient
    .from('courses')
    .select('id, code, name, sheets(count)')
    .order('name', { ascending: true });

  if (error || !data) return [];

  return data.map((course: any) => ({
    id: course.id,
    code: course.code,
    name: course.name,
    sheetCount: course.sheets?.[0]?.count ?? 0,
  }));
}

export async function getCourseByCode(code: string): Promise<CourseDetail | null> {
  const normalized = code.toUpperCase();
  const { data: course, error } = await supabaseClient
    .from('courses')
    .select('id, code, name, sheets:sheets (*)')
    .eq('code', normalized)
    .single();

  if (error || !course) return null;

  const { data: sheetsData } = await supabaseClient
    .from('sheets')
    .select(sheetSelect)
    .eq('course_id', course.id)
    .order('cycle', { ascending: false })
    .order('exam_type', { ascending: true });

  return {
    id: course.id,
    code: course.code,
    name: course.name,
    sheetCount: sheetsData?.length ?? 0,
    sheets: (sheetsData || []).map((sheet: any) => ({
      ...sheet,
      course_code: sheet.courses?.code ?? course.code,
      course_name: sheet.courses?.name ?? course.name,
    })),
  } as CourseDetail;
}

export async function getTopSheetsByDifficulty(limit = 6, minRatings = 3) {
  const { data } = await supabaseClient
    .from('sheets')
    .select(sheetSelect)
    .gte('rating_count', minRatings)
    .order('avg_difficulty', { ascending: false })
    .limit(limit);
  return (data || []).map((sheet: any) => ({
    ...sheet,
    course_code: sheet.courses?.code,
    course_name: sheet.courses?.name,
  }));
}

export async function getTopSheetsByViews(limit = 6) {
  const { data } = await supabaseClient
    .from('sheets')
    .select(sheetSelect)
    .order('view_count', { ascending: false })
    .limit(limit);
  return (data || []).map((sheet: any) => ({
    ...sheet,
    course_code: sheet.courses?.code,
    course_name: sheet.courses?.name,
  }));
}

export async function getTopTeachers(limit = 6, minRatings = 3): Promise<TeacherSummary[]> {
  const { data } = await supabaseClient
    .from('teachers')
    .select('id, full_name, bio, avg_overall, rating_count, courses_teachers:courses_teachers ( courses:course_id (code,name) )')
    .gte('rating_count', minRatings)
    .order('avg_overall', { ascending: false })
    .limit(limit);
  return formatTeacherSummary(data);
}

export async function getTeachers(): Promise<TeacherSummary[]> {
  const { data } = await supabaseClient
    .from('teachers')
    .select('id, full_name, bio, avg_overall, rating_count, courses_teachers:courses_teachers ( courses:course_id (code,name) )')
    .order('full_name');
  return formatTeacherSummary(data);
}

function formatTeacherSummary(rows: any[] | null): TeacherSummary[] {
  if (!rows) return [];
  return rows.map(row => ({
    id: row.id,
    full_name: row.full_name,
    bio: row.bio,
    avg_overall: row.avg_overall,
    rating_count: row.rating_count ?? 0,
    courses: (row.courses_teachers || [])
      .map((ct: any) => ct.courses)
      .filter(Boolean)
      .map((course: any) => ({ code: course.code, name: course.name })),
  }));
}
