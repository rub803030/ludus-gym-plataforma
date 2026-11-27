-- Los socios creados desde la consola antes de la migración 0006 no generaron
-- su fila en gym_memberships. Se repara la afiliación respetando las filas
-- existentes (incluidas las suspendidas).

INSERT INTO public.gym_memberships (gym_id, member_id, joined_at)
SELECT m.gym_id, m.id, m.joined_at
FROM public.members AS m
JOIN public.gyms AS g
  ON g.id = m.gym_id
 AND g.deleted_at IS NULL
LEFT JOIN public.gym_memberships AS gm
  ON gm.gym_id = m.gym_id
 AND gm.member_id = m.id
WHERE m.gym_id IS NOT NULL
  AND m.deleted_at IS NULL
  AND gm.id IS NULL
ON CONFLICT (gym_id, member_id) DO NOTHING;
