import { processPost, getAiRuntimeEnv } from '@/lib/ai'
import { invalidatePublicContentCache } from '@/lib/cache'
import { getPostAiSnapshot, updatePost } from '@/lib/db'
import { buildAutoDescription } from '@/lib/post-utils'
import { deletePostFromRelatedIndex, syncPostToRelatedIndex } from '@/lib/related-content'

export type BackgroundJob =
  | {
      type: 'process-post-ai'
      postId: number
    }
  | {
      type: 'sync-post-related-index'
      postId: number
    }
  | {
      type: 'delete-post-related-index'
      postId: number
    }

export interface BackgroundJobEnv extends Partial<CloudflareEnv> {
  DB?: D1Database
  CACHE?: KVNamespace
  BACKGROUND_QUEUE?: QueueBinding
  VECTOR_INDEX?: VectorizeIndex
}

interface BackgroundJobMessage<T> {
  body: T
  ack?: () => void
  retry?: () => void
}

interface BackgroundJobBatch<T> {
  messages: Array<BackgroundJobMessage<T>>
}

interface EnqueueBackgroundJobOptions {
  waitUntil?: (promise: Promise<unknown>) => void
}

function readFlag(value: unknown): boolean {
  return typeof value === 'string' && ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

function shouldUseQueue(env?: BackgroundJobEnv | null): boolean {
  return Boolean(env?.BACKGROUND_QUEUE) && readFlag(env?.ENABLE_BACKGROUND_JOBS)
}

async function runProcessPostAiJob(env: BackgroundJobEnv, postId: number) {
  if (!env.DB) return

  const post = await getPostAiSnapshot(env.DB, postId)
  if (!post || post.deleted_at) return

  const aiResult = await processPost(post.title, post.content, getAiRuntimeEnv(env), 2, env.DB)
  if (!aiResult) return

  const updates: Parameters<typeof updatePost>[2] = {}
  const autoDescription = buildAutoDescription(post.content)

  if (!post.category || post.category === '未分类') {
    updates.category = aiResult.category
  }

  if (post.tags.length === 0 && aiResult.tags.length > 0) {
    updates.tags = aiResult.tags
  }

  if (!post.description || post.description === autoDescription) {
    updates.description = aiResult.description
  }

  if (Object.keys(updates).length === 0) return

  await updatePost(env.DB, postId, updates)
  await invalidatePublicContentCache(env)

  await syncPostToRelatedIndex(env, postId)
}

async function runSyncPostRelatedIndexJob(env: BackgroundJobEnv, postId: number) {
  await syncPostToRelatedIndex(env, postId)
}

async function runDeletePostRelatedIndexJob(env: BackgroundJobEnv, postId: number) {
  await deletePostFromRelatedIndex(env, postId)
}

export async function runBackgroundJob(env: BackgroundJobEnv, job: BackgroundJob): Promise<void> {
  switch (job.type) {
    case 'process-post-ai':
      await runProcessPostAiJob(env, job.postId)
      return
    case 'sync-post-related-index':
      await runSyncPostRelatedIndexJob(env, job.postId)
      return
    case 'delete-post-related-index':
      await runDeletePostRelatedIndexJob(env, job.postId)
      return
  }
}

export async function enqueueBackgroundJob(
  env: BackgroundJobEnv,
  job: BackgroundJob,
  options?: EnqueueBackgroundJobOptions,
): Promise<'queue' | 'waitUntil' | 'inline'> {
  if (shouldUseQueue(env)) {
    try {
      await env.BACKGROUND_QUEUE!.send(job)
      return 'queue'
    } catch (error) {
      console.error('Failed to enqueue background job, falling back to inline execution:', error)
    }
  }

  const task = runBackgroundJob(env, job)

  if (options?.waitUntil) {
    options.waitUntil(
      task.catch((error) => {
        console.error('Background job failed:', error)
      }),
    )
    return 'waitUntil'
  }

  void task.catch((error) => {
    console.error('Background job failed:', error)
  })
  return 'inline'
}

export async function consumeBackgroundJobBatch(
  batch: BackgroundJobBatch<BackgroundJob>,
  env: BackgroundJobEnv,
): Promise<void> {
  for (const message of batch.messages) {
    try {
      await runBackgroundJob(env, message.body)
      message.ack?.()
    } catch (error) {
      console.error('Queue background job failed:', error)
      message.retry?.()
    }
  }
}
