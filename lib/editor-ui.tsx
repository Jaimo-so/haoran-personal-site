'use client'

import { useCallback, useEffect, useState, type RefObject } from 'react'
import {
  type InputModalDetail,
  type TriggerAIModalDetail,
  type TriggerImageGenerationDetail,
  TRIGGER_AI_MODAL_EVENT,
  TRIGGER_FILE_UPLOAD_EVENT,
  TRIGGER_IMAGE_GENERATION_EVENT,
  TRIGGER_IMAGE_UPLOAD_EVENT,
  TRIGGER_INPUT_MODAL_EVENT,
} from '@/lib/editor-events'

export function extractFilesFromClipboard(event: React.ClipboardEvent<HTMLElement>): File[] {
  const files: File[] = []
  const items = event.clipboardData?.items

  if (items) {
    for (const item of Array.from(items)) {
      if (item.kind !== 'file') continue
      const file = item.getAsFile()
      if (file) files.push(file)
    }
  }

  const fallbackFiles = Array.from(event.clipboardData?.files ?? [])
  const merged = files.length > 0 ? files : fallbackFiles
  const seen = new Set<string>()

  return merged.filter((file) => {
    const key = `${file.name}:${file.size}:${file.type}:${file.lastModified}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

type EditorInputModalState = {
  open: boolean
  title: string
  placeholder: string
  callback: ((value: string) => void) | null
}

type EditorAiModalState = {
  open: boolean
  selectedText: string
  position: { top: number; left: number } | null
  selectionRange: { from: number; to: number } | null
  initialContext: 'selection' | 'document'
  documentTitle: string
  documentText: string
}

type EditorImageModalState = {
  open: boolean
  insertPos: number | null
  contextText: string
}

const CLOSED_INPUT_MODAL: EditorInputModalState = {
  open: false,
  title: '',
  placeholder: '',
  callback: null,
}

const CLOSED_AI_MODAL: EditorAiModalState = {
  open: false,
  selectedText: '',
  position: null,
  selectionRange: null,
  initialContext: 'selection',
  documentTitle: '',
  documentText: '',
}

const CLOSED_IMAGE_MODAL: EditorImageModalState = {
  open: false,
  insertPos: null,
  contextText: '',
}

interface UseEditorAuxiliaryModalsOptions {
  title: string
  getDocumentText: () => string
  getSelectionContext: () => {
    selectedText: string
    insertPos: number | null
  }
}

export function useEditorUploadTriggers(
  imageInputRef: RefObject<HTMLInputElement | null>,
  fileUploadRef: RefObject<HTMLInputElement | null>,
) {
  useEffect(() => {
    const openImageInput = () => imageInputRef.current?.click()
    const openFileInput = () => fileUploadRef.current?.click()

    window.addEventListener(TRIGGER_IMAGE_UPLOAD_EVENT, openImageInput)
    window.addEventListener(TRIGGER_FILE_UPLOAD_EVENT, openFileInput)

    return () => {
      window.removeEventListener(TRIGGER_IMAGE_UPLOAD_EVENT, openImageInput)
      window.removeEventListener(TRIGGER_FILE_UPLOAD_EVENT, openFileInput)
    }
  }, [fileUploadRef, imageInputRef])
}

export function useEditorAuxiliaryModals({
  title,
  getDocumentText,
  getSelectionContext,
}: UseEditorAuxiliaryModalsOptions) {
  const [inputModal, setInputModal] = useState<EditorInputModalState>(CLOSED_INPUT_MODAL)
  const [aiModal, setAiModal] = useState<EditorAiModalState>(CLOSED_AI_MODAL)
  const [imageModal, setImageModal] = useState<EditorImageModalState>(CLOSED_IMAGE_MODAL)

  const closeAiModal = useCallback(() => {
    setAiModal(CLOSED_AI_MODAL)
  }, [])

  const closeImageModal = useCallback(() => {
    setImageModal(CLOSED_IMAGE_MODAL)
  }, [])

  const handleInputModalConfirm = useCallback((value: string) => {
    setInputModal((state) => {
      state.callback?.(value)
      return CLOSED_INPUT_MODAL
    })
  }, [])

  const handleInputModalCancel = useCallback(() => {
    setInputModal(CLOSED_INPUT_MODAL)
  }, [])

  const openDocumentAIModal = useCallback((anchorEl?: HTMLElement | null) => {
    const documentTitle = title.trim()
    const documentText = getDocumentText().trim()

    if (!documentTitle && !documentText) return

    const rect = anchorEl?.getBoundingClientRect()
    const fallbackLeft = typeof window !== 'undefined' ? window.innerWidth - 320 : 960

    setAiModal({
      open: true,
      selectedText: '',
      position: rect
        ? { top: rect.bottom + 8, left: rect.left + rect.width / 2 }
        : { top: 72, left: fallbackLeft },
      selectionRange: null,
      initialContext: 'document',
      documentTitle,
      documentText,
    })
  }, [getDocumentText, title])

  const openDocumentImageModal = useCallback(() => {
    const { insertPos, selectedText } = getSelectionContext()
    setImageModal({
      open: true,
      insertPos,
      contextText: selectedText,
    })
  }, [getSelectionContext])

  useEffect(() => {
    const handleInputModal = (event: Event) => {
      const detail = (event as CustomEvent<InputModalDetail>).detail
      setInputModal({
        open: true,
        title: detail.title,
        placeholder: detail.placeholder,
        callback: detail.callback,
      })
    }

    const handleAiModal = (event: Event) => {
      const detail = (event as CustomEvent<TriggerAIModalDetail>).detail
      setAiModal({
        open: true,
        selectedText: detail.selectedText,
        position: detail.position,
        selectionRange: detail.selectionRange,
        initialContext: 'selection',
        documentTitle: title.trim(),
        documentText: getDocumentText().trim(),
      })
    }

    const handleImageModal = (event: Event) => {
      const detail = (event as CustomEvent<TriggerImageGenerationDetail>).detail
      setImageModal({
        open: true,
        insertPos: detail.insertPos,
        contextText: detail.selectedText,
      })
    }

    window.addEventListener(TRIGGER_INPUT_MODAL_EVENT, handleInputModal)
    window.addEventListener(TRIGGER_AI_MODAL_EVENT, handleAiModal)
    window.addEventListener(TRIGGER_IMAGE_GENERATION_EVENT, handleImageModal)

    return () => {
      window.removeEventListener(TRIGGER_INPUT_MODAL_EVENT, handleInputModal)
      window.removeEventListener(TRIGGER_AI_MODAL_EVENT, handleAiModal)
      window.removeEventListener(TRIGGER_IMAGE_GENERATION_EVENT, handleImageModal)
    }
  }, [getDocumentText, title])

  return {
    aiModal,
    closeAiModal,
    closeImageModal,
    handleInputModalCancel,
    handleInputModalConfirm,
    imageModal,
    inputModal,
    openDocumentAIModal,
    openDocumentImageModal,
    setAiModal,
    setImageModal,
  }
}
