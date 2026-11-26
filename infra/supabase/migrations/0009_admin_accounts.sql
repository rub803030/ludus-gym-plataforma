-- Cuentas de plataforma con permisos globales. Se aplica en un archivo
-- distinto de 0008 para que el valor ADMIN del enum ya esté confirmado.

UPDATE public.staff_users
SET role = 'ADMIN'
WHERE lower(email) IN (
  'rubnlira2@gmail.com',
  'alancitomukul@outlook.com',
  'alecanche328@gmail.com'
);

-- Los dueños de cada gimnasio conservan OWNER: son administradores de su
-- propio portal y no pueden autorizar el alta de otros gimnasios.
UPDATE public.gyms g
SET contact_email = COALESCE(g.contact_email, s.email)
FROM public.staff_users s
WHERE s.gym_id = g.id
  AND s.role = 'OWNER'
  AND g.contact_email IS NULL;
