import { supabaseAdmin } from "../supabaseAdmin";

/**
 * Obtiene una plancha únicamente cuando:
 * - La plancha está visible.
 * - El curso asociado está visible.
 *
 * Debe utilizarse antes de mostrar contenido o generar URLs firmadas
 * mediante supabaseAdmin, ya que el cliente administrativo ignora RLS.
 */
export const getVisibleSheetById = async (sheetId: number) => {
  if (!Number.isSafeInteger(sheetId) || sheetId <= 0) {
    return {
      data: null,
      error: null,
    } as const;
  }

  return supabaseAdmin
    .from("sheets")
    .select(
      `
        id,
        course_id,
        exam_type,
        cycle,
        teacher_hint,
        avg_difficulty,
        rating_count,
        view_count,
        interest_count,
        exam_storage_path,
        solution_kind,
        solution_storage_path,
        solution_video_url,
        thumb_storage_path,
        courses:course_id!inner (
          id,
          code,
          name,
          is_hidden
        )
      `,
    )
    .eq("id", sheetId)
    .eq("is_hidden", false)
    .eq("courses.is_hidden", false)
    .maybeSingle();
};