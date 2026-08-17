export const TRIGGER_IMAGE_UPLOAD_EVENT = 'editor:trigger-image-upload'
export const TRIGGER_FILE_UPLOAD_EVENT = 'editor:trigger-file-upload'
export const TRIGGER_INPUT_MODAL_EVENT = 'editor:trigger-input-modal'
export const TRIGGER_IMAGE_GENERATION_EVENT = 'editor:trigger-image-generation'
export const TRIGGER_AI_MODAL_EVENT = 'editor:trigger-ai-modal'

export interface InputModalDetail {
  title: string
  placeholder: string
  callback: (value: string) => void
}

export interface TriggerImageGenerationDetail {
  insertPos: number
  selectedText: string
}

export interface TriggerAIModalDetail {
  selectedText: string
  position: { top: number; left: number }
  selectionRange: { from: number; to: number }
}
