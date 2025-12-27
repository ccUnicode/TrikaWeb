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
  thumb_storage_path?: string | null;
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
  courses: { code: string; name: string; modality?: string }[];
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

export interface SearchResults {
  query: string;
  courses: CourseSummary[];
  teachers: TeacherSummary[];
  sheets: SheetSummary[];
}

const sheetSelect = `
  id,
  exam_type,
  cycle,
  avg_difficulty,
  rating_count,
  view_count,
  teacher_hint,
  solution_kind,
  thumb_storage_path,
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

export async function getTopSheetsByViews(limit = 6, minViews = 5) {
  const { data } = await supabaseClient
    .from('sheets')
    .select(sheetSelect)
    .gte('view_count', minViews)
    .order('view_count', { ascending: false })
    .limit(limit);
  return (data || []).map((sheet: any) => ({
    ...sheet,
    course_code: sheet.courses?.code,
    course_name: sheet.courses?.name,
  }));
}

export async function getSheetsByIds(ids: number[]): Promise<SheetSummary[]> {
  const uniqueIds = Array.from(
    new Set(
      (ids || [])
        .map(n => Number(n))
        .filter(n => Number.isFinite(n))
    )
  );
  if (!uniqueIds.length) return [];

  const { data, error } = await supabaseClient
    .from('sheets')
    .select(sheetSelect)
    .in('id', uniqueIds);

  if (error || !data) {
    console.error('getSheetsByIds error', error);
    return [];
  }

  return data.map((sheet: any) => ({
    ...sheet,
    course_code: sheet.courses?.code,
    course_name: sheet.courses?.name,
  })) as SheetSummary[];
}

export async function getTopTeachers(limit = 6, minRatings = 3): Promise<TeacherSummary[]> {
  const { data } = await supabaseClient
    .from('teachers')
    .select('id, full_name, bio, avg_overall, rating_count, avatar_url, courses_teachers:courses_teachers ( modality, courses:course_id (code,name) )')
    .eq('is_hidden', false)
    .gte('rating_count', minRatings)
    .order('avg_overall', { ascending: false })
    .limit(limit);
  return formatTeacherSummary(data);
}

export async function getTeachers(): Promise<TeacherSummary[]> {
  const { data } = await supabaseClient
    .from('teachers')
    .select('id, full_name, bio, avg_overall, rating_count, avatar_url, courses_teachers:courses_teachers ( modality, courses:course_id (code,name) )')
    .eq('is_hidden', false)
    .order('full_name');
  return formatTeacherSummary(data);
}

export async function getTeachersByCourseCode(code: string): Promise<{ teacher: TeacherSummary, modality: string }[]> {
  const { data: course } = await supabaseClient
    .from('courses')
    .select('id')
    .eq('code', code.toUpperCase())
    .single();

  if (!course) return [];

  const { data } = await supabaseClient
    .from('teachers')
    .select('id, full_name, bio, avg_overall, rating_count, avatar_url, courses_teachers:courses_teachers!inner ( modality, course_id )')
    .eq('is_hidden', false)
    .eq('courses_teachers.course_id', course.id);

  if (!data) return [];

  return data.flatMap((t: any) =>
    t.courses_teachers.flatMap((ct: any) => {
      const modalities = (ct.modality || 'T').split(',').map((m: string) => m.trim());

      return modalities.map((mod: string) => ({
        teacher: {
          id: t.id,
          full_name: t.full_name,
          bio: t.bio,
          avg_overall: t.avg_overall,
          rating_count: t.rating_count ?? 0,
          avatar_url: t.avatar_url ?? null,
          courses: [] // Not needed for this specific view
        },
        modality: mod
      }));
    })
  );
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
      .map((ct: any) => ct.courses ? { ...(ct.courses), modality: ct.modality } : null)
      .filter(Boolean)
      .map((course: any) => ({ code: course.code, name: course.name, modality: course.modality })),
  }));
}

const normalizeText = (value: string) =>
  String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const scoreAgainstQuery = (normalizedQuery: string, fields: (string | null | undefined)[]) => {
  if (!normalizedQuery) return 0;
  return fields.reduce((acc, current, index) => {
    if (!current) return acc;
    const normalizedValue = normalizeText(current);
    const position = normalizedValue.indexOf(normalizedQuery);
    if (position === -1) return acc;
    const lengthFactor = normalizedQuery.length / Math.max(normalizedValue.length, normalizedQuery.length);
    const positionBoost = position === 0 ? 2 : 1;
    const weight = index === 0 ? 1.2 : 1;
    return acc + lengthFactor * positionBoost * weight;
  }, 0);
};

const sortByScore = <T extends { _score: number }>(rows: T[], fallback?: (a: T, b: T) => number) => {
  return rows
    .filter(row => row._score > 0)
    .sort((a, b) => {
      if (a._score === b._score) {
        return fallback ? fallback(a, b) : 0;
      }
      return b._score - a._score;
    });
};

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
    .neq('comment', null)
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

export async function searchEntities(query: string, limit = 6): Promise<SearchResults> {
  const trimmed = (query ?? '').trim();
  if (!trimmed) {
    return { query: '', courses: [], teachers: [], sheets: [] };
  }

  const normalizedQuery = normalizeText(trimmed);
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 25) : 6;
  const pattern = `%${trimmed}%`;

  const [coursesRes, teachersRes] = await Promise.all([
    supabaseClient
      .from('courses')
      .select('id, code, name, sheets(count)')
      .or(`code.ilike.${pattern},name.ilike.${pattern}`)
      .limit(safeLimit * 2),
    supabaseClient
      .from('teachers')
      .select(
        'id, full_name, bio, avg_overall, rating_count, avatar_url, courses_teachers:courses_teachers ( courses:course_id (code,name) )'
      )
      .eq('is_hidden', false)
      .or(`full_name.ilike.${pattern},bio.ilike.${pattern}`)
      .limit(safeLimit * 2),
  ]);

  if (coursesRes.error) console.error('searchEntities courses error', coursesRes.error);
  if (teachersRes.error) console.error('searchEntities teachers error', teachersRes.error);

  const courses = sortByScore(
    (coursesRes.data || []).map((course: any) => ({
      id: course.id,
      code: course.code,
      name: course.name,
      sheetCount: course.sheets?.[0]?.count ?? 0,
      _score: scoreAgainstQuery(normalizedQuery, [course.code, course.name]),
    })),
    (a, b) => (b.sheetCount ?? 0) - (a.sheetCount ?? 0)
  )
    .slice(0, safeLimit)
    .map(({ _score, ...rest }) => rest) as CourseSummary[];

  const teachers = sortByScore(
    formatTeacherSummary(teachersRes.data || []).map(t => {
      const courseLabels = (t.courses || []).map(c => `${c.code} ${c.name}`);
      return {
        ...t,
        _score: scoreAgainstQuery(normalizedQuery, [t.full_name, t.bio, ...courseLabels]),
      };
    }),
    (a, b) => (b.rating_count ?? 0) - (a.rating_count ?? 0)
  )
    .slice(0, safeLimit)
    .map(({ _score, ...rest }) => rest) as TeacherSummary[];

  const courseIdsForSheets =
    courses.length > 0
      ? courses.map(c => c.id)
      : (coursesRes.data || []).map((c: any) => c.id).filter(Boolean);

  const sheetFilters = [
    `exam_type.ilike.${pattern}`,
    `cycle.ilike.${pattern}`,
    `teacher_hint.ilike.${pattern}`,
  ];

  if (courseIdsForSheets.length) {
    sheetFilters.push(`course_id.in.(${courseIdsForSheets.join(',')})`);
  }

  const { data: sheetRows, error: sheetError } = await supabaseClient
    .from('sheets')
    .select(
      'id, exam_type, cycle, avg_difficulty, rating_count, view_count, teacher_hint, solution_kind, courses:course_id (id, code, name)'
    )
    .or(sheetFilters.join(','))
    .limit(safeLimit * 2);

  if (sheetError) console.error('searchEntities sheets error', sheetError);

  const sheets = sortByScore(
    (sheetRows || []).map((sheet: any) => ({
      id: sheet.id,
      exam_type: sheet.exam_type,
      cycle: sheet.cycle,
      avg_difficulty: sheet.avg_difficulty,
      rating_count: sheet.rating_count ?? 0,
      view_count: sheet.view_count ?? null,
      teacher_hint: sheet.teacher_hint ?? null,
      solution_kind: sheet.solution_kind,
      course_code: sheet.courses?.code,
      course_name: sheet.courses?.name,
      _score: scoreAgainstQuery(normalizedQuery, [
        sheet.exam_type,
        sheet.cycle,
        sheet.teacher_hint,
        sheet.courses?.code,
        sheet.courses?.name,
      ]),
    })),
    (a, b) => (b.view_count ?? 0) - (a.view_count ?? 0)
  )
    .slice(0, safeLimit)
    .map(({ _score, ...rest }) => rest) as SheetSummary[];

  return { query: trimmed, courses, teachers, sheets };
}
