# Esquema BD TrikaWeb

## Tablas principales

- courses (id, code, name, faculty, cycle, ...)
- teachers (id, name, nickname, department, ...)
- courses_teachers (course_id, teacher_id)
- sheets (id, course_id, title, exam_storage_path, solution_kind, solution_storage_path, solution_video_url, avg_difficulty, rating_count, view_count, thumb_storage_path)
- sheet_ratings (id, sheet_id, device_id, difficulty, created_at, ...)
- teacher_ratings (id, teacher_id, device_id, overall, clarity, fairness, workload, availability, comment, ... )
- sheet_views (id, sheet_id, ip_hash, device_id, type, created_at)

## Storage

- exams (privado): PDFs de planchas → ejemplo: `BMA02/PC1/2024-II.pdf`
- solutions (privado): solucionarios → ejemplo: `BMA02/PC1/2024-II-sol.pdf`
- thumbnails (público): imágenes preview → ejemplo: `BMA02/PC1/2024-II.png`
