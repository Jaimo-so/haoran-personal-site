'use client'

const SKIP_IMAGE_TYPES = new Set(['image/gif', 'image/svg+xml'])

export interface OptimizeImageOptions {
  maxWidth: number
  maxHeight: number
  quality?: number
  format?: 'image/webp' | 'image/jpeg' | 'image/png'
  minBytes?: number
}

export interface CropAreaPixels {
  width: number
  height: number
  x: number
  y: number
}

export const EDITOR_IMAGE_OPTIMIZE_OPTIONS: OptimizeImageOptions = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.84,
  format: 'image/webp',
  minBytes: 250 * 1024,
}

export const COVER_IMAGE_OPTIMIZE_OPTIONS: OptimizeImageOptions = {
  maxWidth: 1600,
  maxHeight: 900,
  quality: 0.82,
  format: 'image/webp',
  minBytes: 180 * 1024,
}

function canOptimize(file: File) {
  return file.type.startsWith('image/') && !SKIP_IMAGE_TYPES.has(file.type)
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    if (!src.startsWith('data:')) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片解析失败'))
    img.src = src
  })
}

function getExtension(type: string) {
  if (type === 'image/png') return 'png'
  if (type === 'image/jpeg') return 'jpg'
  return 'webp'
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('图片压缩失败'))
        return
      }
      resolve(blob)
    }, type, quality)
  })
}

export async function optimizeImageForUpload(file: File, options: OptimizeImageOptions): Promise<File> {
  if (typeof window === 'undefined' || !canOptimize(file)) return file

  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await loadImage(objectUrl)
    const { maxWidth, maxHeight, quality = 0.84, format = 'image/webp', minBytes = 0 } = options

    const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight, 1)
    const targetWidth = Math.max(1, Math.round(image.naturalWidth * scale))
    const targetHeight = Math.max(1, Math.round(image.naturalHeight * scale))
    const shouldResize = targetWidth !== image.naturalWidth || targetHeight !== image.naturalHeight
    const shouldCompress = file.size >= minBytes || shouldResize

    if (!shouldCompress) return file

    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight

    const context = canvas.getContext('2d', { alpha: true })
    if (!context) return file

    context.drawImage(image, 0, 0, targetWidth, targetHeight)

    const blob = await toBlob(canvas, format, quality)

    if (blob.size >= file.size * 0.98 && !shouldResize) {
      return file
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image'
    const extension = getExtension(format)

    return new File([blob], `${baseName}.${extension}`, {
      type: format,
      lastModified: file.lastModified,
    })
  } catch {
    return file
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function cropImageForUpload(
  imageUrl: string,
  cropAreaPixels: CropAreaPixels,
  options: OptimizeImageOptions,
  baseName = 'image',
): Promise<File> {
  if (typeof window === 'undefined') {
    throw new Error('当前环境不支持裁剪图片')
  }

  const image = await loadImage(imageUrl)
  const { format = 'image/webp', quality = 0.9 } = options

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(cropAreaPixels.width))
  canvas.height = Math.max(1, Math.round(cropAreaPixels.height))

  const context = canvas.getContext('2d', { alpha: true })
  if (!context) {
    throw new Error('裁剪画布初始化失败')
  }

  try {
    context.drawImage(
      image,
      cropAreaPixels.x,
      cropAreaPixels.y,
      cropAreaPixels.width,
      cropAreaPixels.height,
      0,
      0,
      canvas.width,
      canvas.height,
    )
  } catch {
    throw new Error('当前图片来源不支持浏览器内裁剪，请先上传到本站后再试')
  }

  const blob = await toBlob(canvas, format, quality)
  const extension = getExtension(format)

  return new File([blob], `${baseName || 'image'}.${extension}`, {
    type: format,
    lastModified: Date.now(),
  })
}
