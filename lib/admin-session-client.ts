'use client'

import { useSyncExternalStore } from 'react'

interface AdminSessionSnapshot {
  authenticated: boolean
  checked: boolean
}

const listeners = new Set<() => void>()
let snapshot: AdminSessionSnapshot = {
  authenticated: false,
  checked: false,
}
let inflight: Promise<void> | null = null

function emitChange() {
  for (const listener of listeners) {
    listener()
  }
}

async function loadAdminSession(force = false) {
  if (!force && inflight) {
    return inflight
  }

  const request = (async () => {
    try {
      const response = await fetch('/api/admin/session', {
        cache: 'no-store',
        credentials: 'include',
      })
      const data = (await response.json().catch(() => ({}))) as {
        authenticated?: boolean
      }

      snapshot = {
        authenticated: Boolean(response.ok && data.authenticated),
        checked: true,
      }
    } catch {
      snapshot = {
        authenticated: false,
        checked: true,
      }
    } finally {
      emitChange()
    }
  })()

  inflight = request.finally(() => {
    if (inflight === request) {
      inflight = null
    }
  })

  return inflight
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange)

  if (!snapshot.checked && !inflight) {
    void loadAdminSession()
  }

  return () => {
    listeners.delete(onStoreChange)
  }
}

function getSnapshot() {
  return snapshot
}

export async function refreshAdminSession() {
  await loadAdminSession(true)
}

export function useAdminSession() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  return {
    ...state,
    refresh: refreshAdminSession,
  }
}
