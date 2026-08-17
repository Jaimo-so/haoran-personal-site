export type AIImageAspectRatio =
  | 'auto'
  | '21:9'
  | '16:9'
  | '3:2'
  | '4:3'
  | '1:1'
  | '3:4'
  | '2:3'
  | '9:16'

export type AIImageResolution = 'auto' | '1k' | '2k' | '4k'

type LegacyImageSize = 'auto' | '1536x1024' | '1024x1536' | '1024x1024'
type LegacyImageQuality = 'auto' | 'low' | 'medium' | 'high'

export const AI_IMAGE_ASPECT_RATIO_OPTIONS: Array<{ value: AIImageAspectRatio; label: string }> = [
  { value: 'auto', label: '智能' },
  { value: '21:9', label: '21:9' },
  { value: '16:9', label: '16:9' },
  { value: '3:2', label: '3:2' },
  { value: '4:3', label: '4:3' },
  { value: '1:1', label: '1:1' },
  { value: '3:4', label: '3:4' },
  { value: '2:3', label: '2:3' },
  { value: '9:16', label: '9:16' },
]

export const AI_IMAGE_RESOLUTION_OPTIONS: Array<{ value: AIImageResolution; label: string }> = [
  { value: 'auto', label: '智能' },
  { value: '1k', label: '标准 1K' },
  { value: '2k', label: '高清 2K' },
  { value: '4k', label: '精细 4K' },
]

const ASPECT_RATIO_SET = new Set<string>(AI_IMAGE_ASPECT_RATIO_OPTIONS.map((option) => option.value))
const RESOLUTION_SET = new Set<string>(AI_IMAGE_RESOLUTION_OPTIONS.map((option) => option.value))

export function normalizeAiImageAspectRatio(value?: string): AIImageAspectRatio {
  const normalized = (value || '').trim()
  if (ASPECT_RATIO_SET.has(normalized)) return normalized as AIImageAspectRatio
  return 'auto'
}

export function normalizeAiImageResolution(value?: string): AIImageResolution {
  const normalized = (value || '').trim().toLowerCase()
  if (RESOLUTION_SET.has(normalized)) return normalized as AIImageResolution
  return 'auto'
}

export function inferAspectRatioFromLegacySize(size?: string): AIImageAspectRatio {
  const normalized = (size || '').trim()
  switch (normalized) {
    case '1536x1024':
      return '3:2'
    case '1024x1536':
      return '2:3'
    case '1024x1024':
      return '1:1'
    default:
      return 'auto'
  }
}

export function inferResolutionFromLegacyQuality(quality?: string): AIImageResolution {
  const normalized = (quality || '').trim().toLowerCase()
  switch (normalized) {
    case 'low':
      return '1k'
    case 'medium':
      return '2k'
    case 'high':
      return '4k'
    default:
      return 'auto'
  }
}

function parseAspectRatio(value: AIImageAspectRatio) {
  if (value === 'auto') return null
  const [width, height] = value.split(':').map((item) => Number(item))
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
  return { width, height }
}

export function deriveLegacySizeFromAspectRatio(
  aspectRatio?: string,
  fallbackSize?: string,
): LegacyImageSize {
  const normalized = normalizeAiImageAspectRatio(aspectRatio)
  if (normalized === 'auto') {
    const fallback = (fallbackSize || '').trim()
    if (fallback === '1536x1024' || fallback === '1024x1536' || fallback === '1024x1024') {
      return fallback
    }
    return 'auto'
  }

  if (normalized === '1:1') return '1024x1024'

  const parsed = parseAspectRatio(normalized)
  if (!parsed) return 'auto'
  return parsed.width > parsed.height ? '1536x1024' : '1024x1536'
}

export function deriveLegacyQualityFromResolution(
  resolution?: string,
  fallbackQuality?: string,
): LegacyImageQuality {
  const normalized = normalizeAiImageResolution(resolution)
  if (normalized === 'auto') {
    const fallback = (fallbackQuality || '').trim().toLowerCase()
    if (fallback === 'low' || fallback === 'medium' || fallback === 'high') {
      return fallback
    }
    return 'auto'
  }

  switch (normalized) {
    case '1k':
      return 'low'
    case '2k':
      return 'medium'
    case '4k':
      return 'high'
    default:
      return 'auto'
  }
}

export function getAiImageAspectRatioLabel(value?: string) {
  const normalized = normalizeAiImageAspectRatio(value)
  return AI_IMAGE_ASPECT_RATIO_OPTIONS.find((option) => option.value === normalized)?.label || '智能'
}

export function getAiImageResolutionLabel(value?: string) {
  const normalized = normalizeAiImageResolution(value)
  return AI_IMAGE_RESOLUTION_OPTIONS.find((option) => option.value === normalized)?.label || '智能'
}

export function buildAspectRatioPromptHint(aspectRatio?: string) {
  switch (normalizeAiImageAspectRatio(aspectRatio)) {
    case '21:9':
      return '画面比例倾向为 21:9 超宽横幅，左右延展更充分，主体保持在中部安全区域。'
    case '16:9':
      return '画面比例倾向为 16:9 横版主视觉，构图舒展，适合章节头图或封面横幅。'
    case '3:2':
      return '画面比例倾向为 3:2 横向摄影式构图，主体与留白保持平衡。'
    case '4:3':
      return '画面比例倾向为 4:3 横版插图，画面更聚焦，不要把主体贴边。'
    case '1:1':
      return '画面比例倾向为 1:1 正方形，主体完整且边缘收束干净。'
    case '3:4':
      return '画面比例倾向为 3:4 竖版 editorial 插图，强调上下层次与视觉重心。'
    case '2:3':
      return '画面比例倾向为 2:3 竖版封面，主体明确，留出上下呼吸感。'
    case '9:16':
      return '画面比例倾向为 9:16 竖屏海报或移动端封面，主体集中并注意顶部与底部安全区。'
    default:
      return ''
  }
}

export function buildResolutionPromptHint(resolution?: string) {
  switch (normalizeAiImageResolution(resolution)) {
    case '1k':
      return '输出精度偏向标准档，细节克制，避免过度堆砌纹理。'
    case '2k':
      return '输出精度偏向高清档，保证主体边缘、材质与层次更清楚。'
    case '4k':
      return '输出精度偏向精细档，优先保证高细节和封面级完成度。'
    default:
      return ''
  }
}
