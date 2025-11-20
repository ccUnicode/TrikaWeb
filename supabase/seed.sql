insert into courses (code, name) values
('BMA01','Cálculo Diferencial'),
('BMA02','Cálculo Integral'),
('BFI01','Física I')
on conflict do nothing;

insert into teachers (full_name,bio) values
('Carlos Eduardo Arámbulo Ostos', 'Lorem Ipsum'),
('Percy Victor Cañote Fajardo', 'Lorem Ipsum'),
('Jesús Cernades Gomez', 'Lorem Ipsum')
on conflict do nothing;

insert into sheets(
  course_id, cycle, exam_type,exam_storage_path,solution_kind,solution_storage_path) values
  (1,'2024-2','PC1','BMA02/PC1/2024-II.pdf','pdf','BMA02/PC1/2024-II.pdf') 
  returning id;
on conflict do nothing;