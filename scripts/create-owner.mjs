/**
 * Wrapper documented in docs/DEPLOYMENT.md.
 * Delega en apps/api/scripts/create-owner.mjs para resolver @prisma/client
 * desde el workspace de la API.
 */
await import('../apps/api/scripts/create-owner.mjs')
