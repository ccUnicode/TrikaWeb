/*
 * Archivo: function_triggers.sql
 * Propósito:
 *   - Mantener estadísticas derivadas mediante triggers.
 *   - Crear y actualizar cursos junto con sus evaluaciones.
 *   - Restringir las RPC administrativas al rol service_role.
 */

BEGIN;

/* ============================================================================
 * Estadísticas de planchas
 * Recalcula tanto el registro anterior como el nuevo en INSERT/UPDATE/DELETE.
 * ========================================================================== */
CREATE OR REPLACE FUNCTION public.refresh_sheet_stats()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
    v_sheet_ids bigint[];
BEGIN
    CASE TG_OP
        WHEN 'INSERT' THEN
            v_sheet_ids := ARRAY[NEW.sheet_id];
        WHEN 'DELETE' THEN
            v_sheet_ids := ARRAY[OLD.sheet_id];
        WHEN 'UPDATE' THEN
            v_sheet_ids := ARRAY[OLD.sheet_id, NEW.sheet_id];
        ELSE
            RAISE EXCEPTION 'Operación de trigger no soportada: %', TG_OP;
    END CASE;

    UPDATE public.sheets AS s
    SET
        avg_difficulty = COALESCE(
            (
                SELECT AVG(sr.score)::numeric(3, 2)
                FROM public.sheet_ratings AS sr
                WHERE sr.sheet_id = s.id
            ),
            0
        ),
        rating_count = (
            SELECT COUNT(*)
            FROM public.sheet_ratings AS sr
            WHERE sr.sheet_id = s.id
        )
    WHERE s.id = ANY(v_sheet_ids);

    RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS t_sheet_ratings_stats
ON public.sheet_ratings;

CREATE TRIGGER t_sheet_ratings_stats
AFTER INSERT OR UPDATE OR DELETE
ON public.sheet_ratings
FOR EACH ROW
EXECUTE FUNCTION public.refresh_sheet_stats();


/* ============================================================================
 * Conteo de vistas
 * Mantiene el contador correcto incluso si una vista cambia o se elimina.
 * ========================================================================== */
CREATE OR REPLACE FUNCTION public.refresh_view_count()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
    v_sheet_ids bigint[];
BEGIN
    CASE TG_OP
        WHEN 'INSERT' THEN
            v_sheet_ids := ARRAY[NEW.sheet_id];
        WHEN 'DELETE' THEN
            v_sheet_ids := ARRAY[OLD.sheet_id];
        WHEN 'UPDATE' THEN
            v_sheet_ids := ARRAY[OLD.sheet_id, NEW.sheet_id];
        ELSE
            RAISE EXCEPTION 'Operación de trigger no soportada: %', TG_OP;
    END CASE;

    UPDATE public.sheets AS s
    SET view_count = (
        SELECT COUNT(*)
        FROM public.sheet_views AS sv
        WHERE sv.sheet_id = s.id
    )
    WHERE s.id = ANY(v_sheet_ids);

    RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS t_sheet_views_stats
ON public.sheet_views;

CREATE TRIGGER t_sheet_views_stats
AFTER INSERT OR UPDATE OR DELETE
ON public.sheet_views
FOR EACH ROW
EXECUTE FUNCTION public.refresh_view_count();


/* ============================================================================
 * Estadísticas de profesores
 * Recalcula al profesor anterior y al nuevo cuando cambia teacher_id.
 * ========================================================================== */
CREATE OR REPLACE FUNCTION public.refresh_teacher_stats()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
    v_teacher_ids bigint[];
BEGIN
    CASE TG_OP
        WHEN 'INSERT' THEN
            v_teacher_ids := ARRAY[NEW.teacher_id];
        WHEN 'DELETE' THEN
            v_teacher_ids := ARRAY[OLD.teacher_id];
        WHEN 'UPDATE' THEN
            v_teacher_ids := ARRAY[OLD.teacher_id, NEW.teacher_id];
        ELSE
            RAISE EXCEPTION 'Operación de trigger no soportada: %', TG_OP;
    END CASE;

    UPDATE public.teachers AS t
    SET
        avg_overall = COALESCE(
            (
                SELECT AVG(tr.overall)::numeric(3, 2)
                FROM public.teacher_ratings AS tr
                WHERE tr.teacher_id = t.id
            ),
            0
        ),
        rating_count = (
            SELECT COUNT(*)
            FROM public.teacher_ratings AS tr
            WHERE tr.teacher_id = t.id
        )
    WHERE t.id = ANY(v_teacher_ids);

    RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS t_teacher_ratings_stats
ON public.teacher_ratings;

CREATE TRIGGER t_teacher_ratings_stats
AFTER INSERT OR UPDATE OR DELETE
ON public.teacher_ratings
FOR EACH ROW
EXECUTE FUNCTION public.refresh_teacher_stats();

/* ============================================================================
 * RPC: creación de cursos
 * ========================================================================== */

CREATE OR REPLACE FUNCTION public.create_course_with_evaluations(p_code text, p_name text, p_summary text, p_credits integer, p_system_id integer, p_subsystem_id integer, p_selected_evaluations integer[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_created_course public.courses%rowtype;

    v_system record;
    v_subsystem record;

    v_status public.courses.status%type;

    v_selected_count integer := 0;
    v_distinct_selected_count integer := 0;

    v_all_evaluation_ids integer[] := '{}'::integer[];
BEGIN
    /* Normalización */
    p_code := upper(
        btrim(
            coalesce(p_code, '')
        )
    );

    p_name := btrim(
        coalesce(p_name, '')
    );

    /*
     * La sumilla es opcional.
     * Vacío o espacios se convierten en NULL.
     */
    p_summary := nullif(
        btrim(
            coalesce(p_summary, '')
        ),
        ''
    );

    p_selected_evaluations := coalesce(
        p_selected_evaluations,
        '{}'::integer[]
    );

    /* Validaciones generales */
    IF char_length(p_code) < 2 THEN
        RETURN json_build_object(
            'ok', false,
            'error',
            'El código es requerido (mínimo 2 caracteres)'
        );
    END IF;

    IF char_length(p_name) < 2 THEN
        RETURN json_build_object(
            'ok', false,
            'error',
            'El nombre es requerido (mínimo 2 caracteres)'
        );
    END IF;

    IF p_summary IS NOT NULL
       AND char_length(p_summary) > 1000 THEN
        RETURN json_build_object(
            'ok', false,
            'error',
            'La sumilla no puede superar los 1000 caracteres'
        );
    END IF;

    IF p_credits IS NULL OR p_credits <= 0 THEN
        RETURN json_build_object(
            'ok', false,
            'error',
            'Los créditos deben ser un número entero mayor a 0'
        );
    END IF;

    IF p_system_id IS NULL OR p_system_id <= 0 THEN
        RETURN json_build_object(
            'ok', false,
            'error',
            'Sistema inválido'
        );
    END IF;

    /* Código único */
    IF EXISTS (
        SELECT 1
        FROM public.courses
        WHERE upper(btrim(code)) = p_code
    ) THEN
        RETURN json_build_object(
            'ok', false,
            'error',
            'Ya existe un curso con ese código'
        );
    END IF;

    /* Verificar sistema */
    SELECT *
    INTO v_system
    FROM public.evaluation_systems
    WHERE system_id = p_system_id;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'ok', false,
            'error',
            'Sistema inválido'
        );
    END IF;

    /* Validar IDs de evaluaciones */
    IF EXISTS (
        SELECT 1
        FROM unnest(p_selected_evaluations)
            AS selected(evaluation_id)
        WHERE selected.evaluation_id IS NULL
           OR selected.evaluation_id <= 0
    ) THEN
        RETURN json_build_object(
            'ok', false,
            'error',
            'Hay evaluaciones seleccionadas inválidas'
        );
    END IF;

    v_selected_count :=
        cardinality(p_selected_evaluations);

    SELECT count(
        DISTINCT selected.evaluation_id
    )::integer
    INTO v_distinct_selected_count
    FROM unnest(p_selected_evaluations)
        AS selected(evaluation_id);

    IF v_selected_count <>
       v_distinct_selected_count THEN
        RETURN json_build_object(
            'ok', false,
            'error',
            'Hay evaluaciones seleccionadas repetidas'
        );
    END IF;

    /* Validar subsistema y cantidad de evaluaciones */
    IF v_system.requires_subsystem IS TRUE THEN
        IF p_subsystem_id IS NULL THEN
            IF v_selected_count > 0 THEN
                RETURN json_build_object(
                    'ok', false,
                    'error',
                    'No se pueden seleccionar evaluaciones mientras el subsistema esté pendiente'
                );
            END IF;
        ELSE
            SELECT *
            INTO v_subsystem
            FROM public.evaluation_subsystems
            WHERE subsystem_id = p_subsystem_id;

            IF NOT FOUND THEN
                RETURN json_build_object(
                    'ok', false,
                    'error',
                    'Subsistema inválido'
                );
            END IF;

            IF v_selected_count <>
               v_subsystem.practices_quantity THEN
                RETURN json_build_object(
                    'ok', false,
                    'error',
                    format(
                        'Debe seleccionar exactamente %s evaluaciones',
                        v_subsystem.practices_quantity
                    )
                );
            END IF;
        END IF;
    ELSE
        IF p_subsystem_id IS NOT NULL THEN
            RETURN json_build_object(
                'ok', false,
                'error',
                'El sistema seleccionado no requiere subsistema'
            );
        END IF;

        IF v_selected_count > 0 THEN
            RETURN json_build_object(
                'ok', false,
                'error',
                'Este sistema no debe recibir evaluaciones seleccionadas manualmente'
            );
        END IF;
    END IF;

    /* Verificar que las evaluaciones existan */
    IF v_selected_count > 0
       AND EXISTS (
            SELECT 1
            FROM unnest(p_selected_evaluations)
                AS selected(evaluation_id)
            LEFT JOIN public.evaluation_type et
                ON et.evaluation_id =
                   selected.evaluation_id
            WHERE et.evaluation_id IS NULL
       ) THEN
        RETURN json_build_object(
            'ok', false,
            'error',
            'Hay evaluaciones seleccionadas inválidas'
        );
    END IF;

    /* Verificar que correspondan al sistema */
    IF v_selected_count > 0
       AND EXISTS (
            SELECT 1
            FROM unnest(p_selected_evaluations)
                AS selected(evaluation_id)

            LEFT JOIN (
                SELECT DISTINCT
                    get1.evaluation_id
                FROM public.system_grades_consider sgc
                JOIN public.grade_evaluation_type get1
                    ON get1.grade_id =
                       sgc.grade_id
                JOIN public.evaluation_type et
                    ON et.evaluation_id =
                       get1.evaluation_id
                WHERE sgc.system_id = p_system_id
                  AND upper(
                      coalesce(
                          et.evaluation_category,
                          ''
                      )
                  ) IN (
                      'PRACTICA',
                      'LABORATORIO',
                      'TRABAJO'
                  )
            ) allowed
                ON allowed.evaluation_id =
                   selected.evaluation_id

            WHERE allowed.evaluation_id IS NULL
       ) THEN
        RETURN json_build_object(
            'ok', false,
            'error',
            'Hay evaluaciones seleccionadas que no corresponden al sistema elegido'
        );
    END IF;

    /*
     * Estado final:
     * - Sin sumilla: INCOMPLETO.
     * - Sin subsistema requerido: INCOMPLETO.
     * - Todo configurado: COMPLETO.
     */
    IF p_summary IS NULL
       OR (
           v_system.requires_subsystem IS TRUE
           AND p_subsystem_id IS NULL
       ) THEN
        v_status := 'INCOMPLETO';
    ELSE
        v_status := 'COMPLETO';
    END IF;

    /* Registrar curso */
    INSERT INTO public.courses (
        code,
        name,
        summary,
        credits,
        system_id,
        subsystem_id,
        status,
        is_hidden
    )
    VALUES (
        p_code,
        p_name,
        p_summary,
        p_credits,
        p_system_id,
        p_subsystem_id,
        v_status,
        false
    )
    RETURNING *
    INTO v_created_course;

    /* Construir evaluaciones del curso */
    SELECT coalesce(
        array_agg(
            DISTINCT evaluations.evaluation_id
        ) FILTER (
            WHERE evaluations.evaluation_id
                  IS NOT NULL
        ),
        '{}'::integer[]
    )
    INTO v_all_evaluation_ids
    FROM (
        /* Evaluaciones fijas */
        SELECT get1.evaluation_id
        FROM public.system_grades_consider sgc
        JOIN public.grade_evaluation_type get1
            ON get1.grade_id = sgc.grade_id
        JOIN public.evaluation_type et
            ON et.evaluation_id =
               get1.evaluation_id
        WHERE sgc.system_id = p_system_id
          AND upper(
              coalesce(
                  et.evaluation_category,
                  ''
              )
          ) NOT IN (
              'PRACTICA',
              'LABORATORIO',
              'TRABAJO'
          )

        UNION

        /* Evaluaciones variables */
        SELECT selected.evaluation_id
        FROM unnest(p_selected_evaluations)
            AS selected(evaluation_id)

        UNION

        /* Examen sustitutorio */
        SELECT et_es.evaluation_id
        FROM public.evaluation_type et_es
        WHERE upper(
            coalesce(
                et_es.evaluation_abr,
                ''
            )
        ) = 'ES'
          AND EXISTS (
              SELECT 1
              FROM public.system_grades_consider sgc
              JOIN public.grade_evaluation_type get_ep
                  ON get_ep.grade_id =
                     sgc.grade_id
              JOIN public.evaluation_type et_ep
                  ON et_ep.evaluation_id =
                     get_ep.evaluation_id
              WHERE sgc.system_id = p_system_id
                AND upper(
                    coalesce(
                        et_ep.evaluation_abr,
                        ''
                    )
                ) = 'EP'
          )
          AND EXISTS (
              SELECT 1
              FROM public.system_grades_consider sgc
              JOIN public.grade_evaluation_type get_ef
                  ON get_ef.grade_id =
                     sgc.grade_id
              JOIN public.evaluation_type et_ef
                  ON et_ef.evaluation_id =
                     get_ef.evaluation_id
              WHERE sgc.system_id = p_system_id
                AND upper(
                    coalesce(
                        et_ef.evaluation_abr,
                        ''
                    )
                ) = 'EF'
          )

        UNION

        /* Prueba de entrada */
        SELECT et_pe.evaluation_id
        FROM public.evaluation_type et_pe
        WHERE upper(
            coalesce(
                et_pe.evaluation_abr,
                ''
            )
        ) = 'PE'
    ) AS evaluations;

    IF cardinality(v_all_evaluation_ids) > 0 THEN
        INSERT INTO public.course_evaluations (
            course_id,
            evaluation_id
        )
        SELECT
            v_created_course.id,
            evaluation.evaluation_id
        FROM unnest(v_all_evaluation_ids)
            AS evaluation(evaluation_id);
    END IF;

    RETURN json_build_object(
        'ok', true,
        'course', json_build_object(
            'id',
                v_created_course.id,
            'code',
                v_created_course.code,
            'name',
                v_created_course.name,
            'summary',
                v_created_course.summary,
            'credits',
                v_created_course.credits,
            'system_id',
                v_created_course.system_id,
            'subsystem_id',
                v_created_course.subsystem_id,
            'status',
                v_created_course.status,
            'is_hidden',
                v_created_course.is_hidden
        )
    );

EXCEPTION
    WHEN unique_violation THEN
        RETURN json_build_object(
            'ok', false,
            'error',
            'Ya existe un curso con ese código o se intentó duplicar una evaluación'
        );

    WHEN foreign_key_violation THEN
        RETURN json_build_object(
            'ok', false,
            'error',
            'Uno de los registros relacionados no existe'
        );

    WHEN check_violation THEN
        RETURN json_build_object(
            'ok', false,
            'error',
            'Uno de los valores no cumple las restricciones establecidas'
        );

    WHEN OTHERS THEN
        RAISE LOG
            'Error inesperado en create_course_with_evaluations. SQLSTATE: %, error: %',
            SQLSTATE,
            SQLERRM;

        RETURN json_build_object(
            'ok', false,
            'error',
            'No se pudo registrar el curso'
        );
END;
$function$;

/* ============================================================================
 * RPC: actualización de cursos
 * ========================================================================== */

CREATE OR REPLACE FUNCTION public.update_course_with_evaluations(p_course_id integer, p_code text, p_name text, p_summary text, p_credits integer, p_system_id integer, p_subsystem_id integer, p_selected_evaluations integer[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_existing_course public.courses%rowtype;
    v_updated_course public.courses%rowtype;

    v_system record;
    v_subsystem record;

    v_status public.courses.status%type;

    v_selected_count integer := 0;
    v_distinct_selected_count integer := 0;

    v_all_evaluation_ids integer[] := '{}'::integer[];
BEGIN
    /* Normalización */
    p_code := upper(
        btrim(
            coalesce(p_code, '')
        )
    );

    p_name := btrim(
        coalesce(p_name, '')
    );

    p_summary := nullif(
        btrim(
            coalesce(p_summary, '')
        ),
        ''
    );

    p_selected_evaluations := coalesce(
        p_selected_evaluations,
        '{}'::integer[]
    );

    /* Validar curso */
    IF p_course_id IS NULL
       OR p_course_id <= 0 THEN
        RETURN json_build_object(
            'ok', false,
            'error',
            'Curso inválido'
        );
    END IF;

    SELECT *
    INTO v_existing_course
    FROM public.courses
    WHERE id = p_course_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'ok', false,
            'error',
            'Curso no encontrado'
        );
    END IF;

    /* Validaciones generales */
    IF char_length(p_code) < 2 THEN
        RETURN json_build_object(
            'ok', false,
            'error',
            'El código es requerido (mínimo 2 caracteres)'
        );
    END IF;

    IF char_length(p_name) < 2 THEN
        RETURN json_build_object(
            'ok', false,
            'error',
            'El nombre es requerido (mínimo 2 caracteres)'
        );
    END IF;

    IF p_summary IS NOT NULL
       AND char_length(p_summary) > 1000 THEN
        RETURN json_build_object(
            'ok', false,
            'error',
            'La sumilla no puede superar los 1000 caracteres'
        );
    END IF;

    IF p_credits IS NULL OR p_credits <= 0 THEN
        RETURN json_build_object(
            'ok', false,
            'error',
            'Los créditos deben ser un número entero mayor a 0'
        );
    END IF;

    IF p_system_id IS NULL OR p_system_id <= 0 THEN
        RETURN json_build_object(
            'ok', false,
            'error',
            'Sistema inválido'
        );
    END IF;

    /* Código único, excluyendo el curso actual */
    IF EXISTS (
        SELECT 1
        FROM public.courses
        WHERE upper(btrim(code)) = p_code
          AND id <> p_course_id
    ) THEN
        RETURN json_build_object(
            'ok', false,
            'error',
            'Ya existe otro curso con ese código'
        );
    END IF;

    /* Verificar sistema */
    SELECT *
    INTO v_system
    FROM public.evaluation_systems
    WHERE system_id = p_system_id;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'ok', false,
            'error',
            'Sistema inválido'
        );
    END IF;

    /* Validar IDs de evaluaciones */
    IF EXISTS (
        SELECT 1
        FROM unnest(p_selected_evaluations)
            AS selected(evaluation_id)
        WHERE selected.evaluation_id IS NULL
           OR selected.evaluation_id <= 0
    ) THEN
        RETURN json_build_object(
            'ok', false,
            'error',
            'Hay evaluaciones seleccionadas inválidas'
        );
    END IF;

    v_selected_count :=
        cardinality(p_selected_evaluations);

    SELECT count(
        DISTINCT selected.evaluation_id
    )::integer
    INTO v_distinct_selected_count
    FROM unnest(p_selected_evaluations)
        AS selected(evaluation_id);

    IF v_selected_count <>
       v_distinct_selected_count THEN
        RETURN json_build_object(
            'ok', false,
            'error',
            'Hay evaluaciones seleccionadas repetidas'
        );
    END IF;

    /* Validar subsistema */
    IF v_system.requires_subsystem IS TRUE THEN
        IF p_subsystem_id IS NULL THEN
            IF v_selected_count > 0 THEN
                RETURN json_build_object(
                    'ok', false,
                    'error',
                    'No se pueden seleccionar evaluaciones mientras el subsistema esté pendiente'
                );
            END IF;
        ELSE
            SELECT *
            INTO v_subsystem
            FROM public.evaluation_subsystems
            WHERE subsystem_id = p_subsystem_id;

            IF NOT FOUND THEN
                RETURN json_build_object(
                    'ok', false,
                    'error',
                    'Subsistema inválido'
                );
            END IF;

            IF v_selected_count <>
               v_subsystem.practices_quantity THEN
                RETURN json_build_object(
                    'ok', false,
                    'error',
                    format(
                        'Debe seleccionar exactamente %s evaluaciones',
                        v_subsystem.practices_quantity
                    )
                );
            END IF;
        END IF;
    ELSE
        IF p_subsystem_id IS NOT NULL THEN
            RETURN json_build_object(
                'ok', false,
                'error',
                'El sistema seleccionado no requiere subsistema'
            );
        END IF;

        IF v_selected_count > 0 THEN
            RETURN json_build_object(
                'ok', false,
                'error',
                'Este sistema no debe recibir evaluaciones seleccionadas manualmente'
            );
        END IF;
    END IF;

    /* Verificar existencia de evaluaciones */
    IF v_selected_count > 0
       AND EXISTS (
            SELECT 1
            FROM unnest(p_selected_evaluations)
                AS selected(evaluation_id)
            LEFT JOIN public.evaluation_type et
                ON et.evaluation_id =
                   selected.evaluation_id
            WHERE et.evaluation_id IS NULL
       ) THEN
        RETURN json_build_object(
            'ok', false,
            'error',
            'Hay evaluaciones seleccionadas inválidas'
        );
    END IF;

    /* Verificar que correspondan al sistema */
    IF v_selected_count > 0
       AND EXISTS (
            SELECT 1
            FROM unnest(p_selected_evaluations)
                AS selected(evaluation_id)

            LEFT JOIN (
                SELECT DISTINCT
                    get1.evaluation_id
                FROM public.system_grades_consider sgc
                JOIN public.grade_evaluation_type get1
                    ON get1.grade_id =
                       sgc.grade_id
                JOIN public.evaluation_type et
                    ON et.evaluation_id =
                       get1.evaluation_id
                WHERE sgc.system_id = p_system_id
                  AND upper(
                      coalesce(
                          et.evaluation_category,
                          ''
                      )
                  ) IN (
                      'PRACTICA',
                      'LABORATORIO',
                      'TRABAJO'
                  )
            ) allowed
                ON allowed.evaluation_id =
                   selected.evaluation_id

            WHERE allowed.evaluation_id IS NULL
       ) THEN
        RETURN json_build_object(
            'ok', false,
            'error',
            'Hay evaluaciones seleccionadas que no corresponden al sistema elegido'
        );
    END IF;

    /* Calcular el estado final */
    IF p_summary IS NULL
       OR (
           v_system.requires_subsystem IS TRUE
           AND p_subsystem_id IS NULL
       ) THEN
        v_status := 'INCOMPLETO';
    ELSE
        v_status := 'COMPLETO';
    END IF;

    /* Actualizar curso */
    UPDATE public.courses
    SET
        code = p_code,
        name = p_name,
        summary = p_summary,
        credits = p_credits,
        system_id = p_system_id,
        subsystem_id = p_subsystem_id,
        status = v_status
    WHERE id = p_course_id
    RETURNING *
    INTO v_updated_course;

    /* Construir evaluaciones */
    SELECT coalesce(
        array_agg(
            DISTINCT evaluations.evaluation_id
        ) FILTER (
            WHERE evaluations.evaluation_id
                  IS NOT NULL
        ),
        '{}'::integer[]
    )
    INTO v_all_evaluation_ids
    FROM (
        /* Evaluaciones fijas */
        SELECT get1.evaluation_id
        FROM public.system_grades_consider sgc
        JOIN public.grade_evaluation_type get1
            ON get1.grade_id = sgc.grade_id
        JOIN public.evaluation_type et
            ON et.evaluation_id =
               get1.evaluation_id
        WHERE sgc.system_id = p_system_id
          AND upper(
              coalesce(
                  et.evaluation_category,
                  ''
              )
          ) NOT IN (
              'PRACTICA',
              'LABORATORIO',
              'TRABAJO'
          )

        UNION

        /* Evaluaciones variables */
        SELECT selected.evaluation_id
        FROM unnest(p_selected_evaluations)
            AS selected(evaluation_id)

        UNION

        /* Examen sustitutorio */
        SELECT et_es.evaluation_id
        FROM public.evaluation_type et_es
        WHERE upper(
            coalesce(
                et_es.evaluation_abr,
                ''
            )
        ) = 'ES'
          AND EXISTS (
              SELECT 1
              FROM public.system_grades_consider sgc
              JOIN public.grade_evaluation_type get_ep
                  ON get_ep.grade_id =
                     sgc.grade_id
              JOIN public.evaluation_type et_ep
                  ON et_ep.evaluation_id =
                     get_ep.evaluation_id
              WHERE sgc.system_id = p_system_id
                AND upper(
                    coalesce(
                        et_ep.evaluation_abr,
                        ''
                    )
                ) = 'EP'
          )
          AND EXISTS (
              SELECT 1
              FROM public.system_grades_consider sgc
              JOIN public.grade_evaluation_type get_ef
                  ON get_ef.grade_id =
                     sgc.grade_id
              JOIN public.evaluation_type et_ef
                  ON et_ef.evaluation_id =
                     get_ef.evaluation_id
              WHERE sgc.system_id = p_system_id
                AND upper(
                    coalesce(
                        et_ef.evaluation_abr,
                        ''
                    )
                ) = 'EF'
          )

        UNION

        /* Prueba de entrada */
        SELECT et_pe.evaluation_id
        FROM public.evaluation_type et_pe
        WHERE upper(
            coalesce(
                et_pe.evaluation_abr,
                ''
            )
        ) = 'PE'
    ) AS evaluations;

    /* Reconstruir relaciones */
    DELETE FROM public.course_evaluations
    WHERE course_id = p_course_id;

    IF cardinality(v_all_evaluation_ids) > 0 THEN
        INSERT INTO public.course_evaluations (
            course_id,
            evaluation_id
        )
        SELECT
            p_course_id,
            evaluation.evaluation_id
        FROM unnest(v_all_evaluation_ids)
            AS evaluation(evaluation_id);
    END IF;

    RETURN json_build_object(
        'ok', true,
        'course', json_build_object(
            'id',
                v_updated_course.id,
            'code',
                v_updated_course.code,
            'name',
                v_updated_course.name,
            'summary',
                v_updated_course.summary,
            'credits',
                v_updated_course.credits,
            'system_id',
                v_updated_course.system_id,
            'subsystem_id',
                v_updated_course.subsystem_id,
            'status',
                v_updated_course.status,
            'is_hidden',
                v_updated_course.is_hidden
        )
    );

EXCEPTION
    WHEN unique_violation THEN
        RETURN json_build_object(
            'ok', false,
            'error',
            'Ya existe otro curso con ese código o se intentó duplicar una evaluación'
        );

    WHEN foreign_key_violation THEN
        RETURN json_build_object(
            'ok', false,
            'error',
            'Uno de los registros relacionados no existe'
        );

    WHEN check_violation THEN
        RETURN json_build_object(
            'ok', false,
            'error',
            'Uno de los valores no cumple las restricciones establecidas'
        );

    WHEN OTHERS THEN
        RAISE LOG
            'Error inesperado en update_course_with_evaluations. SQLSTATE: %, error: %',
            SQLSTATE,
            SQLERRM;

        RETURN json_build_object(
            'ok', false,
            'error',
            'No se pudo actualizar el curso'
        );
END;
$function$;

/* ============================================================================
 * Permisos de las RPC administrativas
 * Solo los endpoints de servidor que usan service_role pueden ejecutarlas.
 * ========================================================================== */
REVOKE ALL
ON FUNCTION public.create_course_with_evaluations(
    text,
    text,
    text,
    integer,
    integer,
    integer,
    integer[]
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.create_course_with_evaluations(
    text,
    text,
    text,
    integer,
    integer,
    integer,
    integer[]
)
TO service_role;

REVOKE ALL
ON FUNCTION public.update_course_with_evaluations(
    integer,
    text,
    text,
    text,
    integer,
    integer,
    integer,
    integer[]
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.update_course_with_evaluations(
    integer,
    text,
    text,
    text,
    integer,
    integer,
    integer,
    integer[]
)
TO service_role;


/* Las funciones de trigger no necesitan ser invocadas directamente por clientes. */
REVOKE ALL ON FUNCTION public.refresh_sheet_stats()
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.refresh_view_count()
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.refresh_teacher_stats()
FROM PUBLIC, anon, authenticated;

COMMIT;
