# Esquema BD TrikaWeb

## Tablas principales

- courses (id, code, name, faculty, cycle, ...)
- teachers (id, name, nickname, department, ...)
- courses_teachers (course_id, teacher_id)
- sheets (id, course_id, title, exam_storage_path, solution_kind, solution_storage_path, solution_video_url, avg_difficulty, rating_count, view_count, interest_count, thumb_storage_path, is_teacher_specific)
- sheet_ratings (id, sheet_id, device_id, difficulty, created_at, ...)
- sheet_interests (id, sheet_id, device_id, ip_hash, created_at)
- teacher_ratings (id, teacher_id, device_id, overall, clarity, fairness, workload, availability, comment, ... )
- sheet_views (id, sheet_id, ip_hash, device_id, type, created_at)

## Índice único de sheets

`(course_id, cycle, lower(exam_type), COALESCE(lower(teacher_hint), ''))`

Permite tener la plancha general y variantes por profesor para el mismo curso/ciclo/evaluación.

## Storage

- exams (privado): PDFs de planchas → ejemplo: `BMA02/PC1/2024-II.pdf` (general) o `BMA02/PC1/2024-II_Arambulo.pdf` (profesor específico)
- solutions (privado): solucionarios → ejemplo: `BMA02/PC1/2024-II-sol.pdf`
- thumbnails (público): imágenes preview → ejemplo: `BMA02/PC1/2024-II.png`
