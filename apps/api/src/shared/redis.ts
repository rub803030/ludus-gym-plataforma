import { Redis } from 'ioredis'

export interface CacheClient {
  get(key: string): Promise<string | null>
  set(key: string, value: string, mode?: 'EX', ttl?: number, flag?: 'NX'): Promise<string | null>
  del(key: string): Promise<number>
  publish(channel: string, message: string): Promise<number>
  subscribe(channel: string, handler: (message: string) => void): Promise<void>
}

class MemoryCache implements CacheClient {
  private store = new Map<string, { value: string; expiresAt?: number }>()
  private subscribers = new Map<string, Set<(message: string) => void>>()

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key)
    if (!item) return null
    if (item.expiresAt && item.expiresAt < Date.now()) {
      this.store.delete(key)
      return null
    }
    return item.value
  }

  async set(key: string, value: string, mode?: 'EX', ttl?: number, flag?: 'NX'): Promise<string | null> {
    if (flag === 'NX' && (await this.get(key))) return null
    this.store.set(key, {
      value,
      expiresAt: mode === 'EX' && ttl ? Date.now() + ttl * 1000 : undefined,
    })
    return 'OK'
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0
  }

  async publish(channel: string, message: string): Promise<number> {
    this.subscribers.get(channel)?.forEach((handler) => handler(message))
    return this.subscribers.get(channel)?.size ?? 0
  }

  async subscribe(channel: string, handler: (message: string) => void): Promise<void> {
    const set = this.subscribers.get(channel) ?? new Set()
    set.add(handler)
    this.subscribers.set(channel, set)
  }
}

let client: CacheClient | null = null
let rawRedis: Redis | null = null

/**
 * Cliente ioredis crudo, reutilizado por @fastify/rate-limit para que el
 * contador sea compartido entre todas las instancias de la API. Devuelve
 * null cuando no hay REDIS_URL (desarrollo sin Redis → store en memoria).
 */
export function getRedisClient(): Redis | null {
  if (client) return rawRedis
  getCache()
  return rawRedis
}

export function getCache(): CacheClient {
  if (client) return client
  const url = process.env.REDIS_URL
  if (!url) {
    client = new MemoryCache()
    return client
  }
  const redis = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 1500,
  })
  rawRedis = redis
  redis.on('error', () => undefined)
  redis
    .connect()
    .then(() => undefined)
    .catch(() => undefined)

  let usingMemory = false
  const fallback = new MemoryCache()

  client = {
    async get(key) {
      if (usingMemory) return fallback.get(key)
      try {
        return await redis.get(key)
      } catch {
        usingMemory = true
        return fallback.get(key)
      }
    },
    async set(key, value, mode, ttl, flag) {
      if (usingMemory) return fallback.set(key, value, mode, ttl, flag)
      try {
        if (flag === 'NX' && mode === 'EX' && ttl) {
          return await redis.set(key, value, 'EX', ttl, 'NX')
        }
        return await redis.set(key, value)
      } catch {
        usingMemory = true
        return fallback.set(key, value, mode, ttl, flag)
      }
    },
    async del(key) {
      if (usingMemory) return fallback.del(key)
      try {
        return await redis.del(key)
      } catch {
        usingMemory = true
        return fallback.del(key)
      }
    },
    async publish(channel, message) {
      if (usingMemory) return fallback.publish(channel, message)
      try {
        return await redis.publish(channel, message)
      } catch {
        usingMemory = true
        return fallback.publish(channel, message)
      }
    },
    async subscribe(channel, handler) {
      if (usingMemory) return fallback.subscribe(channel, handler)
      try {
        await redis.subscribe(channel)
        redis.on('message', (receivedChannel, message) => {
          if (receivedChannel === channel) handler(message)
        })
      } catch {
        usingMemory = true
        return fallback.subscribe(channel, handler)
      }
    },
  }
  return client
}
