'use client'

import { useSyncExternalStore } from 'react'
import { getSession, subscribeSession } from '@/lib/api-client'
import type { Session } from '@/types'

const SERVER_SNAPSHOT: Session | null = null

export function useSession(): Session | null {
  return useSyncExternalStore(subscribeSession, getSession, () => SERVER_SNAPSHOT)
}
