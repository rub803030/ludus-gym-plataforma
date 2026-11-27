-- 0010 y 0011 quedan reservadas para el paquete de estabilización de membresías.
-- Esta migración evita que la auditoría deje de escribir a partir de 2027-01-01:
-- las particiones de 0001_init.sql terminan en esa fecha y no tenían DEFAULT.

CREATE TABLE IF NOT EXISTS audit_logs_default PARTITION OF audit_logs DEFAULT;
