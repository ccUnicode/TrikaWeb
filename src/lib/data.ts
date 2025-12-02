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
  avatar_url?: string | null;
}

export interface TeacherReview {
  id: number;
  overall: number;
  difficulty: number;
  didactic: number;
  resources: number;
  responsability: number;
  grading: number;
  comment: string | null;
  created_at: string;
}

export interface TeacherStats {
  avg_overall: number | null;
  avg_difficulty: number | null;
  avg_didactic: number | null;
  avg_resources: number | null;
  avg_responsability: number | null;
  avg_grading: number | null;
}

export interface TeacherDetail {
  teacher: TeacherSummary;
  stats: TeacherStats;
  courses: { id: number; code: string; name: string }[];
  reviews: TeacherReview[];
  pagination: {
    page: number;
    pageSize: number;
    totalReviews: number;
    totalPages: number;
  };
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
    .select('id, full_name, bio, avg_overall, rating_count, avatar_url, courses_teachers:courses_teachers ( courses:course_id (code,name) )')
    .gte('rating_count', minRatings)
    .order('avg_overall', { ascending: false })
    .limit(limit);
  return formatTeacherSummary(data);
}

export async function getTeachers(): Promise<TeacherSummary[]> {
  const { data } = await supabaseClient
    .from('teachers')
    .select('id, full_name, bio, avg_overall, rating_count, avatar_url, courses_teachers:courses_teachers ( courses:course_id (code,name) )')
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
    avatar_url: row.avatar_url ?? null,
    courses: (row.courses_teachers || [])
      .map((ct: any) => ct.courses)
      .filter(Boolean)
      .map((course: any) => ({ code: course.code, name: course.name })),
  }));
}

const normalizeAvg = (value: any): number | null => {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

const aggregateFromReviews = (reviews: TeacherReview[]) => {
  if (!reviews.length) {
    return {
      avg_overall: null,
      avg_difficulty: null,
      avg_didactic: null,
      avg_resources: null,
      avg_responsability: null,
      avg_grading: null,
    } as TeacherStats;
  }

  const sum = reviews.reduce(
    (acc, r) => ({
      overall: acc.overall + (r.overall ?? 0),
      difficulty: acc.difficulty + (r.difficulty ?? 0),
      didactic: acc.didactic + (r.didactic ?? 0),
      resources: acc.resources + (r.resources ?? 0),
      responsability: acc.responsability + (r.responsability ?? 0),
      grading: acc.grading + (r.grading ?? 0),
    }),
    { overall: 0, difficulty: 0, didactic: 0, resources: 0, responsability: 0, grading: 0 }
  );
  const count = reviews.length;
  return {
    avg_overall: sum.overall / count,
    avg_difficulty: sum.difficulty / count,
    avg_didactic: sum.didactic / count,
    avg_resources: sum.resources / count,
    avg_responsability: sum.responsability / count,
    avg_grading: sum.grading / count,
  } as TeacherStats;
};

export async function getTeacherDetail(
  teacherId: number,
  page = 1,
  pageSize = 10
): Promise<TeacherDetail | null> {
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safeSize = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 10;
  const from = (safePage - 1) * safeSize;
  const to = from + safeSize - 1;

  // Datos base del profesor con cursos
  const { data: teacherData, error: teacherError } = await supabaseClient
    .from('teachers')
    .select(
      'id, full_name, bio, avg_overall, rating_count, avatar_url, courses_teachers:courses_teachers ( courses:course_id (id, code, name) )'
    )
    .eq('id', teacherId)
    .maybeSingle();

  if (teacherError || !teacherData) {
    console.error('getTeacherDetail teacher error', teacherError);
    return null;
  }

  const courses =
    (teacherData.courses_teachers || [])
      .map((ct: any) => ct.courses)
      .filter(Boolean)
      .map((course: any) => ({
        id: course.id,
        code: course.code,
        name: course.name,
      })) ?? [];

  // Stats por dimensión
  const { data: statsRow, error: statsError } = await supabaseClient
    .from('teacher_ratings')
    .select(
      'avg_overall:avg(overall),avg_difficulty:avg(difficulty),avg_didactic:avg(didactic),avg_resources:avg(resources),avg_responsability:avg(responsability),avg_grading:avg(grading)'
    )
    .eq('teacher_id', teacherId)
    .eq('is_hidden', false)
    .maybeSingle();

  if (statsError && statsError.code !== 'PGRST200') {
    console.error('getTeacherDetail stats error', statsError);
  }

  // Reseñas con paginación y count
  const { data: reviews, count, error: reviewsError } = await supabaseClient
    .from('teacher_ratings')
    .select(
      'id, overall, difficulty, didactic, resources, responsability, grading, comment, created_at',
      { count: 'exact', head: false }
    )
    .eq('teacher_id', teacherId)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (reviewsError) {
    console.error('getTeacherDetail reviews error', reviewsError);
  }

  const totalReviews = count ?? 0;
  const totalPages = totalReviews > 0 ? Math.ceil(totalReviews / safeSize) : 0;
  const normalizedReviews = (reviews || []) as TeacherReview[];

  const statsFromDb: TeacherStats = {
    avg_overall: normalizeAvg(statsRow?.avg_overall ?? teacherData.avg_overall),
    avg_difficulty: normalizeAvg(statsRow?.avg_difficulty),
    avg_didactic: normalizeAvg(statsRow?.avg_didactic),
    avg_resources: normalizeAvg(statsRow?.avg_resources),
    avg_responsability: normalizeAvg(statsRow?.avg_responsability),
    avg_grading: normalizeAvg(statsRow?.avg_grading),
  };

  const aggregatedFromReviews = aggregateFromReviews(normalizedReviews);

  const stats: TeacherStats = {
    avg_overall: statsFromDb.avg_overall ?? aggregatedFromReviews.avg_overall,
    avg_difficulty: statsFromDb.avg_difficulty ?? aggregatedFromReviews.avg_difficulty,
    avg_didactic: statsFromDb.avg_didactic ?? aggregatedFromReviews.avg_didactic,
    avg_resources: statsFromDb.avg_resources ?? aggregatedFromReviews.avg_resources,
    avg_responsability:
      statsFromDb.avg_responsability ?? aggregatedFromReviews.avg_responsability,
    avg_grading: statsFromDb.avg_grading ?? aggregatedFromReviews.avg_grading,
  };

  return {
    teacher: {
      id: teacherData.id,
      full_name: teacherData.full_name,
      bio: teacherData.bio,
      avg_overall: teacherData.avg_overall,
      rating_count: teacherData.rating_count ?? 0,
      avatar_url: (teacherData as any).avatar_url ?? null,
      courses: courses.map(({ code, name }) => ({ code, name })),
    },
    stats,
    courses,
    reviews: normalizedReviews,
    pagination: {
      page: safePage,
      pageSize: safeSize,
      totalReviews,
      totalPages,
    },
  };
}
