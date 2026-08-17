import type { GeneratedEditorImage } from '@/lib/ai-image'
import type { AIImageAspectRatio, AIImageResolution } from '@/lib/ai-image-options'

export type AiPostGeneratorTarget = 'summary' | 'tags' | 'slug' | 'cover'
export type AiPostGeneratorProviderMode = 'workers_ai' | 'profile'

export type ImageBucket = {
  put: (
    key: string,
    value: File | ArrayBuffer | ArrayBufferView | ReadableStream,
    options?: {
      httpMetadata?: {
        contentType?: string
        cacheControl?: string
      }
      customMetadata?: Record<string, string>
    }
  ) => Promise<void>
}

export interface AiPostGeneratorRow {
  id: number
  target_key: AiPostGeneratorTarget
  label: string
  description: string
  prompt: string
  provider_mode: AiPostGeneratorProviderMode
  text_profile_id: number | null
  image_profile_id: number | null
  workers_model: string
  temperature: number
  max_tokens: number
  aspect_ratio: AIImageAspectRatio
  resolution: AIImageResolution
  is_enabled: number
  is_builtin: number
  created_at: number
  updated_at: number
}

export interface GeneratePostMetadataInput {
  target: Exclude<AiPostGeneratorTarget, 'cover'>
  title?: string
  content?: string
  category?: string
  description?: string
  tags?: string[]
  currentSlug?: string
  db: D1Database
  env?: Partial<CloudflareEnv> | null
}

export interface GeneratePostCoverInput {
  title?: string
  content?: string
  category?: string
  description?: string
  tags?: string[]
  db: D1Database
  images: ImageBucket
  env?: Partial<CloudflareEnv> | null
}

export interface GeneratedPostCoverResult {
  generator: AiPostGeneratorRow
  image: GeneratedEditorImage
}
