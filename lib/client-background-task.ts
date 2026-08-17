'use client'

export const LOCAL_HISTORY_UPDATED_EVENT = 'qmblog:local-history-updated'

export interface BackgroundTaskToastApi {
  success: (message: string, duration?: number) => void
  error: (message: string, duration?: number) => void
  info: (message: string, duration?: number) => void
}

interface LocalHistoryUpdatedDetail<T> {
  storageKey: string
  items: T[]
}

interface StartBackgroundTaskOptions<T> {
  toast: BackgroundTaskToastApi
  run: () => Promise<T>
  startedMessage?: string
  successMessage?: string
  errorPrefix?: string
  startedDuration?: number
  successDuration?: number
  errorDuration?: number
  onSuccess?: (result: T) => void
  onError?: (message: string, error: unknown) => void
  onSettled?: () => void
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }
  return '操作失败'
}

export function startBackgroundTask<T>({
  toast,
  run,
  startedMessage,
  successMessage,
  errorPrefix,
  startedDuration = 2400,
  successDuration = 4200,
  errorDuration = 5200,
  onSuccess,
  onError,
  onSettled,
}: StartBackgroundTaskOptions<T>) {
  if (startedMessage) {
    toast.info(startedMessage, startedDuration)
  }

  void (async () => {
    try {
      const result = await run()
      onSuccess?.(result)

      if (successMessage) {
        toast.success(successMessage, successDuration)
      }
    } catch (error) {
      const message = getErrorMessage(error)
      onError?.(message, error)
      toast.error(errorPrefix ? `${errorPrefix}：${message}` : message, errorDuration)
    } finally {
      onSettled?.()
    }
  })()
}

export function readStoredHistory<T>(storageKey: string): T[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw) as T[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function writeStoredHistory<T>(storageKey: string, items: T[]) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(items))
    window.dispatchEvent(new CustomEvent<LocalHistoryUpdatedDetail<T>>(LOCAL_HISTORY_UPDATED_EVENT, {
      detail: {
        storageKey,
        items,
      },
    }))
  } catch {
    // Ignore storage sync failures. History is a best-effort enhancement.
  }
}

export function appendStoredHistoryItem<T>(
  storageKey: string,
  item: T,
  options?: {
    maxItems?: number
    dedupe?: (candidate: T, existing: T) => boolean
  },
) {
  const maxItems = options?.maxItems ?? 10
  const existingItems = readStoredHistory<T>(storageKey)
  const dedupedItems = options?.dedupe
    ? existingItems.filter((existing) => !options.dedupe?.(item, existing))
    : existingItems

  const nextItems = [item, ...dedupedItems].slice(0, maxItems)
  writeStoredHistory(storageKey, nextItems)
  return nextItems
}
