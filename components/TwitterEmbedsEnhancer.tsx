'use client'

import { useEffect } from 'react'
import { enhanceTwitterEmbeds } from '@/lib/twitter-widgets'

export function TwitterEmbedsEnhancer({
  containerId,
  html,
}: {
  containerId: string
  html: string
}) {
  useEffect(() => {
    const root = document.getElementById(containerId)
    if (!root) return

    void enhanceTwitterEmbeds(root)
  }, [containerId, html])

  return null
}
