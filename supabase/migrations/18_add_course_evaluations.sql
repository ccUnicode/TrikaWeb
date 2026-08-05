-- Migración 18
-- Agregar evaluaciones configurables por curso
-- Relaciona cursos con evaluaciones y crea los RPC administrativos de alta y edición.
-- Diseñada para ejecutarse sobre el schema original entregado al equipo.

begin;


create table if not exists public.course_evaluations (
  course_id integer not null
    references public.courses(id) on delete cascade,
  evaluation_id integer not null
    references public.evaluation_type(evaluation_id) on delete cascade,
  constraint course_evaluations_course_evaluation_key
    unique (course_id, evaluation_id)
);

-- Evaluaciones recuperadas para los cursos existentes.
insert into public.course_evaluations (
  course_id,
  evaluation_id
)
select
  course.id,
  source.evaluation_id
from (
  values
    ('BMA01', 1),
    ('BMA01', 2),
    ('BMA01', 3),
    ('BMA01', 4),
    ('BMA01', 17),
    ('BMA01', 18),
    ('BMA02', 1),
    ('BMA02', 2),
    ('BMA02', 3),
    ('BMA02', 4),
    ('BMA02', 17),
    ('BMA02', 18),
    ('FB303', 1),
    ('FB303', 2),
    ('FB303', 3),
    ('FB303', 4),
    ('FB303', 17),
    ('FB303', 18),
    ('FB403', 1),
    ('FB403', 2),
    ('FB403', 3),
    ('FB403', 4),
    ('FB403', 17),
    ('FB403', 18),
    ('FB101', 1),
    ('FB101', 2),
    ('FB101', 3),
    ('FB101', 4),
    ('FB101', 17),
    ('FB101', 18),
    ('BEG01', 1),
    ('BEG01', 2),
    ('BEG01', 3),
    ('BEG01', 4),
    ('BEG01', 17),
    ('BEG01', 18),
    ('BEG01', 21),
    ('BEG01', 22),
    ('SW101', 1),
    ('SW101', 2),
    ('SW101', 3),
    ('SW101', 4),
    ('SW101', 17),
    ('SW101', 18),
    ('SW101', 21),
    ('SW101', 22),
    ('SW301', 1),
    ('SW301', 2),
    ('SW301', 3),
    ('SW301', 4),
    ('SW301', 17),
    ('SW301', 18),
    ('SW301', 21),
    ('SW301', 22),
    ('SI503', 1),
    ('SI503', 2),
    ('SI503', 3),
    ('SI503', 4),
    ('SI503', 14),
    ('BQU01', 1),
    ('BQU01', 2),
    ('BQU01', 3),
    ('BQU01', 4),
    ('BQU01', 6),
    ('BQU01', 7),
    ('BQU01', 8),
    ('BQU01', 9),
    ('BQU01', 10),
    ('BQU01', 11),
    ('BQU01', 12),
    ('BQU01', 13),
    ('BQU01', 17),
    ('BQU01', 18),
    ('SI503', 17),
    ('SI503', 18),
    ('SI503', 21),
    ('SI503', 22),
    ('SI405', 1),
    ('SI405', 2),
    ('BFI01', 1),
    ('BFI01', 2),
    ('BFI01', 3),
    ('BFI01', 4),
    ('BFI01', 5),
    ('BFI01', 6),
    ('BFI01', 7),
    ('BFI01', 8),
    ('BFI01', 9),
    ('BFI01', 10),
    ('BFI01', 17),
    ('BFI01', 18),
    ('SI405', 3),
    ('SI405', 4),
    ('SI405', 14),
    ('SI405', 17),
    ('SI405', 18),
    ('SI405', 21),
    ('FB401', 1),
    ('FB401', 2),
    ('FB401', 3),
    ('FB401', 4),
    ('FB401', 5),
    ('FB401', 6),
    ('FB401', 7),
    ('FB401', 8),
    ('FB401', 9),
    ('FB401', 10),
    ('FB401', 17),
    ('FB401', 18),
    ('BRC01', 1),
    ('BRC01', 2),
    ('BRC01', 3),
    ('BRC01', 4),
    ('BRC01', 14),
    ('BRC01', 15),
    ('HU102', 1),
    ('HU102', 2),
    ('HU102', 3),
    ('HU102', 4),
    ('HU102', 14),
    ('HU102', 15),
    ('BEF01', 1),
    ('BEF01', 2),
    ('BEF01', 3),
    ('BEF01', 4),
    ('BEF01', 14),
    ('BIC01', 6),
    ('BIC01', 7),
    ('BIC01', 8),
    ('BIC01', 9),
    ('BIC01', 17),
    ('BIC01', 18),
    ('SI405', 22),
    ('SW403', 1),
    ('SW403', 2),
    ('SW403', 3),
    ('SW403', 4),
    ('SW403', 14),
    ('SI205', 1),
    ('SI205', 2),
    ('SI205', 3),
    ('SI205', 4),
    ('SI205', 17),
    ('SI205', 18),
    ('FB301', 1),
    ('FB301', 2),
    ('FB301', 3),
    ('FB301', 4),
    ('FB301', 17),
    ('FB301', 18),
    ('FB305', 1),
    ('FB305', 2),
    ('FB305', 3),
    ('FB305', 4),
    ('FB305', 17),
    ('FB305', 18),
    ('SW403', 17),
    ('SW403', 18),
    ('SW403', 21),
    ('SW403', 22),
    ('SW407', 1),
    ('SW407', 2),
    ('SW407', 3),
    ('SW407', 4),
    ('SW407', 17),
    ('SW407', 18),
    ('SW407', 21),
    ('SW407', 22),
    ('BRN01', 1),
    ('BRN01', 2),
    ('BRN01', 3),
    ('BRN01', 4),
    ('BRN01', 22),
    ('HU501', 1),
    ('HU501', 2),
    ('HU501', 3),
    ('HU501', 4),
    ('BRC01', 22),
    ('HU102', 22),
    ('FB401', 22),
    ('BMA02', 22),
    ('SI205', 22),
    ('BEF01', 22),
    ('FB101', 22),
    ('FB202', 22),
    ('FB403', 22),
    ('BMA01', 22),
    ('FB303', 22),
    ('BIC01', 22),
    ('BFI01', 22),
    ('BQU01', 22),
    ('BMA02', 21),
    ('FB401', 21),
    ('FB202', 21),
    ('BIC01', 21),
    ('FB303', 21),
    ('BQU01', 21),
    ('BFI01', 21),
    ('FB403', 21),
    ('SI205', 21),
    ('FB101', 21),
    ('BMA01', 21),
    ('FB301', 22),
    ('FB305', 22),
    ('FB305', 21),
    ('FB301', 21),
    ('HU501', 14),
    ('HU501', 15),
    ('HU501', 22),
    ('SI505', 1),
    ('SI505', 2),
    ('SI505', 3),
    ('SI505', 4),
    ('SI505', 14),
    ('SI505', 17),
    ('SI505', 18),
    ('SI505', 21),
    ('SI505', 22),
    ('SW405', 14),
    ('SW405', 15),
    ('SW405', 17),
    ('SW405', 18),
    ('SW405', 21),
    ('SW405', 22),
    ('SW405', 24),
    ('SW405', 25),
    ('SI101', 1),
    ('SI101', 2),
    ('SI101', 3),
    ('SI101', 4),
    ('SI101', 17),
    ('SI101', 18),
    ('SI101', 21),
    ('SI101', 22),
    ('SI201', 1),
    ('SI201', 2),
    ('SI201', 3),
    ('SI201', 4),
    ('SI201', 14),
    ('SI201', 17),
    ('SI201', 18),
    ('SI201', 21),
    ('SI201', 22),
    ('SI203', 1),
    ('SI203', 2),
    ('SI203', 3),
    ('SI203', 4),
    ('SI203', 14),
    ('SI203', 15),
    ('SI203', 17),
    ('SI203', 18),
    ('SI203', 21),
    ('SI203', 22),
    ('SI207', 1),
    ('SI207', 2),
    ('SI207', 3),
    ('SI207', 4),
    ('SI207', 5),
    ('SI207', 14),
    ('SI207', 17),
    ('SI207', 18),
    ('SI207', 21),
    ('SI207', 22),
    ('HU301', 1),
    ('HU301', 2),
    ('HU301', 3),
    ('HU301', 4),
    ('HU301', 14),
    ('HU301', 22),
    ('SI301', 1),
    ('SI301', 2),
    ('SI301', 14),
    ('SI301', 15),
    ('SI301', 17),
    ('SI301', 18),
    ('SI301', 21),
    ('SI301', 22),
    ('SI302', 1),
    ('SI302', 2),
    ('SI302', 3),
    ('SI302', 4),
    ('SI302', 17),
    ('SI302', 18),
    ('SI302', 21),
    ('SI302', 22),
    ('SI403', 1),
    ('SI403', 14),
    ('SI403', 15),
    ('SI403', 17),
    ('SI403', 18),
    ('SI403', 21),
    ('SI403', 22),
    ('FB402', 1),
    ('FB402', 2),
    ('FB402', 3),
    ('FB402', 4),
    ('FB402', 17),
    ('FB402', 18),
    ('FB402', 21),
    ('FB402', 22),
    ('FB405', 1),
    ('FB405', 2),
    ('FB405', 3),
    ('FB405', 4),
    ('FB405', 17),
    ('FB405', 18),
    ('FB405', 21),
    ('FB405', 22),
    ('FB501', 1),
    ('FB501', 2),
    ('FB501', 3),
    ('FB501', 4),
    ('FB501', 17),
    ('FB501', 18),
    ('FB501', 21),
    ('FB501', 22),
    ('GE501', 1),
    ('GE501', 2),
    ('GE501', 3),
    ('GE501', 4),
    ('GE501', 14),
    ('GE501', 15),
    ('GE501', 17),
    ('GE501', 18),
    ('GE501', 21),
    ('GE501', 22),
    ('SI501', 1),
    ('SI501', 2),
    ('SI501', 3),
    ('SI501', 4),
    ('SI501', 17),
    ('SI501', 18),
    ('SI501', 21),
    ('SI501', 22),
    ('GE605', 1),
    ('GE605', 2),
    ('GE605', 3),
    ('GE605', 4),
    ('GE605', 14),
    ('GE605', 15),
    ('GE605', 17),
    ('GE605', 18),
    ('GE605', 21),
    ('GE605', 22),
    ('SI601', 1),
    ('SI601', 2),
    ('SI601', 3),
    ('SI601', 4),
    ('SI601', 17),
    ('SI601', 18),
    ('SI601', 21),
    ('SI601', 22),
    ('SI602', 1),
    ('SI602', 2),
    ('SI602', 3),
    ('SI602', 4),
    ('SI602', 22),
    ('SI603', 1),
    ('SI603', 2),
    ('SI603', 3),
    ('SI603', 4),
    ('SI603', 14),
    ('SI603', 17),
    ('SI603', 18),
    ('SI603', 21),
    ('SI603', 22),
    ('SI604', 1),
    ('SI604', 2),
    ('SI604', 3),
    ('SI604', 4),
    ('SI604', 14),
    ('SI604', 17),
    ('SI604', 18),
    ('SI604', 21),
    ('SI604', 22),
    ('SI605', 1),
    ('SI605', 2),
    ('SI605', 3),
    ('SI605', 14),
    ('SI605', 17),
    ('SI605', 18),
    ('SI605', 21),
    ('SI605', 22),
    ('SI607', 1),
    ('SI607', 2),
    ('SI607', 3),
    ('SI607', 4),
    ('SI607', 17),
    ('SI607', 18),
    ('SI607', 21),
    ('SI607', 22),
    ('BMA03', 1),
    ('BMA03', 2),
    ('BMA03', 3),
    ('BMA03', 4),
    ('BMA03', 17),
    ('BMA03', 18),
    ('BMA03', 21),
    ('BMA03', 22),
    ('SI701', 17),
    ('SI701', 18),
    ('SI701', 21),
    ('SI701', 22),
    ('GE101', 1),
    ('GE101', 2),
    ('GE101', 3),
    ('GE101', 4),
    ('GE101', 17),
    ('GE101', 18),
    ('GE101', 21),
    ('GE101', 22),
    ('SI707', 17),
    ('SI707', 18),
    ('SI707', 21),
    ('SI707', 22),
    ('TE302', 22),
    ('TE401', 17),
    ('TE401', 18),
    ('TE401', 21),
    ('TE401', 22),
    ('SI150', 17),
    ('SI150', 18),
    ('SI150', 21),
    ('SI150', 22),
    ('TE301', 17),
    ('TE301', 18),
    ('TE301', 21),
    ('TE301', 22),
    ('TE501', 17),
    ('TE501', 18),
    ('TE501', 21),
    ('TE501', 22),
    ('SW505', 22),
    ('SW503', 17),
    ('SW503', 18),
    ('SW503', 21),
    ('SW503', 22),
    ('SW507', 17),
    ('SW507', 18),
    ('SW507', 21),
    ('SW507', 22),
    ('SW605', 17),
    ('SW605', 18),
    ('SW605', 21),
    ('SW605', 22),
    ('SW608', 17),
    ('SW608', 18),
    ('SW608', 21),
    ('SW608', 22),
    ('SW609', 17),
    ('SW609', 18),
    ('SW609', 21),
    ('SW609', 22),
    ('SW603', 22),
    ('SW701', 17),
    ('SW701', 18),
    ('SW701', 21),
    ('SW701', 22),
    ('SW708', 17),
    ('SW708', 18),
    ('SW708', 21),
    ('SW708', 22),
    ('SW709', 17),
    ('SW709', 18),
    ('SW709', 21),
    ('SW709', 22),
    ('SW707', 22),
    ('SW705', 22),
    ('SW703', 17),
    ('SW703', 18),
    ('SW703', 21),
    ('SW703', 22),
    ('HU801', 22),
    ('SW803', 17),
    ('SW803', 18),
    ('SW803', 21),
    ('SW803', 22),
    ('SW805', 17),
    ('SW805', 18),
    ('SW805', 21),
    ('SW805', 22),
    ('SW807', 17),
    ('SW807', 18),
    ('SW807', 21),
    ('SW807', 22),
    ('SW809', 17),
    ('SW809', 18),
    ('SW809', 21),
    ('SW809', 22),
    ('SW901', 17),
    ('SW901', 18),
    ('SW901', 21),
    ('SW901', 22),
    ('SW902', 17),
    ('SW902', 18),
    ('SW902', 21),
    ('SW902', 22),
    ('SW903', 17),
    ('SW903', 18),
    ('SW903', 21),
    ('SW903', 22),
    ('SW904', 17),
    ('SW904', 18),
    ('SW904', 21),
    ('SW904', 22),
    ('SW905', 17),
    ('SW905', 18),
    ('SW905', 21),
    ('SW905', 22),
    ('SW907', 17),
    ('SW907', 18),
    ('SW907', 21),
    ('SW907', 22),
    ('SW001', 17),
    ('SW001', 18),
    ('SW001', 21),
    ('SW001', 22),
    ('SW002', 17),
    ('SW002', 18),
    ('SW002', 21),
    ('SW002', 22),
    ('SW003', 17),
    ('SW003', 18),
    ('SW003', 21),
    ('SW003', 22),
    ('SW004', 17),
    ('SW004', 18),
    ('SW004', 21),
    ('SW004', 22),
    ('SW005', 17),
    ('SW005', 18),
    ('SW005', 21),
    ('SW005', 22),
    ('SI705', 17),
    ('SI705', 18),
    ('SI705', 21),
    ('SI705', 22),
    ('SW501', 1),
    ('SW501', 2),
    ('SW501', 3),
    ('SW501', 4),
    ('SW501', 17),
    ('SW501', 18),
    ('SW501', 21),
    ('SW501', 22),
    ('GS804', 17),
    ('GS804', 18),
    ('GS804', 21),
    ('GS804', 22),
    ('GE709', 17),
    ('GE709', 18),
    ('GE709', 21),
    ('GE709', 22)
) as source(code, evaluation_id)
join public.courses as course
  on upper(btrim(course.code)) = source.code
on conflict (course_id, evaluation_id) do nothing;

CREATE OR REPLACE FUNCTION "public"."create_course_with_evaluations"("p_code" "text", "p_name" "text", "p_summary" "text", "p_credits" integer, "p_system_id" integer, "p_subsystem_id" integer, "p_selected_evaluations" integer[]) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
$$;

CREATE OR REPLACE FUNCTION "public"."update_course_with_evaluations"("p_course_id" integer, "p_code" "text", "p_name" "text", "p_summary" "text", "p_credits" integer, "p_system_id" integer, "p_subsystem_id" integer, "p_selected_evaluations" integer[]) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
$$;


alter table public.course_evaluations enable row level security;

drop policy if exists "public read visible course evaluations"
  on public.course_evaluations;

create policy "public read visible course evaluations"
on public.course_evaluations
for select to anon, authenticated
using (
  exists (
    select 1
    from public.courses as c
    where c.id = course_evaluations.course_id
      and c.is_hidden = false
  )
);

revoke all privileges on table public.course_evaluations
  from public, anon, authenticated;
grant all privileges on table public.course_evaluations to service_role;
grant select on public.course_evaluations to anon, authenticated;

revoke execute on function public.create_course_with_evaluations(
  text, text, text, integer, integer, integer, integer[]
) from public, anon, authenticated;

revoke execute on function public.update_course_with_evaluations(
  integer, text, text, text, integer, integer, integer, integer[]
) from public, anon, authenticated;

grant execute on function public.create_course_with_evaluations(
  text, text, text, integer, integer, integer, integer[]
) to service_role;

grant execute on function public.update_course_with_evaluations(
  integer, text, text, text, integer, integer, integer, integer[]
) to service_role;

commit;
