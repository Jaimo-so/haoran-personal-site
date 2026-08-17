declare interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
  run(): Promise<{ meta: { last_row_id: number } }>
}

declare interface D1Database {
  prepare(query: string): D1PreparedStatement
}

declare interface KVNamespace {
  get(key: string): Promise<string | null>
  get<T = unknown>(key: string, type: 'json'): Promise<T | null>
  put(
    key: string,
    value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
    options?: { expirationTtl?: number }
  ): Promise<void>
  delete(key: string): Promise<void>
}

declare interface R2ObjectBody {
  body: ReadableStream | null
  httpEtag: string
  writeHttpMetadata(headers: Headers): void
}

declare interface R2Bucket {
  put(
    key: string,
    value: File | ArrayBuffer | ArrayBufferView | ReadableStream,
    options?: {
      httpMetadata?: {
        contentType?: string
        cacheControl?: string
      }
    }
  ): Promise<void>
  get(key: string): Promise<R2ObjectBody | null>
}

declare interface QueueBinding {
  send(body: unknown): Promise<void>
}

declare interface WorkersAIBinding {
  run(model: string, input: unknown): Promise<unknown>
}

declare interface VectorizeIndex {
  describe(): Promise<{ config?: { dimensions?: number }; dimensions?: number }>
  query(vector: number[], options?: Record<string, unknown>): Promise<unknown>
  upsert(items: Array<Record<string, unknown>>): Promise<unknown>
  deleteByIds?(ids: string[]): Promise<unknown>
}

declare interface CloudflareEnv {
  DB?: D1Database
  KV?: KVNamespace
  CACHE?: KVNamespace
  IMAGES?: R2Bucket
  BACKGROUND_QUEUE?: QueueBinding
  WORKERS_AI?: WorkersAIBinding
  VECTOR_INDEX?: VectorizeIndex
  ADMIN_PASSWORD?: string
  ADMIN_TOKEN_SALT?: string
  AI_CONFIG_ENCRYPTION_SECRET?: string
  NEXT_PUBLIC_SITE_URL?: string
  AI_API_KEY?: string
  AI_BASE_URL?: string
  AI_MODEL?: string
  WORKERS_AI_MODEL?: string
  CLOUDFLARE_ACCOUNT_ID?: string
  CLOUDFLARE_API_TOKEN?: string
  ENABLE_BACKGROUND_JOBS?: string
  ENABLE_WORKERS_AI?: string
  ENABLE_VECTOR_SEARCH?: string
  ENABLE_CF_IMAGE_PIPELINE?: string
}
