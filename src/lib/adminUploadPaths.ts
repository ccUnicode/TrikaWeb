/**
 * Utilidades compartidas para construir rutas de Storage en subidas admin.
 * upload-url genera las rutas firmadas; upload las recalcula y verifica.
 */

export const sanitizePathSegment = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isValidUploadSessionId = (value: string): boolean =>
  UUID_PATTERN.test(value.trim().toLowerCase());

export type SheetStoragePaths = {
  examPath: string;
  solutionPath: string;
  thumbPath: string;
};

export type BuildSheetStoragePathsInput = {
  courseCode: string;
  cycle: string;
  examType: string;
  isTeacherSpecific: boolean;
  teacherId: number | null;
  uploadSessionId?: string | null;
};

/**
 * Construye rutas canónicas o temporales (staging) para plancha, solucionario y miniatura.
 * Con uploadSessionId se generan rutas de staging que no sobrescriben la plancha existente.
 */
export const buildSheetStoragePaths = (
  input: BuildSheetStoragePathsInput,
): SheetStoragePaths => {
  const safeCourse = sanitizePathSegment(input.courseCode);
  const safeCycle = sanitizePathSegment(input.cycle);
  const safeExam = sanitizePathSegment(input.examType);
  const safeTeacher = input.isTeacherSpecific
    ? `_teacher_${input.teacherId}`
    : "";

  const stagingSuffix =
    input.uploadSessionId && isValidUploadSessionId(input.uploadSessionId)
      ? `_staging_${input.uploadSessionId.trim().toLowerCase()}`
      : "";

  const base = `${safeCourse}/${safeExam}/${safeCycle}${safeTeacher}${stagingSuffix}`;

  return {
    examPath: `${base}.pdf`,
    solutionPath: `${base}.pdf`,
    thumbPath: `${base}.jpg`,
  };
};

/**
 * Rutas finales sin sufijo de staging (para promover archivos temporales).
 */
export const buildFinalSheetStoragePaths = (
  input: Omit<BuildSheetStoragePathsInput, "uploadSessionId">,
): SheetStoragePaths => buildSheetStoragePaths({ ...input, uploadSessionId: null });
