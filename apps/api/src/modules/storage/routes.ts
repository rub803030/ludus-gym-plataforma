import { createHash, createHmac, randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { loadEnv } from '../../config/env.js'
import { prisma } from '../../shared/database/prisma.js'
import { DomainError } from '../../shared/errors/domain-error.js'
import { getPrincipal } from '../../shared/middleware/request-context.js'
import { requireAuth } from '../../shared/http.js'

const presignSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']).optional(),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']).optional(),
  sizeBytes: z.number().int().positive().max(15 * 1024 * 1024),
  magicBytes: z.string().regex(/^[0-9a-fA-F]+$/).min(4).max(32),
  sha256: z.string().regex(/^[0-9a-fA-F]{64}$/),
  purpose: z.enum(['avatar', 'receipt', 'medical']).default('avatar'),
})

const MAGIC: Record<string, string[]> = {
  'image/jpeg': ['ffd8ff'],
  'image/png': ['89504e47'],
  'image/webp': ['52494646'],
  'application/pdf': ['25504446'],
}

function hmac(key: Buffer | string, data: string): string {
  return createHmac('sha256', key).update(data).digest('hex')
}

function presignPut(endpoint: string, bucket: string, region: string, accessKey: string, secretKey: string, key: string, contentType: string): string {
  const url = new URL(`${endpoint}/${bucket}/${key}`)
  const host = url.host
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  const payloadHash = createHash('sha256').update('').digest('hex')
  url.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256')
  url.searchParams.set('X-Amz-Credential', `${accessKey}/${dateStamp}/${region}/s3/aws4_request`)
  url.searchParams.set('X-Amz-Date', amzDate)
  url.searchParams.set('X-Amz-Expires', '900')
  url.searchParams.set('X-Amz-SignedHeaders', 'content-type;host')
  url.searchParams.set('X-Amz-Content-Type', contentType)
  const canonicalQuery = [...url.searchParams.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
  const canonicalRequest = [
    'PUT',
    `/${bucket}/${key}`,
    canonicalQuery,
    `content-type:${contentType}\nhost:${host}\n`,
    'content-type;host',
    payloadHash,
  ].join('\n')
  const scope = `${dateStamp}/${region}/s3/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, createHash('sha256').update(canonicalRequest).digest('hex')].join('\n')
  const kDate = hmac(`AWS4${secretKey}`, dateStamp)
  const kRegion = hmac(Buffer.from(kDate, 'hex'), region)
  const kService = hmac(Buffer.from(kRegion, 'hex'), 's3')
  const kSigning = hmac(Buffer.from(kService, 'hex'), 'aws4_request')
  const signature = hmac(Buffer.from(kSigning, 'hex'), stringToSign)
  url.searchParams.set('X-Amz-Signature', signature)
  return url.toString()
}

export async function registerStorageRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/uploads/presign', { preHandler: requireAuth }, async (req, reply) => {
    const body = presignSchema.parse(req.body)
    const mimeType = body.mimeType ?? body.contentType
    if (!mimeType) {
      throw new DomainError('VALIDATION_ERROR', 'Se requiere mimeType o contentType', 400)
    }
    const allowed = MAGIC[mimeType] ?? []
    const provided = body.magicBytes.toLowerCase()
    if (!allowed.some((prefix) => provided.startsWith(prefix))) {
      throw new DomainError('VALIDATION_ERROR', 'El contenido del archivo no coincide con el tipo declarado', 415)
    }
    const principal = getPrincipal(req)
    const extension = body.fileName.split('.').pop()?.toLowerCase() ?? 'bin'
    const objectKey = `${principal.gymId}/${body.purpose}/${randomUUID()}.${extension}`
    const env = loadEnv()
    const endpoint = env.S3_ENDPOINT
    const bucket = env.S3_BUCKET
    const region = env.S3_REGION
    const accessKey = env.S3_ACCESS_KEY
    const secretKey = env.S3_SECRET_KEY
    const uploadUrl = presignPut(endpoint, bucket, region, accessKey, secretKey, objectKey, mimeType)

    await prisma.upload.create({
      data: {
        gymId: principal.gymId,
        uploadedBy: principal.id,
        objectKey,
        mimeType,
        sizeBytes: body.sizeBytes,
        sha256: body.sha256.toLowerCase(),
        purpose: body.purpose,
      },
    })
    reply.code(201)
    return {
      uploadUrl,
      url: uploadUrl,
      objectKey,
      key: objectKey,
      publicUrl: `${endpoint}/${bucket}/${objectKey}`,
      expiresIn: 900,
    }
  })
}
