# ADR 0001 — Stack y separación de plataformas

- Estado: Aceptado
- Web: Next.js App Router + TS estricto + Tailwind con design tokens.
- API: Fastify + TS, módulos de dominio aislados.
- Móvil: Android nativo Kotlin + Compose (ajuste sobre el spec original React Native/Expo,
  solicitado explícitamente por el propietario del producto para integración con Android Studio).
- Shared: Zod como única fuente de verdad de contratos y RBAC.
- DB: PostgreSQL + Prisma con UUIDv7 y soft delete.

## Consecuencias

El acceso a la web está prohibido para MEMBER a nivel de middleware y de base de datos
(RLS + check de rol en la consulta de sesión). El móvil usa el equivalente a SecureStore:
Android Keystore vía EncryptedSharedPreferences.
