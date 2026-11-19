# Runbook — Incidente en torniquete

Si el API no responde, el móvil usa la credencial firmada en caché (TTL 10 min).
El lector valida HMAC y arena de tiempo. Si falla, se registra el intento offline
y se sincroniza al recuperar red con el `event_id` original para evitar duplicados.
